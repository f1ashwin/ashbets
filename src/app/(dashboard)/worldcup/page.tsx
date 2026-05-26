import { Suspense } from "react";
import { connection } from "next/server";
import { format } from "date-fns";
import { asc, eq, and, desc, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { events, predictions } from "@/lib/db/schema";
import { currentBalance } from "@/lib/db/queries/bankroll";
import { todaysSpend } from "@/lib/db/queries/bets";
import { getLatestOddsForEvents } from "@/lib/db/queries/odds";
import { computeTopTwoBets } from "@/lib/predictions/match-bets";
import { hasEloUncertainty } from "@/lib/predictions/elo-uncertainty";
import { getDailyMoonshots } from "@/lib/predictions/moonshots";
import { limits } from "@/lib/config/limits";
import { TopStrip } from "@/components/layout/top-strip";
import { WorldCupSchedule, type DayGroup } from "@/components/worldcup/worldcup-schedule";
import { DailyMoonshots } from "@/components/worldcup/daily-moonshots";

export const metadata = {
  title: "World Cup 2026 — AshBets",
};

export default function WorldCupDashboard() {
  return (
    <div className="flex flex-col gap-6">
      <header className="relative overflow-hidden rounded-xl bg-gradient-to-r from-emerald-600 to-teal-800 p-6 text-white shadow-md dark:from-emerald-950 dark:to-teal-900">
        <div className="relative z-10">
          <h1 className="text-3xl font-extrabold tracking-tight">World Cup 2026</h1>
          <p className="mt-2 max-w-xl text-sm text-emerald-100">
            Model-driven betting intelligence. Top 2 value bets (H2H & Over/Under 2.5) per fixture — click any match for full odds breakdown.
          </p>
        </div>
        <div className="pointer-events-none absolute bottom-0 right-0 top-0 w-1/3 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-yellow-300 via-emerald-900 to-transparent opacity-10" />
      </header>

      <Suspense fallback={<StripSkeleton />}>
        <TopStripCell />
      </Suspense>

      <Suspense fallback={<MoonshotSkeleton />}>
        <MoonshotsCell />
      </Suspense>

      <Suspense fallback={<ScheduleSkeleton />}>
        <MatchSchedule />
      </Suspense>
    </div>
  );
}

async function TopStripCell() {
  await connection();
  const [bankroll, spend] = await Promise.all([currentBalance(), todaysSpend()]);
  return (
    <TopStrip
      bankroll={bankroll}
      todaySpendReal={spend.real}
      todaySpendPaper={spend.paper}
      pnlToday={0}
      betsToday={0}
    />
  );
}

async function MoonshotsCell() {
  await connection();
  const moonshots = await getDailyMoonshots();
  return <DailyMoonshots moonshots={moonshots} />;
}

async function MatchSchedule() {
  await connection();

  const now = new Date();
  const todayStr = format(now, "yyyy-MM-dd");

  const [bankroll, spend, upcoming] = await Promise.all([
    currentBalance(),
    todaysSpend(),
    db
      .select()
      .from(events)
      .where(and(eq(events.sport, "football"), eq(events.status, "upcoming")))
      .orderBy(asc(events.startTime)),
  ]);

  if (upcoming.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 dark:border-gray-800">
        No upcoming fixtures found. Hit /api/cron to ingest matches and odds.
      </div>
    );
  }

  const eventIds = upcoming.map((e) => e.id);

  // Batch fetch: 2 queries total regardless of event count (replaces 216-query N+1)
  const [allOdds, allPreds] = await Promise.all([
    getLatestOddsForEvents(eventIds),
    db
      .select()
      .from(predictions)
      .where(
        and(
          inArray(predictions.eventId, eventIds),
          eq(predictions.model, "elo"),
          eq(predictions.modelVersion, "wc2026-v1")
        )
      )
      .orderBy(desc(predictions.createdAt)),
  ]);

  // Latest prediction per event
  const predByEvent = new Map<string, Record<string, number>>();
  for (const p of allPreds) {
    if (!predByEvent.has(p.eventId)) {
      predByEvent.set(p.eventId, p.probabilities as Record<string, number>);
    }
  }

  // Odds grouped by event
  const oddsByEvent = new Map<string, typeof allOdds>();
  for (const o of allOdds) {
    const list = oddsByEvent.get(o.eventId) ?? [];
    list.push(o);
    oddsByEvent.set(o.eventId, list);
  }

  // Group events by day
  const grouped: Record<string, { label: string; isToday: boolean; cards: DayGroup["cards"] }> = {};
  for (const event of upcoming) {
    const date = new Date(event.startTime);
    const dayKey = format(date, "yyyy-MM-dd");
    if (!grouped[dayKey]) {
      const isToday = dayKey === todayStr;
      grouped[dayKey] = {
        label: format(date, "EEEE, MMMM d, yyyy"),
        isToday,
        cards: [],
      };
    }
  }

  // Budget split per day → per match
  for (const event of upcoming) {
    const date = new Date(event.startTime);
    const dayKey = format(date, "yyyy-MM-dd");
    const day = grouped[dayKey];
    const isToday = day.isToday;
    const totalBudget = isToday
      ? Math.max(0, limits.maxDailyStakeEur - spend.real)
      : limits.maxDailyStakeEur;
    const dayEvents = upcoming.filter((e) => format(new Date(e.startTime), "yyyy-MM-dd") === dayKey);
    const budgetPerMatch = dayEvents.length > 0 ? totalBudget / dayEvents.length : 0;

    const probabilities = predByEvent.get(event.id) ?? {};
    const eventOdds = (oddsByEvent.get(event.id) ?? []).map((o) => ({
      bookmaker: o.bookmaker,
      market: o.market,
      outcome: o.outcome,
      odds: o.odds,
      point: o.point ?? null,
    }));

    const topBets = computeTopTwoBets(
      { id: event.id, homeTeam: event.homeTeam, awayTeam: event.awayTeam },
      probabilities,
      eventOdds,
      bankroll,
      budgetPerMatch,
    );

    day.cards.push({
      event: {
        id: event.id,
        homeTeam: event.homeTeam,
        awayTeam: event.awayTeam,
        startTime: event.startTime.toISOString(),
        league: event.league,
        status: event.status,
      },
      topBets,
      hasEloWarning: hasEloUncertainty(event.homeTeam, event.awayTeam),
    });
  }

  const dayGroups: DayGroup[] = Object.entries(grouped).map(([dayKey, g]) => ({
    dayKey,
    label: g.label,
    isToday: g.isToday,
    cards: g.cards,
  }));

  return (
    <WorldCupSchedule
      grouped={dayGroups}
      minEdge={Number(process.env.MIN_EDGE ?? 0.02)}
    />
  );
}

function StripSkeleton() {
  return <div className="h-20 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />;
}

function MoonshotSkeleton() {
  return <div className="h-32 animate-pulse rounded-xl bg-slate-800/50" />;
}

function ScheduleSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {[0, 1].map((s) => (
        <div key={s} className="flex flex-col gap-4">
          <div className="h-6 w-48 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {[0, 1].map((c) => (
              <div key={c} className="h-44 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
