/**
 * Event resolver — the cross-source complement to `resolveTeam`.
 *
 * Each upstream (Odds API, API-Football, CricketData) has its own ID for the
 * same physical fixture. To compute CLV or compare model vs market for a
 * single match, we need to join those IDs to one canonical `events.id`. This
 * module is the single funnel that produces the canonical row and the
 * `event_mapping` join row.
 *
 * Flow:
 *   1. Resolve home + away via `resolveTeam` — fail closed if either is
 *      unresolved (same contract as the team resolver).
 *   2. Look up an existing `event_mapping` row by the source's upstream ID.
 *      If found, return the canonical event id.
 *   3. Otherwise look up or insert the canonical event (keyed by
 *      `(source, externalId)` per the existing `events` unique index) and
 *      upsert the `event_mapping` row with this source's ID set.
 *
 * This is a Phase A stub: the resolver is correct for the single-source
 * case (each source discovers a fixture separately and they get linked
 * later when a second source reports it). Multi-source reconciliation
 * heuristics (same home + away team ids + start time within ±2h across
 * two upstreams with no overlapping ID) arrive in Phase A when we actually
 * ingest from two Odds API + API-Football simultaneously.
 */

import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { eventMapping, events } from "@/lib/db/schema";
import { resolveTeam, type AliasSource } from "./resolve-team";
import type { Sport } from "@/types/sports";

export interface ResolveEventInput {
  sport: Sport;
  source: AliasSource;
  /** Upstream fixture identifier — used as both `events.external_id` and the
   *  source-column value in `event_mapping`. */
  externalId: string;
  league: string | null;
  homeTeamName: string;
  awayTeamName: string;
  startTime: Date;
  metadata?: Record<string, unknown>;
}

export type ResolveEventResult =
  | { status: "matched"; canonicalEventId: string; homeTeamId: string; awayTeamId: string }
  | { status: "pending"; unresolved: Array<"home" | "away"> };

function sourceColumn(source: AliasSource) {
  switch (source) {
    case "odds-api":
      return eventMapping.oddsApiId;
    case "api-football":
      return eventMapping.apiFootballId;
    case "cricketdata":
      return eventMapping.cricketDataId;
  }
}

export async function resolveEvent(input: ResolveEventInput): Promise<ResolveEventResult> {
  const home = await resolveTeam({
    sport: input.sport,
    source: input.source,
    externalName: input.homeTeamName,
  });
  const away = await resolveTeam({
    sport: input.sport,
    source: input.source,
    externalName: input.awayTeamName,
  });

  const unresolved: Array<"home" | "away"> = [];
  if (home.status !== "matched") unresolved.push("home");
  if (away.status !== "matched") unresolved.push("away");
  if (unresolved.length > 0) {
    return { status: "pending", unresolved };
  }

  const col = sourceColumn(input.source);

  // Fast path — this exact upstream ID is already mapped.
  const existingMapping = await db
    .select({ canonicalEventId: eventMapping.canonicalEventId })
    .from(eventMapping)
    .where(eq(col, input.externalId))
    .limit(1);

  if (existingMapping[0]) {
    return {
      status: "matched",
      canonicalEventId: existingMapping[0].canonicalEventId,
      homeTeamId: (home as { teamId: string }).teamId,
      awayTeamId: (away as { teamId: string }).teamId,
    };
  }

  // Upsert the canonical event by (externalId, source) — `events` unique
  // index means the same source can't register the same fixture twice.
  const existingEvent = await db
    .select()
    .from(events)
    .where(
      and(eq(events.externalId, input.externalId), eq(events.source, input.source))
    )
    .limit(1);

  let canonicalEventId: string;
  if (existingEvent[0]) {
    canonicalEventId = existingEvent[0].id;
  } else {
    const [row] = await db
      .insert(events)
      .values({
        externalId: input.externalId,
        source: input.source,
        sport: input.sport,
        league: input.league,
        homeTeam: input.homeTeamName,
        awayTeam: input.awayTeamName,
        startTime: input.startTime,
        metadata: input.metadata ?? null,
      })
      .returning({ id: events.id });
    canonicalEventId = row.id;
  }

  // Now link this source's upstream ID into event_mapping. The per-source
  // unique indexes (added by the schema fixes) prevent double-mapping.
  await db
    .insert(eventMapping)
    .values({
      canonicalEventId,
      oddsApiId: input.source === "odds-api" ? input.externalId : null,
      apiFootballId: input.source === "api-football" ? input.externalId : null,
      cricketDataId: input.source === "cricketdata" ? input.externalId : null,
    })
    .onConflictDoNothing();

  return {
    status: "matched",
    canonicalEventId,
    homeTeamId: (home as { teamId: string }).teamId,
    awayTeamId: (away as { teamId: string }).teamId,
  };
}

/**
 * Throws with a clear message if the fixture can't be resolved cleanly. Use
 * this at the start of any prediction pipeline that reads event/team data —
 * we'd rather fail fast than compute predictions against mis-joined rows.
 */
export async function assertEventResolved(
  input: ResolveEventInput
): Promise<{ canonicalEventId: string; homeTeamId: string; awayTeamId: string }> {
  const r = await resolveEvent(input);
  if (r.status !== "matched") {
    throw new Error(
      `Event resolution failed for ${input.source}:${input.externalId} ` +
        `(unresolved: ${r.unresolved.join(", ")}). ` +
        `Check pending_aliases for "${input.homeTeamName}" / "${input.awayTeamName}" ` +
        `and insert canonical rows into teams + team_aliases.`
    );
  }
  return r;
}
