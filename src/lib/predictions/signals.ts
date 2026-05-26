/**
 * Signal hydration — the bridge between DB rows and what the dashboard UI
 * renders. For today's upcoming events, this produces one best-value signal
 * per (event, outcome) and classifies it into a risk tier.
 *
 * The result is fed to:
 *   - tier columns on the overview,
 *   - the combo ladder builder,
 *   - the full predictions table.
 */

import type { Sport } from "@/types/sports";
import { evaluateValue, type ValueBetSignal } from "./value-calculator";
import { tierOf, type RiskTier } from "./risk-tier";
import { freshnessOf, type FreshnessInfo } from "./staleness";
import { getPredictionsForToday } from "@/lib/db/queries/predictions";
import { getLatestOddsForEvents, type BestOddsRow } from "@/lib/db/queries/odds";

export interface RenderedSignal {
  predictionId: string;
  eventId: string;
  eventLabel: string; // "Man City vs Arsenal"
  sport: Sport;
  league: string | null;
  startTime: Date;
  signal: ValueBetSignal;
  tier: RiskTier;
  tierReason: string;
  freshness: FreshnessInfo;
  oddsRecordedAt: Date;
}

/**
 * For each upcoming event, pick the best (highest edge) value signal across
 * all books and outcomes, tier-classify it, and attach freshness. Signals
 * with tier=rejected are dropped.
 */
export async function getRenderedSignals(sport?: Sport): Promise<RenderedSignal[]> {
  const preds = await getPredictionsForToday(sport);
  if (preds.length === 0) return [];

  const eventIds = preds.map((p) => p.eventId);
  const oddsRows = await getLatestOddsForEvents(eventIds);

  // Group odds by event for quick lookup.
  const oddsByEvent = new Map<string, BestOddsRow[]>();
  for (const o of oddsRows) {
    const list = oddsByEvent.get(o.eventId) ?? [];
    list.push(o);
    oddsByEvent.set(o.eventId, list);
  }

  const out: RenderedSignal[] = [];
  for (const p of preds) {
    const eventOdds = oddsByEvent.get(p.eventId) ?? [];
    if (eventOdds.length === 0) continue;

    // Build companion odds map for vig stripping: "bookmaker:market" → { outcome → odds }
    const companionMap: Record<string, Record<string, number>> = {};
    for (const o of eventOdds) {
      const k = `${o.bookmaker}:${o.market}`;
      if (!companionMap[k]) companionMap[k] = {};
      companionMap[k][o.outcome] = o.odds;
    }

    // Build one signal per (outcome, book) and keep the highest-edge entry.
    let best: { signal: ValueBetSignal; recordedAt: Date } | null = null;
    for (const [outcome, modelProb] of Object.entries(p.probabilities)) {
      for (const o of eventOdds) {
        if (o.outcome !== outcome) continue;
        const companionOdds = Object.values(companionMap[`${o.bookmaker}:${o.market}`] ?? {});
        const s = evaluateValue(modelProb, o.odds, o.bookmaker, outcome, companionOdds);
        if (!s.isValue) continue;
        if (!best || s.edge > best.signal.edge) {
          best = { signal: s, recordedAt: o.recordedAt };
        }
      }
    }
    if (!best) continue;

    const classification = tierOf(best.signal, p.event.sport);
    if (classification.tier === "rejected") continue;

    out.push({
      predictionId: p.predictionId,
      eventId: p.eventId,
      eventLabel: `${p.event.homeTeam} vs ${p.event.awayTeam}`,
      sport: p.event.sport,
      league: p.event.league,
      startTime: p.event.startTime,
      signal: best.signal,
      tier: classification.tier,
      tierReason: classification.reason,
      freshness: freshnessOf(best.recordedAt),
      oddsRecordedAt: best.recordedAt,
    });
  }

  // Sort by edge descending. Tier columns slice further.
  return out.sort((a, b) => b.signal.edge - a.signal.edge);
}
