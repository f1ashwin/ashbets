/**
 * API budget sanity check.
 *
 * Run before a PR lands or before triggering Phase A cron routes in prod:
 *   $ npx tsx scripts/check-api-budget.ts
 *
 * Projects monthly upstream call volume and exits non-zero if any API is
 * projected above 80 % of its tier. Tier limits come from
 * `src/lib/config/api-budget.ts` and cadences from
 * `src/lib/config/api-cadence.ts` — both modules are the single source of
 * truth, imported by the runtime rate limiter too, so a paid-tier env var
 * or a new sport key added to SPORT_CONFIGS propagates to all three.
 */

import { apiBudget } from "@/lib/config/api-budget";
import {
  apiCadence,
  apiFootballPerDay,
  oddsApiPerDay,
} from "@/lib/config/api-cadence";

interface ApiBudgetRow {
  name: string;
  monthlyLimit: number;
  projectedPerDay: number;
  description: string;
}

const oddsApiProjection = oddsApiPerDay(apiCadence.oddsApi);
const apiFootballProjection = apiFootballPerDay(apiCadence.apiFootball);

const budgets: ApiBudgetRow[] = [
  {
    name: "The Odds API",
    monthlyLimit: apiBudget.oddsApi.monthlyLimit,
    projectedPerDay: oddsApiProjection,
    description:
      `${apiCadence.oddsApi.sportKeyCount} sport keys × odds cron (every ` +
      `${24 / apiCadence.oddsApi.oddsCron.perDay}h) + fixtures cron + settlement`,
  },
  {
    name: "API-Football",
    monthlyLimit: apiBudget.apiFootball.monthlyLimit,
    projectedPerDay: apiFootballProjection,
    description: "fixtures + team stats (7d cache) + H2H",
  },
  {
    name: "CricketData",
    monthlyLimit: apiBudget.cricketData.monthlyLimit,
    projectedPerDay: apiCadence.cricketData.perDay,
    description: "matches + series + team form lookups",
  },
];

const THRESHOLD = 0.8;
let hasOverrun = false;

console.log("API budget projection vs configured tier:\n");

for (const b of budgets) {
  const projectedMonthly = Math.ceil(b.projectedPerDay * 30);
  const utilisation = projectedMonthly / b.monthlyLimit;
  const bar = "█".repeat(Math.min(20, Math.round(utilisation * 20)));
  const status =
    utilisation >= 1 ? "OVER" : utilisation >= THRESHOLD ? "WARN" : "ok";
  console.log(
    `  ${b.name.padEnd(16)} ${bar.padEnd(20)}  ` +
      `${projectedMonthly} / ${b.monthlyLimit} (${(utilisation * 100).toFixed(0)}%) [${status}]`
  );
  console.log(`      ${b.description}`);
  if (utilisation >= THRESHOLD) hasOverrun = true;
}

if (hasOverrun) {
  console.error(
    "\n✗ At least one API is projected above 80 % of its tier.\n" +
      "  Either tighten the cadence, drop a sport key from SPORT_CONFIGS,\n" +
      "  upgrade the tier, or set the matching *_MONTHLY_LIMIT env var to\n" +
      "  reflect the paid tier you're on. See docs/api-budget.md."
  );
  process.exit(1);
}

console.log("\n✓ All APIs within 80 % of configured tier.");
