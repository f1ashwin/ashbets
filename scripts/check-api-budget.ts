/**
 * API budget sanity check.
 *
 * Run before a PR lands or before triggering Phase A cron routes in prod:
 *   $ npx tsx scripts/check-api-budget.ts
 *
 * Projects monthly upstream call volume from configured cadences and tiers.
 * Exits non-zero if any API is projected above 80 % of its tier, so the user
 * sees the overrun before Odds API starts 429-ing on a Saturday noon.
 *
 * Keep the cadence constants here in sync with `docs/api-budget.md` and
 * `vercel.json`. Drift between docs, code, and this script is the failure
 * mode we're defending against — if you change one, change all three.
 */

interface ApiBudget {
  name: string;
  monthlyLimit: number;
  projectedPerDay: number;
  description: string;
}

const ODDS_API_MONTHLY_LIMIT = Number(
  process.env.ODDS_API_MONTHLY_LIMIT ?? 500 // free tier
);

const budgets: ApiBudget[] = [
  {
    name: "The Odds API",
    monthlyLimit: ODDS_API_MONTHLY_LIMIT,
    // fixtures cron every 2d × 2 sports = 1/day avg
    // odds cron every 4h × 2 sports = 12/day
    // settlement / closing line captures ≈ 1/day
    projectedPerDay: 1 + 12 + 1,
    description: "fixtures cron + odds cron + settlement",
  },
  {
    name: "API-Football",
    monthlyLimit: 100 * 30, // 100/day hard cap, ~3000/mo
    // 4 leagues × 1 fixtures call every 2d = 2/day
    // team stats cached 7d, ~10/week = 1.4/day
    // H2H only for high-liquidity events, ~0.7/day
    projectedPerDay: 2 + 1.4 + 0.7,
    description: "fixtures + team stats (7d cache) + H2H",
  },
  {
    name: "CricketData",
    monthlyLimit: 1000 * 24 * 30, // 1000/hr ceiling
    projectedPerDay: 4,
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
      "  Either tighten the cadence, upgrade the tier, or set the matching\n" +
      "  *_MONTHLY_LIMIT env var to reflect the paid tier you're on.\n" +
      "  See docs/api-budget.md for the full breakdown."
  );
  process.exit(1);
}

console.log("\n✓ All APIs within 80 % of configured tier.");
