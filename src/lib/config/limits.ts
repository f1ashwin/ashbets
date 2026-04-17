/**
 * Bet-sizing and cap configuration. All env-driven so an operator can tune
 * without a redeploy (for non-static values) and so tests can override.
 */

function numEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export const limits = {
  /** Max total stake per UTC day, currency units. */
  maxDailyStakeEur: numEnv("MAX_DAILY_STAKE_EUR", 10),
  /** Soft per-bet cap as fraction of bankroll. */
  softCap: numEnv("MAX_SINGLE_BET_PCT_SOFT", 0.02),
  /** Hard per-bet cap — never exceeded regardless of Kelly. */
  hardCap: numEnv("MAX_SINGLE_BET_PCT_HARD", 0.05),
  /** Correlation-safety discount applied to combo probabilities. */
  correlationDiscount: numEnv("CORRELATION_DISCOUNT", 0.07),
  /** True once the operator has personally run the backtest gate. Until then
   *  every placed bet is `paperOnly=true`. */
  backtestGatePassed: process.env.BACKTEST_GATE_PASSED === "true",
} as const;
