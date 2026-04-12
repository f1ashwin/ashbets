import { Redis } from "@upstash/redis";

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return redis;
}

/**
 * Fetch data from cache, or call the fetcher on miss and cache the result.
 */
export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number
): Promise<T> {
  const r = getRedis();
  const cached = await r.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  const data = await fetcher();
  await r.set(key, data, { ex: ttlSeconds });
  return data;
}

/** Cache TTLs in seconds */
export const CACHE_TTL = {
  odds: 300, // 5 minutes
  events: 900, // 15 minutes
  stats: 3600, // 1 hour
  standings: 21600, // 6 hours
} as const;
