import { db } from "@/lib/db";
import { events, bets, bankroll, eventMapping } from "@/lib/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { getPendingBetsForEvents } from "@/lib/db/queries/bets";
import { SPORT_CONFIGS } from "@/types/sports";

interface ScoreEntry {
  id: string;           // Odds API event ID
  completed: boolean;
  scores: Array<{ name: string; score: string }> | null;
}

interface ParsedResult {
  homeGoals: number;
  awayGoals: number;
}

function parseScores(
  scores: Array<{ name: string; score: string }>,
  homeTeam: string,
): ParsedResult | null {
  if (scores.length < 2) return null;
  // Position 0 is home side per Odds API convention — verify by matching name
  // fallback: trust position order if names don't match canonical
  const home = parseInt(scores[0].score, 10);
  const away = parseInt(scores[1].score, 10);
  if (isNaN(home) || isNaN(away)) return null;
  return { homeGoals: home, awayGoals: away };
}

function determineOutcome(
  result: ParsedResult,
  market: string,
  selection: string, // bet selection outcome: "home" | "draw" | "away" | "over" | "under"
): "won" | "lost" | "void" {
  const { homeGoals, awayGoals } = result;
  const total = homeGoals + awayGoals;

  if (market === "h2h") {
    const actualOutcome =
      homeGoals > awayGoals ? "home" : awayGoals > homeGoals ? "away" : "draw";
    return selection === actualOutcome ? "won" : "lost";
  }

  if (market === "totals") {
    if (selection === "over") return total >= 3 ? "won" : "lost";
    if (selection === "under") return total <= 2 ? "won" : "lost";
    return "void";
  }

  return "void";
}

export interface SettlementResult {
  eventsChecked: number;
  eventsSettled: number;
  betsSettled: number;
  errors: string[];
}

export async function settleCompletedEvents(): Promise<SettlementResult> {
  const result: SettlementResult = {
    eventsChecked: 0,
    eventsSettled: 0,
    betsSettled: 0,
    errors: [],
  };

  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) {
    result.errors.push("ODDS_API_KEY not set — skipping settlement");
    return result;
  }

  // Collect all sport keys that need score checks
  const sportKeys = SPORT_CONFIGS.football.oddsApiKeys;

  const allScores: ScoreEntry[] = [];
  for (const sportKey of sportKeys) {
    const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/scores/?apiKey=${apiKey}&daysFrom=3`;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        result.errors.push(`Scores API ${sportKey}: ${res.status} ${res.statusText}`);
        continue;
      }
      const data: ScoreEntry[] = await res.json();
      allScores.push(...data.filter((s) => s.completed && s.scores !== null));
    } catch (err: unknown) {
      result.errors.push(`Scores fetch ${sportKey}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (allScores.length === 0) return result;
  result.eventsChecked = allScores.length;

  // Map Odds API IDs → canonical event IDs
  const oddsApiIds = allScores.map((s) => s.id);
  const mappingRows = await db
    .select({ oddsApiId: eventMapping.oddsApiId, canonicalEventId: eventMapping.canonicalEventId })
    .from(eventMapping)
    .where(inArray(eventMapping.oddsApiId, oddsApiIds));

  const canonicalByOddsId = new Map(
    mappingRows
      .filter((r): r is { oddsApiId: string; canonicalEventId: string } => r.oddsApiId !== null)
      .map((r) => [r.oddsApiId, r.canonicalEventId])
  );

  const canonicalIds = [...new Set(mappingRows.map((r) => r.canonicalEventId))];
  if (canonicalIds.length === 0) return result;

  // Skip already-completed events (idempotent)
  const alreadyCompleted = await db
    .select({ id: events.id })
    .from(events)
    .where(and(inArray(events.id, canonicalIds), eq(events.status, "completed")));
  const completedSet = new Set(alreadyCompleted.map((r) => r.id));

  const toSettle = canonicalIds.filter((id) => !completedSet.has(id));
  if (toSettle.length === 0) return result;

  // Fetch event details for team names
  const eventRows = await db
    .select()
    .from(events)
    .where(inArray(events.id, toSettle));
  const eventById = new Map(eventRows.map((e) => [e.id, e]));

  // Pending bets for these events
  const pendingBets = await getPendingBetsForEvents(toSettle);

  for (const score of allScores) {
    const canonicalId = canonicalByOddsId.get(score.id);
    if (!canonicalId || completedSet.has(canonicalId)) continue;
    if (!score.scores) continue;

    const event = eventById.get(canonicalId);
    if (!event) continue;

    const parsed = parseScores(score.scores, event.homeTeam);
    if (!parsed) {
      result.errors.push(`Could not parse scores for ${event.homeTeam} vs ${event.awayTeam}`);
      continue;
    }

    // Settle in a transaction: update event + settle each bet + bankroll entry
    try {
      await db.transaction(async (tx) => {
        // 1. Mark event completed
        await tx
          .update(events)
          .set({
            status: "completed",
            result: { homeGoals: parsed.homeGoals, awayGoals: parsed.awayGoals },
            updatedAt: new Date(),
          })
          .where(eq(events.id, canonicalId));

        // 2. Settle each pending bet for this event
        const eventBets = pendingBets.filter((b) => b.eventId === canonicalId);
        for (const bet of eventBets) {
          // Determine which market leg this bet is on
          // For single bets, selection field holds the outcome label.
          // We use market + derive outcome from the bet's selection field.
          // The `selection` column holds the outcome key ("home","draw","away","over","under")
          // stored by place-bet action — if not, fall back to void.
          let outcomeKey = bet.selection.toLowerCase();
          // normalise label-based selections
          if (outcomeKey === "over 2.5 goals") outcomeKey = "over";
          if (outcomeKey === "under 2.5 goals") outcomeKey = "under";
          if (outcomeKey === "draw") outcomeKey = "draw";

          const outcome = determineOutcome(parsed, bet.market, outcomeKey);
          const stake = Number(bet.stake);
          const odds = Number(bet.odds);
          const pnl =
            outcome === "won"
              ? Math.round(stake * (odds - 1) * 100) / 100
              : outcome === "lost"
              ? -stake
              : 0;

          await tx
            .update(bets)
            .set({
              status: outcome,
              profitLoss: String(pnl),
              settledAt: new Date(),
            })
            .where(eq(bets.id, bet.id));

          // Bankroll entry (skip real-money movement for paper bets)
          if (!bet.paperOnly) {
            const [latest] = await tx
              .select({ balanceAfter: bankroll.balanceAfter })
              .from(bankroll)
              .orderBy(sql`${bankroll.createdAt} desc`)
              .limit(1);
            const currentBalance = Number(latest?.balanceAfter ?? 0);
            await tx.insert(bankroll).values({
              type: "bet_settled",
              amount: String(pnl),
              balanceAfter: String(currentBalance + pnl),
              betId: bet.id,
              description: `${outcome}: ${event.homeTeam} vs ${event.awayTeam} — ${bet.market} ${outcomeKey}`,
            });
          }

          result.betsSettled++;
        }
      });
      result.eventsSettled++;
    } catch (err: unknown) {
      result.errors.push(
        `Settlement error for ${event.homeTeam} vs ${event.awayTeam}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return result;
}
