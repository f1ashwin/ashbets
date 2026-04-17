/**
 * Odds-freshness derivation.
 *
 * Contract with the ingest side: odds cron runs every 4h. "fresh" = within
 * that window; "stale" = late-arriving ingest or a weekend. >12h means the
 * data is too old to bet on honestly — CLV measurement against a closing
 * line derived from that snapshot will be garbage.
 */

export type Freshness = "fresh" | "stale" | "expired";

export interface FreshnessInfo {
  freshness: Freshness;
  ageMs: number;
  /** True if the Place button should be disabled. */
  blockPlacement: boolean;
}

const FRESH_LIMIT_MS = 4 * 60 * 60 * 1000; // 4h
const STALE_LIMIT_MS = 12 * 60 * 60 * 1000; // 12h

export function freshnessOf(recordedAt: Date | string | number, now: Date = new Date()): FreshnessInfo {
  const recorded = typeof recordedAt === "string" || typeof recordedAt === "number"
    ? new Date(recordedAt)
    : recordedAt;
  const ageMs = Math.max(0, now.getTime() - recorded.getTime());

  if (ageMs <= FRESH_LIMIT_MS) {
    return { freshness: "fresh", ageMs, blockPlacement: false };
  }
  if (ageMs <= STALE_LIMIT_MS) {
    return { freshness: "stale", ageMs, blockPlacement: false };
  }
  return { freshness: "expired", ageMs, blockPlacement: true };
}
