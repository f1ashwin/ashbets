/**
 * Parlay (combo) recommender.
 *
 * Builds three canonical ladder suggestions per day — Safe, Balanced,
 * Moonshot — from the pool of today's tier-classified value signals.
 *
 * Hard constraints:
 *   - No two legs from the same event (obvious direct correlation).
 *   - Every leg must be a value signal with tier != "rejected".
 *   - Combined EV must remain > 0 after a correlation-safety discount
 *     (default 7%) to cover residual dependence across same-league slates.
 *
 * We intentionally don't persist these. Recommendations are ephemeral — once
 * the user acts on one, `place-bet` writes `bets` + `bet_legs` rows. If the
 * user ignores one, it disappears on the next ingest cycle.
 */

import type { ValueBetSignal } from "./value-calculator";
import type { RiskTier } from "./risk-tier";

/** A value signal tagged with the canonical event it belongs to, the sport,
 *  and its classified tier. The dashboard page hydrates these before calling
 *  buildLadders. */
export interface ComboCandidate {
  eventId: string;
  sport: "football" | "cricket";
  tier: RiskTier;
  signal: ValueBetSignal;
  /** Display hints only — pass-through so the UI can render leg headers
   *  without re-joining tables. */
  label: string; // e.g. "Man City beat Arsenal"
  eventTime: Date;
}

export interface ComboLeg {
  eventId: string;
  label: string;
  outcome: string;
  bookmaker: string;
  odds: number;
  modelProbability: number;
  tier: RiskTier;
  sport: "football" | "cricket";
  eventTime: Date;
}

export interface ComboRecommendation {
  kind: "safe" | "balanced" | "moonshot";
  legs: ComboLeg[];
  combinedOdds: number;
  combinedProbability: number; // already discounted for correlation
  combinedEV: number;
  /** Half-Kelly of the discounted combined prob, capped at the combo-tier
   *  fraction (1% for 2-leg, 0.5% for 3-leg). Expressed as bankroll fraction. */
  kellyFraction: number;
}

export interface BuildLaddersOptions {
  correlationDiscount?: number; // default 0.07
  maxCandidatesPerTier?: number; // default 8
}

const DEFAULT_DISCOUNT = 0.07;
const DEFAULT_POOL = 8;

export function buildLadders(
  candidates: ComboCandidate[],
  opts: BuildLaddersOptions = {}
): { safe: ComboRecommendation | null; balanced: ComboRecommendation | null; moonshot: ComboRecommendation | null } {
  const discount = opts.correlationDiscount ?? DEFAULT_DISCOUNT;
  const pool = opts.maxCandidatesPerTier ?? DEFAULT_POOL;

  const byTier = partitionByTier(candidates, pool);

  return {
    safe: pickBestCombo(byTier.high_confidence, 2, "safe", discount),
    balanced: pickBalancedLadder(byTier, discount),
    moonshot: pickBestCombo(byTier.upside, 2, "moonshot", discount),
  };
}

function partitionByTier(cs: ComboCandidate[], pool: number) {
  const high_confidence: ComboCandidate[] = [];
  const balanced: ComboCandidate[] = [];
  const upside: ComboCandidate[] = [];

  for (const c of cs) {
    if (c.tier === "high_confidence") high_confidence.push(c);
    else if (c.tier === "balanced") balanced.push(c);
    else if (c.tier === "upside") upside.push(c);
  }

  const byEdge = (a: ComboCandidate, b: ComboCandidate) => b.signal.edge - a.signal.edge;
  return {
    high_confidence: high_confidence.sort(byEdge).slice(0, pool),
    balanced: balanced.sort(byEdge).slice(0, pool),
    upside: upside.sort(byEdge).slice(0, pool),
  };
}

/**
 * Enumerate N-length combinations of a single tier pool and keep the one
 * with the highest discounted combined EV that stays positive.
 */
function pickBestCombo(
  pool: ComboCandidate[],
  legs: number,
  kind: ComboRecommendation["kind"],
  discount: number
): ComboRecommendation | null {
  if (pool.length < legs) return null;

  let best: ComboRecommendation | null = null;
  const combos = kCombinations(pool, legs);
  for (const combo of combos) {
    if (!allDistinctEvents(combo)) continue;
    const rec = makeRecommendation(combo, kind, discount);
    if (!rec) continue;
    if (!best || rec.combinedEV > best.combinedEV) best = rec;
  }
  return best;
}

/** Balanced: 1 high-conf anchor + 2 balanced legs. */
function pickBalancedLadder(
  byTier: ReturnType<typeof partitionByTier>,
  discount: number
): ComboRecommendation | null {
  if (byTier.high_confidence.length < 1 || byTier.balanced.length < 2) return null;

  let best: ComboRecommendation | null = null;

  for (const anchor of byTier.high_confidence) {
    const pairs = kCombinations(byTier.balanced, 2);
    for (const pair of pairs) {
      const combo = [anchor, ...pair];
      if (!allDistinctEvents(combo)) continue;
      const rec = makeRecommendation(combo, "balanced", discount);
      if (!rec) continue;
      if (!best || rec.combinedEV > best.combinedEV) best = rec;
    }
  }
  return best;
}

function allDistinctEvents(combo: ComboCandidate[]): boolean {
  const seen = new Set<string>();
  for (const c of combo) {
    if (seen.has(c.eventId)) return false;
    seen.add(c.eventId);
  }
  return true;
}

function makeRecommendation(
  combo: ComboCandidate[],
  kind: ComboRecommendation["kind"],
  discount: number
): ComboRecommendation | null {
  const combinedOdds = combo.reduce((acc, c) => acc * c.signal.odds, 1);
  const rawProb = combo.reduce((acc, c) => acc * c.signal.modelProbability, 1);
  const combinedProbability = rawProb * (1 - discount);
  const combinedEV = combinedProbability * combinedOdds - 1;
  if (combinedEV <= 0) return null;

  const legs: ComboLeg[] = combo.map((c) => ({
    eventId: c.eventId,
    label: c.label,
    outcome: c.signal.outcome,
    bookmaker: c.signal.bookmaker,
    odds: c.signal.odds,
    modelProbability: c.signal.modelProbability,
    tier: c.tier,
    sport: c.sport,
    eventTime: c.eventTime,
  }));

  // Half-Kelly on the discounted combined prob, then cap tighter than singles.
  const fullKelly = combinedEV / (combinedOdds - 1);
  const halfKelly = Math.max(0, fullKelly * 0.5);
  const comboCap = combo.length === 2 ? 0.01 : 0.005;
  const kellyFraction = Math.min(halfKelly, comboCap);

  return { kind, legs, combinedOdds, combinedProbability, combinedEV, kellyFraction };
}

/** Enumerate all k-length combinations of `arr` (order-independent). */
function kCombinations<T>(arr: T[], k: number): T[][] {
  const out: T[][] = [];
  const recur = (start: number, combo: T[]) => {
    if (combo.length === k) {
      out.push(combo.slice());
      return;
    }
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      recur(i + 1, combo);
      combo.pop();
    }
  };
  recur(0, []);
  return out;
}
