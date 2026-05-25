import { Ratelimit } from "@upstash/ratelimit";
import { apiBudget } from "@/lib/config/api-budget";
import { getRedis } from "./redis";

/**
 * Rate limiters per external API. Quotas come from `apiBudget` so a paid-tier
 * upgrade propagates to the runtime limiter without code changes.
 * Defaults: Odds API 500/mo ≈ 16/day, API-Football 100/day, CricketData
 * 1000/hr, FBref 10/min.
 */
export function getOddsApiLimiter() {
  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(apiBudget.oddsApi.dailyLimit, "1 d"),
    prefix: "ratelimit:odds-api",
  });
}

export function getApiFootballLimiter() {
  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(apiBudget.apiFootball.dailyLimit, "1 d"),
    prefix: "ratelimit:api-football",
  });
}

export function getCricketDataLimiter() {
  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(apiBudget.cricketData.hourlyLimit, "1 h"),
    prefix: "ratelimit:cricket-data",
  });
}

export function getFbrefLimiter() {
  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(apiBudget.fbref.perMinuteLimit, "1 m"),
    prefix: "ratelimit:fbref",
  });
}
