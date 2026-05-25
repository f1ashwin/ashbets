import { db } from "@/lib/db";
import { predictions, oddsHistory, events } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { currentBalance } from "@/lib/db/queries/bankroll";
import { recommendedStake, evaluateValue } from "@/lib/predictions/value-calculator";
import { limits } from "@/lib/config/limits";

export interface MatchBet {
  market: "h2h" | "totals";
  selection: string;        // "home" | "draw" | "away" | "over" | "under"
  selectionLabel: string;   // e.g. "Argentina", "Over 2.5 Goals", "Draw"
  bookmaker: string;
  odds: number;
  edge: number;             // fraction, e.g. 0.045
  stake: number;            // currency
  modelProbability: number;
}

/**
 * Identify up to two value bets (1 in H2H and 1 in Totals Over/Under 2.5) for a World Cup match.
 * Filters out bets below the minimum edge threshold (default 2%) and caps stakes per bet at limits.maxDailyStakeEur / 4.
 */
export async function getTopTwoBets(eventId: string, dailyRemaining: number): Promise<MatchBet[]> {
  // 1. Fetch the latest Elo prediction for this event
  const predRows = await db
    .select()
    .from(predictions)
    .where(
      and(
        eq(predictions.eventId, eventId),
        eq(predictions.model, "elo"),
        eq(predictions.modelVersion, "wc2026-v1")
      )
    )
    .orderBy(desc(predictions.createdAt))
    .limit(1);

  if (predRows.length === 0) return [];
  const prediction = predRows[0];
  const probabilities = prediction.probabilities as Record<string, number>;

  // 2. Fetch event to resolve team names
  const eventRows = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  if (eventRows.length === 0) return [];
  const event = eventRows[0];

  // 3. Fetch latest odds from DB
  const oddsRows = await db
    .select()
    .from(oddsHistory)
    .where(eq(oddsHistory.eventId, eventId))
    .orderBy(desc(oddsHistory.recordedAt));

  // De-duplicate to get the most recent snapshot per (bookmaker, market, outcome)
  const seen = new Set<string>();
  const latestOdds: typeof oddsRows = [];
  for (const row of oddsRows) {
    const key = `${row.bookmaker}:${row.market}:${row.outcome}`;
    if (seen.has(key)) continue;
    seen.add(key);
    latestOdds.push(row);
  }

  // 4. Find the best value signal in the Match Result (h2h) market
  let bestH2h: any = null;
  for (const o of latestOdds) {
    if (o.market !== "h2h") continue;
    const modelProb = probabilities[o.outcome] ?? 0;
    const signal = evaluateValue(modelProb, Number(o.odds), o.bookmaker, o.outcome);
    if (signal.isValue) {
      if (!bestH2h || signal.edge > bestH2h.edge) {
        bestH2h = signal;
      }
    }
  }

  // 5. Find the best value signal in the Total Goals (totals) market (specifically Over/Under 2.5)
  let bestTotals: any = null;
  for (const o of latestOdds) {
    if (o.market !== "totals") continue;
    // We only care about point line = 2.5
    if (o.point && Number(o.point) !== 2.5) continue;
    
    const modelProb = o.outcome === "over" ? (probabilities.over25 ?? 0) : (probabilities.under25 ?? 0);
    const signal = evaluateValue(modelProb, Number(o.odds), o.bookmaker, o.outcome);
    if (signal.isValue) {
      if (!bestTotals || signal.edge > bestTotals.edge) {
        bestTotals = signal;
      }
    }
  }

  const bankroll = await currentBalance();
  const absoluteCap = limits.maxDailyStakeEur / 4; // €2.50 absolute cap per bet
  let currentDailyRemaining = dailyRemaining;

  const matchBets: MatchBet[] = [];

  // 6. Calculate sizing and build output for H2H recommended bet
  if (bestH2h) {
    const stakeResult = recommendedStake(bestH2h.kellyFraction, bankroll, {
      softCap: limits.softCap,
      hardCap: limits.hardCap,
      maxBetCurrency: Math.min(absoluteCap, currentDailyRemaining),
    });

    let selectionLabel = "";
    if (bestH2h.outcome === "home") selectionLabel = event.homeTeam;
    else if (bestH2h.outcome === "away") selectionLabel = event.awayTeam;
    else selectionLabel = "Draw";

    const stake = Math.round(stakeResult.stake * 100) / 100;
    
    // Only recommend if stake is > 0
    if (stake > 0) {
      matchBets.push({
        market: "h2h",
        selection: bestH2h.outcome,
        selectionLabel,
        bookmaker: bestH2h.bookmaker,
        odds: bestH2h.odds,
        edge: bestH2h.edge,
        stake,
        modelProbability: bestH2h.modelProbability,
      });
      currentDailyRemaining -= stake;
    }
  }

  // 7. Calculate sizing and build output for Totals recommended bet
  if (bestTotals) {
    const stakeResult = recommendedStake(bestTotals.kellyFraction, bankroll, {
      softCap: limits.softCap,
      hardCap: limits.hardCap,
      maxBetCurrency: Math.min(absoluteCap, currentDailyRemaining),
    });

    const selectionLabel = bestTotals.outcome === "over" ? "Over 2.5 Goals" : "Under 2.5 Goals";
    const stake = Math.round(stakeResult.stake * 100) / 100;

    if (stake > 0) {
      matchBets.push({
        market: "totals",
        selection: bestTotals.outcome,
        selectionLabel,
        bookmaker: bestTotals.bookmaker,
        odds: bestTotals.odds,
        edge: bestTotals.edge,
        stake,
        modelProbability: bestTotals.modelProbability,
      });
      currentDailyRemaining -= stake;
    }
  }

  return matchBets;
}
