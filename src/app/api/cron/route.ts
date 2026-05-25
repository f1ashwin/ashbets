import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { and, eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { events, predictions, eloRatings, oddsHistory } from "@/lib/db/schema";
import { resolveTeam } from "@/lib/ingest/resolve-team";
import { matchProbabilities } from "@/lib/predictions/elo";
import { evaluateValue } from "@/lib/predictions/value-calculator";
import { ingestOddsApi } from "@/lib/ingest/odds-api";

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

  // 3. Generate predictions for upcoming matches
  let predictionsCreated = 0;
  try {
    const upcomingEvents = await db
      .select()
      .from(events)
      .where(eq(events.status, "upcoming"));

    for (const event of upcomingEvents) {
      // Resolve teams canonically
      const homeRes = await resolveTeam({
        sport: "football",
        source: "odds-api",
        externalName: event.homeTeam,
      });
      const awayRes = await resolveTeam({
        sport: "football",
        source: "odds-api",
        externalName: event.awayTeam,
      });

      if (homeRes.status !== "matched" || awayRes.status !== "matched") {
        console.warn(`Unresolved teams for event ${event.id}: home=${event.homeTeam}, away=${event.awayTeam}`);
        continue;
      }

      const homeCanonical = homeRes.canonicalName;
      const awayCanonical = awayRes.canonicalName;

      // Fetch current Elo ratings
      const homeEloRow = await db
        .select({ rating: eloRatings.rating })
        .from(eloRatings)
        .where(and(eq(eloRatings.entity, homeCanonical), eq(eloRatings.sport, "football")))
        .limit(1);
      const awayEloRow = await db
        .select({ rating: eloRatings.rating })
        .from(eloRatings)
        .where(and(eq(eloRatings.entity, awayCanonical), eq(eloRatings.sport, "football")))
        .limit(1);

      const homeElo = homeEloRow[0] ? Number(homeEloRow[0].rating) : 1500;
      const awayElo = awayEloRow[0] ? Number(awayEloRow[0].rating) : 1500;

      // World Cup matches are played on neutral ground, so isNeutral = true
      const probabilities = matchProbabilities(homeElo, awayElo, "football", true);

      // Fetch fresh, uncached latest odds for the event
      const oddsRows = await db
        .select({
          bookmaker: oddsHistory.bookmaker,
          market: oddsHistory.market,
          outcome: oddsHistory.outcome,
          odds: oddsHistory.odds,
        })
        .from(oddsHistory)
        .where(eq(oddsHistory.eventId, event.id))
        .orderBy(desc(oddsHistory.recordedAt));

      // Extract unique latest lines
      const seenLines = new Set<string>();
      const latestOdds: Array<{ bookmaker: string; market: string; outcome: string; odds: number }> = [];
      for (const row of oddsRows) {
        const key = `${row.bookmaker}:${row.market}:${row.outcome}`;
        if (seenLines.has(key)) continue;
        seenLines.add(key);
        latestOdds.push({
          bookmaker: row.bookmaker,
          market: row.market,
          outcome: row.outcome,
          odds: Number(row.odds),
        });
      }

      // Calculate best value outcome
      let bestValue: any = null;
      let bestEdge = 0;

      for (const line of latestOdds) {
        let modelProb = 0;
        if (line.market === "h2h") {
          modelProb = probabilities[line.outcome] ?? 0;
        } else if (line.market === "totals") {
          if (line.outcome === "over") modelProb = probabilities.over25 ?? 0;
          else if (line.outcome === "under") modelProb = probabilities.under25 ?? 0;
        }

        const signal = evaluateValue(modelProb, line.odds, line.bookmaker, line.outcome);
        if (signal.isValue && signal.edge > bestEdge) {
          bestEdge = signal.edge;
          bestValue = {
            outcome: line.outcome,
            bookmaker: line.bookmaker,
            odds: line.odds,
            edge: signal.edge,
            ev: signal.ev,
          };
        }
      }

      // Delete existing prediction record for this model & modelVersion
      await db
        .delete(predictions)
        .where(
          and(
            eq(predictions.eventId, event.id),
            eq(predictions.model, "elo"),
            eq(predictions.modelVersion, "wc2026-v1")
          )
        );

      // Insert new prediction
      await db.insert(predictions).values({
        eventId: event.id,
        model: "elo",
        modelVersion: "wc2026-v1",
        probabilities,
        bestValue: bestValue ?? null,
      });

      predictionsCreated++;
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
