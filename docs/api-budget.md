# External API Budget & Cadence

This doc explains *why* the budget is what it is. The live numbers live in
`src/lib/config/api-cadence.ts` (cadences + sport-key counts) and
`src/lib/config/api-budget.ts` (tier limits), and `scripts/check-api-budget.ts`
asserts them against each other. If you change a cron schedule, add an Odds
API sport key, or edit a cadence constant, run the checker — don't re-read
this doc.

## Why it matters

Two of the three APIs we depend on have painfully small free tiers. A careless
`setInterval(15_000)` inside a component would blow through a monthly quota in
under a day. On the Odds API especially, we want every call to land on a real
fixture window — ingesting Saturday-noon odds Wednesday night is wasted quota.

## Per-API budget (current config)

The numbers below come directly from the formulas in `api-cadence.ts` applied
to the current `SPORT_CONFIGS`:

| API | Free limit | Planned use | Projected daily | Projected monthly |
|---|---|---|---|---|
| **The Odds API** | 500 req/mo | `oddsCron.perDay × sportKeyCount + fixturesCron.perDay × sportKeyCount + settlement` — with **6 football sport keys** and **0 cricket** keys, 4h odds cron, 2d fixtures cron: `6×6 + 6×0.5 + 1 = 40/day` | ~40/day | ~1200/mo — **over free**, needs €30/mo Start plan (20k) |
| **API-Football** | 100 req/day | `4 leagues × fixtures / 2d + ~10 stats lookups/week + ~5 H2H/week` | ~4.1/day | ~124/mo — **under free** |
| **CricketData** | 1000 req/hr | matches + series + team form lookups on daily refresh | ~4/day | ~120/mo — **under free** |
| **FBref scrape** | Self-imposed 10 req/min | Not used in v1 | 0 | 0 |

Rate-limiter settings in `src/lib/cache/rate-limiter.ts` derive from the same
`api-budget.ts` module. Any code path that calls an upstream must go through
`cachedFetch()` in `src/lib/cache/redis.ts` so the limiter is never bypassed.

## The Odds API — the one we need to pay for

Free tier is 500/mo. With 6 football league keys at a 4h odds cadence we land
at ~1200/mo baseline. Add overhead for manual refreshes, retries, and
on-demand dashboard buttons → 1500-1800/mo in practice.

**Decision: upgrade to Odds API "Start" plan at €30/mo (20k req/mo) before
Phase A goes live.** The Hobby free tier does not support the planned cadence
even after tightening. Budget the €30 explicitly in bankroll tracking —
subtract from realised profits before computing ROI. At projected €5-€30/mo
profit (per the conversation on realistic ROI), the API cost can dominate net
P&L for the first 6-12 months. This is a fact, not a reason to skip.

**Fallback if €30/mo is not acceptable:** drop the odds cron cadence from
every 4h to **every 12h** (2 runs/day × 6 keys = 12/day = 360/mo) *and* drop
to the 2 highest-liquidity football leagues (EPL + UCL). That brings us to
~150/mo, under free tier. Accept that closing-line capture will be coarser
(worse CLV measurement), line-shopping between refresh windows is impossible,
and the breadth of value-bet candidates shrinks dramatically. This degrades
model quality meaningfully and I do not recommend it.

**Cricket on the Odds API:** `SPORT_CONFIGS.cricket.oddsApiKeys` is currently
empty. Cricket odds for v1 come from CricketData only. The Odds API does
publish `cricket_ipl`, `cricket_odi`, and `cricket_test_match` — adding them
would re-scale the projected monthly number (6+3=9 keys → ~1800/mo) and is a
Phase A decision. If you add them, re-run the checker.

## API-Football — stay on free tier with care

100/day is tight but workable if we:

1. Cache `fetchTeamStats` per-team per-season in `teamStatsCache` for 7 days.
2. Only call `fetchH2H` for events where Odds API returned ≥ 3 bookmakers
   (proxy: "this fixture has enough liquidity to be worth a value bet").
3. Never call `fetchFixtures` outside the fixtures cron — pages always read
   from Postgres.

A single 08:00 UTC refresh for 4 leagues should use ≤ 20 calls. Plenty of
headroom for bursts.

## CricketData — no constraint

1000/hr ceiling is 3+ orders of magnitude above our needs. Treat as unlimited
for v1. Still route through the rate limiter as defence against runaway code.

## Self-imposed guard rails

- No UI code calls an upstream. Pages read from Postgres only.
- No upstream call outside a cron handler, a seed script, or a manually
  triggered endpoint guarded by `CRON_SECRET`.
- `scripts/check-api-budget.ts` (run via `npm run check:budget`) projects
  monthly call volume from `api-cadence.ts` + `api-budget.ts` and fails if
  the projection exceeds 80 % of the configured tier.
- When a new caller is added, edit `api-cadence.ts` (not this doc) and re-run
  the checker.

## Cadence summary (what the cron scheduler does)

```
vercel.json (target)

fixtures-refresh   0 8 */2 * *     # 08:00 UTC every 2 days
odds-refresh       0 */4 * * *     # every 4 hours
settle             15 * * * *      # every hour at :15 (cheap DB work)
```

On Vercel Hobby tier there's a limit of 2 cron jobs. If we stay on Hobby we
need to fold settlement into the odds-refresh handler. Upgrading to Pro is
only worth it once real-money placement starts.
