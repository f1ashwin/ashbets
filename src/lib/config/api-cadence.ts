/**
 * Call-cadence truth for every upstream we ingest from.
 *
 * `scripts/check-api-budget.ts` imports this module and compares the
 * projection against the tier limits in `api-budget.ts`. `docs/api-budget.md`
 * documents the *conclusions* — run the checker to see the live numbers
 * rather than trusting the doc's summary, which can drift.
 *
 * Numbers for the Odds API scale with the number of sport keys we subscribe
 * to, which we read straight out of `SPORT_CONFIGS` so a new league added
 * there is automatically reflected in the budget projection (and fails the
 * checker if it pushes us over tier).
 */

import { SPORT_CONFIGS } from "@/types/sports";

const ODDS_CRON_EVERY_HOURS = 4; // must agree with vercel.json `odds-refresh`
const FIXTURES_CRON_EVERY_DAYS = 2; // must agree with vercel.json `fixtures-refresh`
const SETTLEMENT_PER_DAY = 1; // closing-line captures per settle cron

const oddsApiSportKeyCount =
  SPORT_CONFIGS.football.oddsApiKeys.length +
  SPORT_CONFIGS.cricket.oddsApiKeys.length;

export const apiCadence = {
  oddsApi: {
    /** One Odds API request per sport key per cycle — there is no multi-key
     *  batching endpoint, so total calls = cycles × keys. */
    sportKeyCount: oddsApiSportKeyCount,
    oddsCron: {
      perDay: 24 / ODDS_CRON_EVERY_HOURS,
    },
    fixturesCron: {
      perDay: 1 / FIXTURES_CRON_EVERY_DAYS,
    },
    settlementPerDay: SETTLEMENT_PER_DAY,
  },
  apiFootball: {
    /** Fixtures: 4 leagues × 1 call every 2d ≈ 2/day */
    fixturesPerDay: (4 * 1) / FIXTURES_CRON_EVERY_DAYS,
    /** 7d-cached stats, ~10 lookups/week */
    teamStatsPerDay: 10 / 7,
    /** H2H only for high-liquidity events, ~5/week */
    h2hPerDay: 5 / 7,
  },
  cricketData: {
    /** Matches + series + team form lookups per refresh, one refresh/day. */
    perDay: 4,
  },
} as const;

export function oddsApiPerDay(c: typeof apiCadence.oddsApi): number {
  return (
    c.oddsCron.perDay * c.sportKeyCount +
    c.fixturesCron.perDay * c.sportKeyCount +
    c.settlementPerDay
  );
}

export function apiFootballPerDay(c: typeof apiCadence.apiFootball): number {
  return c.fixturesPerDay + c.teamStatsPerDay + c.h2hPerDay;
}
