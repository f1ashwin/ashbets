import { Suspense } from "react";
import { connection } from "next/server";
import { format } from "date-fns";
import { asc, eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { events } from "@/lib/db/schema";
import { currentBalance } from "@/lib/db/queries/bankroll";
import { todaysSpend } from "@/lib/db/queries/bets";
import { limits } from "@/lib/config/limits";
import { getTopTwoBets } from "@/lib/predictions/match-bets";
import { TopStrip } from "@/components/layout/top-strip";
import { PlaceBetButton } from "@/components/predictions/place-bet-button";
import { formatCurrency, formatOdds, formatPercent } from "@/lib/utils/formatters";

export const metadata = {
  title: "World Cup 2026 — AshBets",
};

export default function WorldCupDashboard() {
  return (
    <div className="flex flex-col gap-6">
      <header className="relative overflow-hidden rounded-xl bg-gradient-to-r from-emerald-600 to-teal-800 p-6 text-white shadow-md dark:from-emerald-950 dark:to-teal-900">
        <div className="relative z-10">
          <h1 className="text-3xl font-extrabold tracking-tight">World Cup 2026</h1>
          <p className="mt-2 text-sm text-emerald-100 max-w-xl">
            Model-driven betting intelligence for the World Cup. surfacing the top 2 value bets (H2H & Under/Over 2.5) for each fixture.
          </p>
        </div>
        <div className="absolute right-0 bottom-0 top-0 w-1/3 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-yellow-300 via-emerald-900 to-transparent pointer-events-none" />
      </header>

      <Suspense fallback={<StripSkeleton />}>
        <TopStripCell />
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

async function MatchSchedule() {
  await connection();
  const [bankroll, spend] = await Promise.all([
    currentBalance(),
    todaysSpend(),
  ]);
  const dailyRemaining = Math.max(0, limits.maxDailyStakeEur - spend.real);

  // Fetch upcoming football events
  const upcoming = await db
    .select()
    .from(events)
    .where(
      and(
        eq(events.sport, "football"),
        eq(events.status, "upcoming")
      )
    )
    .orderBy(asc(events.startTime));

  if (upcoming.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 dark:border-gray-800">
        No upcoming World Cup fixtures found. Execute /api/cron to ingest matches and odds.
      </div>
    );
  }

  // Group events by Match Day
  const grouped = upcoming.reduce((acc, event) => {
    const date = new Date(event.startTime);
    const dayStr = format(date, "EEEE, MMMM d, yyyy");
    if (!acc[dayStr]) acc[dayStr] = [];
    acc[dayStr].push(event);
    return acc;
  }, {} as Record<string, typeof upcoming>);

  return (
    <div className="flex flex-col gap-6">
      {Object.entries(grouped).map(([dayLabel, dayEvents]) => (
        <section key={dayLabel} className="flex flex-col gap-4">
          <h2 className="text-lg font-bold border-b border-gray-200 pb-1 text-gray-800 dark:border-gray-800 dark:text-gray-200">
            {dayLabel}
          </h2>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {dayEvents.map((event) => (
              <MatchCard
                key={event.id}
                event={event}
                bankroll={bankroll}
                dailyRemaining={dailyRemaining}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

async function MatchCard({
  event,
  bankroll,
  dailyRemaining,
}: {
  event: any;
  bankroll: number;
  dailyRemaining: number;
}) {
  const recommendations = await getTopTwoBets(event.id);
  const timeStr = format(new Date(event.startTime), "HH:mm");

  return (
    <div className="flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 transition-all hover:shadow-md">
      <div>
        <div className="flex items-center justify-between border-b border-gray-100 pb-3 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
              {event.homeTeam}
            </span>
            <span className="text-xs text-gray-400">vs</span>
            <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
              {event.awayTeam}
            </span>
          </div>
          <span className="rounded bg-emerald-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
            {timeStr}
          </span>
        </div>

        {recommendations.length === 0 ? (
          <div className="flex items-center justify-center py-6 text-xs text-gray-400 italic">
            No value bets found (edge &lt; {formatPercent(limits.softCap, 0)}) — skip this match
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {recommendations.map((bet) => (
              <div
                key={bet.market + bet.selection}
                className="flex flex-col justify-between rounded-lg border border-gray-100 bg-gray-50/50 p-3 dark:border-gray-800 dark:bg-gray-950/20"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded bg-gray-200/50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                      {bet.market === "h2h" ? "Match Result" : "Totals"}
                    </span>
                    <span className="text-[10px] font-medium text-gray-500">
                      {bet.bookmaker}
                    </span>
                  </div>
                  <div className="mt-2 text-sm font-bold text-gray-800 dark:text-gray-200">
                    {bet.selectionLabel}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-1 border-t border-gray-100 pt-2 text-[10px] dark:border-gray-800">
                  <div>
                    <span className="text-gray-500">Odds</span>
                    <div className="font-mono font-bold text-gray-950 dark:text-gray-50">
                      {formatOdds(bet.odds, "decimal")}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500">Edge</span>
                    <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {formatPercent(bet.edge)}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500">Stake</span>
                    <div className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      {formatCurrency(bet.stake)}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex justify-end">
                  <PlaceBetButton
                    payload={{
                      kind: "single",
                      eventId: event.id,
                      sport: "football",
                      market: bet.market,
                      selection: bet.selection,
                      outcome: bet.selection,
                      bookmaker: bet.bookmaker,
                      odds: bet.odds,
                      modelProbability: bet.modelProbability,
                      edge: bet.edge,
                      stake: bet.stake,
                    }}
                    label={`Log ${formatCurrency(bet.stake)}`}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StripSkeleton() {
  return <div className="h-20 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />;
}

function ScheduleSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {[0, 1].map((sectionIndex) => (
        <div key={sectionIndex} className="flex flex-col gap-4">
          <div className="h-6 w-48 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {[0, 1].map((cardIndex) => (
              <div key={cardIndex} className="h-44 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
