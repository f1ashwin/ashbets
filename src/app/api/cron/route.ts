import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { and, eq, desc, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { events, predictions, eloRatings, oddsHistory } from "@/lib/db/schema";
import { matchProbabilities } from "@/lib/predictions/elo";
import { evaluateValue } from "@/lib/predictions/value-calculator";
import { ingestOddsApi } from "@/lib/ingest/odds-api";

export const maxDuration = 60;

export async function GET(request: Request) {
  return handleCron(request);
}

export async function POST(request: Request) {
  return handleCron(request);
}

async function handleCron(request: Request) {
  // 1. Authorize cron trigger
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  
  // Also check query param token for easier testing/curl if needed
  const url = new URL(request.url);
  const queryToken = url.searchParams.get("token");
  
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret || (token !== expectedSecret && queryToken !== expectedSecret)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const errors: string[] = [];
  let ingestResult = { eventsProcessed: 0, oddsSnapshotsWritten: 0, errors: [] as string[] };

  // 2. Run ingestion
  try {
    ingestResult = await ingestOddsApi();
    errors.push(...ingestResult.errors);
  } catch (err: any) {
    errors.push(`Ingestion error: ${err.message}`);
  }

  // 3. Generate predictions for upcoming matches — batched to avoid N×6 round trips
  let predictionsCreated = 0;
  try {
    const upcomingEvents = await db
      .select()
      .from(events)
      .where(eq(events.status, "upcoming"));

    if (upcomingEvents.length > 0) {
      const eventIds = upcomingEvents.map((e) => e.id);

      // Collect all team names appearing in upcoming events
      const allTeamNames = [...new Set(upcomingEvents.flatMap((e) => [e.homeTeam, e.awayTeam]))].filter(Boolean);

      let eloMap: Record<string, number> = {};
      if (allTeamNames.length > 0) {
        // Batch-fetch all Elo ratings for those teams in one query
        const eloRows = await db
          .select({ entity: eloRatings.entity, rating: eloRatings.rating })
          .from(eloRatings)
          .where(and(inArray(eloRatings.entity, allTeamNames), eq(eloRatings.sport, "football")));
        eloMap = Object.fromEntries(eloRows.map((r) => [r.entity, Number(r.rating)]));
      }

      // Batch-fetch all latest odds for all upcoming events in one query
      const allOddsRows = await db
        .select({
          eventId: oddsHistory.eventId,
          bookmaker: oddsHistory.bookmaker,
          market: oddsHistory.market,
          outcome: oddsHistory.outcome,
          odds: oddsHistory.odds,
          recordedAt: oddsHistory.recordedAt,
        })
        .from(oddsHistory)
        .where(inArray(oddsHistory.eventId, eventIds))
        .orderBy(desc(oddsHistory.recordedAt));

      // Group odds by eventId, keeping only the latest line per bookmaker+market+outcome
      const oddsByEvent: Record<string, Array<{ bookmaker: string; market: string; outcome: string; odds: number }>> = {};
      const seenByEvent: Record<string, Set<string>> = {};
      for (const row of allOddsRows) {
        const eid = row.eventId!;
        if (!oddsByEvent[eid]) { oddsByEvent[eid] = []; seenByEvent[eid] = new Set(); }
        const key = `${row.bookmaker}:${row.market}:${row.outcome}`;
        if (seenByEvent[eid].has(key)) continue;
        seenByEvent[eid].add(key);
        oddsByEvent[eid].push({ bookmaker: row.bookmaker, market: row.market, outcome: row.outcome, odds: Number(row.odds) });
      }

      // Compute predictions in memory, then batch-upsert
      const newPredictions: Array<{ eventId: string; model: string; modelVersion: string; probabilities: any; bestValue: any }> = [];

      for (const event of upcomingEvents) {
        const homeElo = eloMap[event.homeTeam] ?? 1500;
        const awayElo = eloMap[event.awayTeam] ?? 1500;
        const probabilities = matchProbabilities(homeElo, awayElo, "football", true);
        const latestOdds = oddsByEvent[event.id] ?? [];

        let bestValue: any = null;
        let bestEdge = 0;
        for (const line of latestOdds) {
          let modelProb = 0;
          if (line.market === "h2h") modelProb = (probabilities as any)[line.outcome] ?? 0;
          else if (line.market === "totals") {
            if (line.outcome === "over") modelProb = (probabilities as any).over25 ?? 0;
            else if (line.outcome === "under") modelProb = (probabilities as any).under25 ?? 0;
          }
          const signal = evaluateValue(modelProb, line.odds, line.bookmaker, line.outcome);
          if (signal.isValue && signal.edge > bestEdge) {
            bestEdge = signal.edge;
            bestValue = { outcome: line.outcome, bookmaker: line.bookmaker, odds: line.odds, edge: signal.edge, ev: signal.ev };
          }
        }

        newPredictions.push({ eventId: event.id, model: "elo", modelVersion: "wc2026-v1", probabilities, bestValue: bestValue ?? null });
      }

      // Batch delete old + batch insert new (two queries total regardless of event count)
      if (newPredictions.length > 0) {
        await db.delete(predictions).where(
          and(inArray(predictions.eventId, eventIds), eq(predictions.model, "elo"), eq(predictions.modelVersion, "wc2026-v1"))
        );
        await db.insert(predictions).values(newPredictions);
        predictionsCreated = newPredictions.length;
      }
    }
  } catch (err: any) {
    errors.push(`Predictions generation error: ${err.message}`);
  }

  // 4. Invalidate Next.js cache tags
  const invalidated: string[] = [];
  const target = url.searchParams.get("target") ?? "all";
  const tags = target === "all" ? ["odds", "predictions", "events", "elo"] : [target];
  for (const t of tags) {
    revalidateTag(t, "max");
    invalidated.push(t);
  }

  return NextResponse.json({
    ok: errors.length === 0,
    eventsProcessed: ingestResult.eventsProcessed,
    oddsSnapshotsWritten: ingestResult.oddsSnapshotsWritten,
    predictionsCreated,
    invalidated,
    errors: errors.length > 0 ? errors : undefined,
  });
}
