import { Ratelimit } from "@upstash/ratelimit";
import { getRedis } from "./redis";

/**
 * Rate limiters per external API.
 * The Odds API: 500 req/month ≈ 16/day. Be very conservative.
 * API-Football: 100 req/day on free tier.
 * CricketData: 100k req/hour (generous).
 * FBref scraping: 10 req/min.
 */
export function getOddsApiLimiter() {
  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(16, "1 d"),
    prefix: "ratelimit:odds-api",
  });
}

export function getApiFootballLimiter() {
  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(100, "1 d"),
    prefix: "ratelimit:api-football",
  });
}

export function getCricketDataLimiter() {
  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(1000, "1 h"),
    prefix: "ratelimit:cricket-data",
  });
}

export function getFbrefLimiter() {
  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(10, "1 m"),
    prefix: "ratelimit:fbref",
  });
}
