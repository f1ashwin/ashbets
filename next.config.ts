import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  cacheLife: {
    /**
     * Odds readers: treat fresh for 4h (the ingest cadence), still OK-to-serve
     * for 12h (our stale SLA), and hard-expire at 24h. Cron runs after each
     * ingest and calls revalidateTag('odds', 'max') to force a refresh sooner.
     */
    odds4h: {
      stale: 900,
      revalidate: 14400,
      expire: 43200,
    },
  },
};

export default nextConfig;
