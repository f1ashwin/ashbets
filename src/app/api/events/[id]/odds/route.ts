import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { events, predictions } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { getBookmakerGrid } from "@/lib/db/queries/odds";
import { currentBalance } from "@/lib/db/queries/bankroll";
import { computeTopTwoBets } from "@/lib/predictions/match-bets";
import { hasEloUncertainty } from "@/lib/predictions/elo-uncertainty";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [eventRow] = await db
    .select()
    .from(events)
    .where(eq(events.id, id))
    .limit(1);

  if (!eventRow) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const [predRow] = await db
    .select()
    .from(predictions)
    .where(
      and(eq(predictions.eventId, id), eq(predictions.model, "elo"))
    )
    .orderBy(desc(predictions.createdAt))
    .limit(1);

  const probabilities = (predRow?.probabilities ?? {}) as Record<string, number>;

  const oddsRows = await getBookmakerGrid(id);
  const bankroll = await currentBalance();

  // Build typed odds rows for computeTopTwoBets
  const latestOdds = oddsRows.map((o) => ({
    bookmaker: o.bookmaker,
    market: o.market,
    outcome: o.outcome,
    odds: Number(o.odds),
    point: o.point ?? null,
  }));

  const topBets = predRow
    ? computeTopTwoBets(
        { id: eventRow.id, homeTeam: eventRow.homeTeam, awayTeam: eventRow.awayTeam },
        probabilities,
        latestOdds,
        bankroll,
        9999, // no daily cap in drawer — caller decides
      )
    : [];

  // Build bookmaker odds grids grouped by bookmaker
  const bookmakers = [...new Set(oddsRows.map((o) => o.bookmaker))];

  const h2hOdds = bookmakers.map((bm) => {
    const rows = oddsRows.filter((o) => o.bookmaker === bm && o.market === "h2h");
    return {
      bookmaker: bm,
      home: rows.find((r) => r.outcome === "home")?.odds ?? null,
      draw: rows.find((r) => r.outcome === "draw")?.odds ?? null,
      away: rows.find((r) => r.outcome === "away")?.odds ?? null,
    };
  }).filter((r) => r.home !== null || r.draw !== null || r.away !== null);

  const totalsOdds = bookmakers.map((bm) => {
    const rows = oddsRows.filter(
      (o) => o.bookmaker === bm && o.market === "totals" && Number(o.point) === 2.5
    );
    return {
      bookmaker: bm,
      over25: rows.find((r) => r.outcome === "over")?.odds ?? null,
      under25: rows.find((r) => r.outcome === "under")?.odds ?? null,
    };
  }).filter((r) => r.over25 !== null || r.under25 !== null);

  return NextResponse.json({
    event: {
      id: eventRow.id,
      homeTeam: eventRow.homeTeam,
      awayTeam: eventRow.awayTeam,
      startTime: eventRow.startTime,
      league: eventRow.league,
      status: eventRow.status,
    },
    probabilities,
    h2hOdds,
    totalsOdds,
    topBets,
    hasEloWarning: hasEloUncertainty(eventRow.homeTeam, eventRow.awayTeam),
  });
}
