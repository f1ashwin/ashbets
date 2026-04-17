/**
 * Risk tier classifier.
 *
 * Buckets a value signal into one of three user-facing tiers:
 *   - high_confidence: low variance, lower payout — the "bankers"
 *   - balanced:       mid-variance, mid-payout
 *   - upside:         high variance, high payout — long-shots with real edge
 *
 * Thresholds are sport-specific because the 3-way football distribution caps
 * probability mass lower than the 2-way cricket distribution; a single
 * modelProb cutoff would over-populate one and starve the other.
 *
 * Derived on read. No column in the DB.
 */

import type { ValueBetSignal } from "./value-calculator";
import type { Sport } from "@/types/sports";

export type RiskTier = "high_confidence" | "balanced" | "upside" | "rejected";

interface SportThreshold {
  /** modelProb >= this → high_confidence. */
  highConf: number;
  /** modelProb >= this → balanced (if below highConf). */
  balanced: number;
  /** Upside requires edge >= this (higher than the baseline 2% because
   *  variance punishes small edges at long odds). */
  upsideEdge: number;
}

const DEFAULT_EDGE_FLOOR = 0.02;

export const TIER_THRESHOLDS: Record<Sport, SportThreshold> = {
  football: { highConf: 0.55, balanced: 0.35, upsideEdge: 0.04 },
  cricket: { highConf: 0.62, balanced: 0.45, upsideEdge: 0.05 },
};

export interface TierResult {
  tier: RiskTier;
  /** Short human-readable explanation for the reasoning drawer. */
  reason: string;
}

/**
 * Classify a signal. `rejected` means the dashboard should not render it at
 * any tier — either EV is negative or the edge is below the floor.
 */
export function tierOf(
  signal: Pick<ValueBetSignal, "modelProbability" | "edge" | "ev">,
  sport: Sport
): TierResult {
  const t = TIER_THRESHOLDS[sport];
  const { modelProbability, edge, ev } = signal;

  if (ev <= 0) {
    return { tier: "rejected", reason: "EV is non-positive" };
  }
  if (edge < DEFAULT_EDGE_FLOOR) {
    return { tier: "rejected", reason: `edge ${pct(edge)} below 2% floor` };
  }

  if (modelProbability >= t.highConf) {
    return {
      tier: "high_confidence",
      reason: `modelProb ${pct(modelProbability)} ≥ ${pct(t.highConf)} (${sport} high-conf floor), edge ${pct(edge)}`,
    };
  }

  if (modelProbability >= t.balanced) {
    return {
      tier: "balanced",
      reason: `modelProb ${pct(modelProbability)} in balanced band [${pct(t.balanced)}, ${pct(t.highConf)}), edge ${pct(edge)}`,
    };
  }

  if (edge >= t.upsideEdge) {
    return {
      tier: "upside",
      reason: `modelProb ${pct(modelProbability)} < ${pct(t.balanced)} but edge ${pct(edge)} ≥ ${pct(t.upsideEdge)} upside floor`,
    };
  }

  return {
    tier: "rejected",
    reason: `modelProb ${pct(modelProbability)} and edge ${pct(edge)} below upside threshold`,
  };
}

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}
