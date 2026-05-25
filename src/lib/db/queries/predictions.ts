import { cacheLife, cacheTag } from "next/cache";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { events, predictions } from "@/lib/db/schema";
import type { Sport } from "@/types/sports";

export interface HydratedPrediction {
  predictionId: string;
  eventId: string;
  model: string;
  modelVersion: string | null;
  probabilities: Record<string, number>;
  bestValue: Record<string, unknown> | null;
  pinnacleEdge: number | null;
  createdAt: Date;
  event: {
    id: string;
    sport: Sport;
    league: string | null;
    homeTeam: string;
    awayTeam: string;
    startTime: Date;
    status: string;
  };
}

/**
 * Latest prediction per event for today's upcoming matches. If the same
 * event has multiple prediction rows (e.g. from different models), we keep
 * the newest.
 */
export async function getPredictionsForToday(sport?: Sport): Promise<HydratedPrediction[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("predictions");
  if (sport) cacheTag(`predictions:${sport}`);

  const now = new Date();
  const windowEnd = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  const eventRows = sport
    ? await db.select().from(events).where(eq(events.sport, sport))
    : await db.select().from(events);

  const upcoming = eventRows.filter(
    (e) => e.startTime >= now && e.startTime <= windowEnd && e.status === "upcoming"
  );
  const upcomingIds = upcoming.map((e) => e.id);
  if (upcomingIds.length === 0) return [];

  const predRows = await db
    .select()
    .from(predictions)
    .where(inArray(predictions.eventId, upcomingIds))
    .orderBy(desc(predictions.createdAt));

  const byEvent = new Map<string, (typeof predRows)[number]>();
  for (const p of predRows) {
    if (!byEvent.has(p.eventId)) byEvent.set(p.eventId, p);
  }

  const eventsById = new Map(upcoming.map((e) => [e.id, e]));
  const out: HydratedPrediction[] = [];
  for (const [eventId, p] of byEvent) {
    const ev = eventsById.get(eventId);
    if (!ev) continue;
    out.push({
      predictionId: p.id,
      eventId: p.eventId,
      model: p.model,
      modelVersion: p.modelVersion,
      probabilities: p.probabilities as Record<string, number>,
      bestValue: (p.bestValue as Record<string, unknown> | null) ?? null,
      pinnacleEdge: p.pinnacleEdge !== null ? Number(p.pinnacleEdge) : null,
      createdAt: p.createdAt,
      event: {
        id: ev.id,
        sport: ev.sport as Sport,
        league: ev.league,
        homeTeam: ev.homeTeam,
        awayTeam: ev.awayTeam,
        startTime: ev.startTime,
        status: ev.status,
      },
    });
  }
  return out.sort(
    (a, b) => a.event.startTime.getTime() - b.event.startTime.getTime()
  );
}
