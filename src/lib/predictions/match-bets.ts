import { db } from "@/lib/db";
import { predictions, oddsHistory, events } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { currentBalance } from "@/lib/db/queries/bankroll";
import { recommendedStake, evaluateValue } from "@/lib/predictions/value-calculator";
import { hasEloUncertainty } from "@/lib/predictions/elo-uncertainty";
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
  hasEloWarning: boolean;
}

type OddsRow = {
  bookmaker: string;
  market: string;
  outcome: string;
  odds: number | string;
  point: string | null;
};

/**
 * Pure function — no DB calls. Takes pre-fetched data and computes up to two
 * value bets (1 h2h + 1 totals). Used by the worldcup page batch path and the
 * per-event API route. Companion odds are grouped per bookmaker+market for
 * vig-stripped edge calculation.
 */
export function computeTopTwoBets(
  event: { id: string; homeTeam: string; awayTeam: string },
  probabilities: Record<string, number>,
  latestOdds: OddsRow[],
  bankroll: number,
  dailyRemaining: number,
): MatchBet[] {
  const eloWarning = hasEloUncertainty(event.homeTeam, event.awayTeam);
  const absoluteCap = limits.maxDailyStakeEur / 4;
  let currentDailyRemaining = dailyRemaining;

  // Group companion odds: { "bookmaker:market" → { outcome → odds } }
  const companionMap: Record<string, Record<string, number>> = {};
  for (const o of latestOdds) {
    const key = `${o.bookmaker}:${o.market}`;
    if (!companionMap[key]) companionMap[key] = {};
    companionMap[key][o.outcome] = Number(o.odds);
  }

  // --- H2H market ---
  let bestH2h: ReturnType<typeof evaluateValue> | null = null;
  for (const o of latestOdds) {
    if (o.market !== "h2h") continue;
    const modelProb = probabilities[o.outcome] ?? 0;
    const companionOdds = Object.values(companionMap[`${o.bookmaker}:h2h`] ?? {});
    const signal = evaluateValue(modelProb, Number(o.odds), o.bookmaker, o.outcome, companionOdds);
    if (signal.isValue && (!bestH2h || signal.edge > bestH2h.edge)) {
      bestH2h = signal;
    }
  }

  // --- Totals market (2.5 line only) ---
  let bestTotals: ReturnType<typeof evaluateValue> | null = null;
  for (const o of latestOdds) {
    if (o.market !== "totals") continue;
    if (o.point && Number(o.point) !== 2.5) continue;
    const modelProb = o.outcome === "over" ? (probabilities.over25 ?? 0) : (probabilities.under25 ?? 0);
    const companionOdds = Object.values(companionMap[`${o.bookmaker}:totals`] ?? {});
    const signal = evaluateValue(modelProb, Number(o.odds), o.bookmaker, o.outcome, companionOdds);
    if (signal.isValue && (!bestTotals || signal.edge > bestTotals.edge)) {
      bestTotals = signal;
    }
  }

  const matchBets: MatchBet[] = [];

  if (bestH2h) {
    const stakeResult = recommendedStake(bestH2h.kellyFraction, bankroll, {
      softCap: limits.softCap,
      hardCap: limits.hardCap,
      maxBetCurrency: Math.min(absoluteCap, currentDailyRemaining),
    });
    const stake = Math.round(stakeResult.stake * 100) / 100;
    let selectionLabel = "Draw";
    if (bestH2h.outcome === "home") selectionLabel = event.homeTeam;
    else if (bestH2h.outcome === "away") selectionLabel = event.awayTeam;
    matchBets.push({
      market: "h2h",
      selection: bestH2h.outcome,
      selectionLabel,
      bookmaker: bestH2h.bookmaker,
      odds: bestH2h.odds,
      edge: bestH2h.edge,
      stake,
      modelProbability: bestH2h.modelProbability,
      hasEloWarning: eloWarning,
    });
    currentDailyRemaining -= stake;
  }

  if (bestTotals) {
    const stakeResult = recommendedStake(bestTotals.kellyFraction, bankroll, {
      softCap: limits.softCap,
      hardCap: limits.hardCap,
      maxBetCurrency: Math.min(absoluteCap, currentDailyRemaining),
    });
    const stake = Math.round(stakeResult.stake * 100) / 100;
    matchBets.push({
      market: "totals",
      selection: bestTotals.outcome,
      selectionLabel: bestTotals.outcome === "over" ? "Over 2.5 Goals" : "Under 2.5 Goals",
      bookmaker: bestTotals.bookmaker,
      odds: bestTotals.odds,
      edge: bestTotals.edge,
      stake,
      modelProbability: bestTotals.modelProbability,
      hasEloWarning: eloWarning,
    });
  }

  return matchBets;
}

/**
 * Wrapper that fetches DB data and delegates to computeTopTwoBets.
 * Preserves the existing call signature so other callers are unchanged.
 */
export async function getTopTwoBets(eventId: string, dailyRemaining: number): Promise<MatchBet[]> {
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
  const probabilities = predRows[0].probabilities as Record<string, number>;

  const eventRows = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  if (eventRows.length === 0) return [];
  const event = eventRows[0];

  const oddsRows = await db
    .select()
    .from(oddsHistory)
    .where(eq(oddsHistory.eventId, eventId))
    .orderBy(desc(oddsHistory.recordedAt));

  const seen = new Set<string>();
  const latestOdds: OddsRow[] = [];
  for (const row of oddsRows) {
    const key = `${row.bookmaker}:${row.market}:${row.outcome}`;
    if (seen.has(key)) continue;
    seen.add(key);
    latestOdds.push({
      bookmaker: row.bookmaker,
      market: row.market,
      outcome: row.outcome,
      odds: row.odds,
      point: row.point ?? null,
    });
  }

  const bankroll = await currentBalance();
  return computeTopTwoBets(event, probabilities, latestOdds, bankroll, dailyRemaining);
}
