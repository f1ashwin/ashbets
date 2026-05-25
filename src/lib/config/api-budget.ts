/**
 * Single source of truth for API tier limits.
 *
 * Both the runtime rate limiter (`src/lib/cache/rate-limiter.ts`) and the
 * pre-deploy budget checker (`scripts/check-api-budget.ts`) read from this
 * file. Keep env var names here in sync with `docs/api-budget.md`.
 *
 * Why: operators raising their upstream tier used to update
 * `*_MONTHLY_LIMIT` env vars for the checker but the limiter stayed hard-coded
 * at free-tier caps, so production would silently self-throttle even after a
 * paid upgrade. Deriving both from the same config prevents that drift.
 *
 * Daily limits default to ⌊monthly / 30⌋ when an explicit daily override is
 * not set. The 16/day default for The Odds API matches 500/month free tier.
 */

function numEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const ODDS_API_MONTHLY = numEnv("ODDS_API_MONTHLY_LIMIT", 500);
const API_FOOTBALL_DAILY = numEnv("API_FOOTBALL_DAILY_LIMIT", 100);
const CRICKET_DATA_HOURLY = numEnv("CRICKET_DATA_HOURLY_LIMIT", 1000);
const FBREF_PER_MINUTE = numEnv("FBREF_PER_MINUTE_LIMIT", 10);

export const apiBudget = {
  oddsApi: {
    monthlyLimit: ODDS_API_MONTHLY,
    dailyLimit: numEnv("ODDS_API_DAILY_LIMIT", Math.floor(ODDS_API_MONTHLY / 30)),
  },
  apiFootball: {
    dailyLimit: API_FOOTBALL_DAILY,
    monthlyLimit: API_FOOTBALL_DAILY * 30,
  },
  cricketData: {
    hourlyLimit: CRICKET_DATA_HOURLY,
    monthlyLimit: CRICKET_DATA_HOURLY * 24 * 30,
  },
  fbref: {
    perMinuteLimit: FBREF_PER_MINUTE,
  },
} as const;
