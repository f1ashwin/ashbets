import { cacheLife, cacheTag } from "next/cache";
import { and, eq, gte, lte, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { events } from "@/lib/db/schema";
import type { Sport } from "@/types/sports";

/**
 * Load upcoming events in the next N hours for a sport (or all sports).
 * Cached for the lifetime of the odds cron cycle; invalidated with the
 * 'events' tag.
 */
export async function getUpcomingEvents(opts: {
  sport?: Sport;
  hoursAhead?: number;
}) {
  "use cache";
  cacheLife("hours");
  cacheTag("events");
  if (opts.sport) cacheTag(`events:${opts.sport}`);

  const now = new Date();
  const hoursAhead = opts.hoursAhead ?? 48;
  const windowEnd = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

  const predicate = opts.sport
    ? and(
        eq(events.sport, opts.sport),
        gte(events.startTime, now),
        lte(events.startTime, windowEnd),
        eq(events.status, "upcoming")
      )
    : and(
        gte(events.startTime, now),
        lte(events.startTime, windowEnd),
        eq(events.status, "upcoming")
      );

  return db
    .select()
    .from(events)
    .where(predicate)
    .orderBy(asc(events.startTime));
}

export async function getEventById(id: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(`events:${id}`);

  const rows = await db.select().from(events).where(eq(events.id, id)).limit(1);
  return rows[0] ?? null;
}
