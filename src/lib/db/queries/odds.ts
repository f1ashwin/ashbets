import { cacheLife, cacheTag } from "next/cache";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { oddsHistory } from "@/lib/db/schema";

export interface BestOddsRow {
  eventId: string;
  bookmaker: string;
  market: string;
  outcome: string;
  odds: number;
  point: string | null;
  recordedAt: Date;
}

/**
 * Latest snapshot per (eventId, bookmaker, market, outcome) across a set of
 * events. Returns the most recent row per bucket. Uses the 'odds4h' cache
 * profile (4h revalidate, 12h hard expire).
 */
export async function getLatestOddsForEvents(eventIds: string[]): Promise<BestOddsRow[]> {
  "use cache";
  cacheLife("odds4h");
  cacheTag("odds");
  for (const id of eventIds) cacheTag(`odds:${id}`);

  if (eventIds.length === 0) return [];

  const rows = await db
    .select({
      eventId: oddsHistory.eventId,
      bookmaker: oddsHistory.bookmaker,
      market: oddsHistory.market,
      outcome: oddsHistory.outcome,
      odds: oddsHistory.odds,
      point: oddsHistory.point,
      recordedAt: oddsHistory.recordedAt,
    })
    .from(oddsHistory)
    .where(inArray(oddsHistory.eventId, eventIds))
    .orderBy(desc(oddsHistory.recordedAt));

  const seen = new Set<string>();
  const latest: BestOddsRow[] = [];
  for (const row of rows) {
    const key = `${row.eventId}:${row.bookmaker}:${row.market}:${row.outcome}`;
    if (seen.has(key)) continue;
    seen.add(key);
    latest.push({ ...row, odds: Number(row.odds), point: row.point ?? null });
  }
  return latest;
}

/** Full latest board for a single event across every book and outcome. */
export async function getBookmakerGrid(eventId: string) {
  "use cache";
  cacheLife("odds4h");
  cacheTag(`odds:${eventId}`);

  const rows = await db
    .select()
    .from(oddsHistory)
    .where(eq(oddsHistory.eventId, eventId))
    .orderBy(desc(oddsHistory.recordedAt));

  const seen = new Set<string>();
  const latest: typeof rows = [];
  for (const row of rows) {
    const key = `${row.bookmaker}:${row.market}:${row.outcome}`;
    if (seen.has(key)) continue;
    seen.add(key);
    latest.push(row);
  }
  return latest;
}
