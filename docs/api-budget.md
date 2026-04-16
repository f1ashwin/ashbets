# External API Budget & Cadence

This doc is the authoritative source for how often we may call each upstream.
If you change a cron schedule, a page-level fetch, or an ingest loop, update
this doc **in the same commit**. `scripts/check-api-budget.ts` asserts reality
against this table and fails CI on regressions.

## Why it matters

Two of the three APIs we depend on have painfully small free tiers. A careless
`setInterval(15_000)` inside a component would blow through a monthly quota in
under a day. On the Odds API especially, we want every call to land on a real
fixture window — ingesting Saturday-noon odds Wednesday night is wasted quota.

## Per-API budget (free tier baseline)

| API | Free limit | Planned use | Projected daily | Projected monthly |
|---|---|---|---|---|
| **The Odds API** | 500 req/mo (~16/day) | Fixtures cron every 2d (2 calls) + odds cron every **4h** (12 calls/day for 2 sports = 24/day) | Fixtures: 1/day avg; Odds: 24/day | ~750/mo — **over free**, needs €30/mo Start plan (20k) |
| **API-Football** | 100 req/day | Fixtures call every 2d × 4 football leagues = 4 calls; `fetchTeamStats` cached 7d, ~10 lookups/week = 1.4/day avg; `fetchH2H` only if event has ≥3 bookmakers, budget 5/week = 0.7/day | ~8/day | ~240/mo — **under free** |
| **CricketData** | 1000 req/hr | Fixtures every 2d (1 matches + 1 series = 2) + team form 5 lookups/refresh = 7/refresh | ~4/day | ~120/mo — **under free** |
| **FBref scrape** | Self-imposed 10 req/min | Not used in v1 | 0 | 0 |

Rate-limiter settings in `src/lib/cache/rate-limiter.ts` enforce these. Any
code path that calls an upstream must go through `cachedFetch()` in
`src/lib/cache/redis.ts` so the limiter is never bypassed.

## The Odds API — the one we need to pay for

Free tier is 500/mo. Minimum useful cadence for v1:

- 2 ingest sports × 1 call = 2 per fixtures cron × every 2 days = 30/mo
- 2 sports × 1 call = 2 per odds cron × every 4 hours = 360/mo
- Settlement / closing odds capture on cron: ~30 events/mo × 1 call = 30/mo

Baseline: ~420/mo. Add overhead for manual refreshes, retries, and on-demand
dashboard buttons → realistically 600-700/mo.

**Decision: upgrade to Odds API "Start" plan at €30/mo (20k req/mo) before
Phase A goes live.** The Hobby free tier does not support the planned cadence
even after tightening. Budget the €30 explicitly in bankroll tracking —
subtract from realised profits before computing ROI. At projected €5-€30/mo
profit (per the conversation on realistic ROI), the API cost can dominate net
P&L for the first 6-12 months. This is a fact, not a reason to skip.

**Fallback if €30/mo is not acceptable:** drop the odds cron cadence from
every 4h to **every 12h** (2 calls × 2 sports × 2/day = 8/day = 240/mo). Accept
that closing-line capture will be coarser (worse CLV measurement) and
line-shopping between refresh windows is impossible. This degrades model
quality meaningfully and I do not recommend it.

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
- `scripts/check-api-budget.ts` projects monthly call volume from the current
  cron config + planned cadences and fails if the projection exceeds 80% of
  the configured tier.
- When a new caller is added, update this table and re-run the checker.

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
