import { Suspense } from "react";
import { getRenderedSignals } from "@/lib/predictions/signals";
import { buildLadders, type ComboCandidate } from "@/lib/predictions/combo";
import { currentBalance } from "@/lib/db/queries/bankroll";
import { todaysSpend } from "@/lib/db/queries/bets";
import { limits } from "@/lib/config/limits";
import { TopStrip } from "@/components/layout/top-strip";
import { TierColumn } from "@/components/predictions/tier-column";
import { ComboLadderRow } from "@/components/predictions/combo-ladder-row";

export const metadata = {
  title: "Overview — AshBets",
};

export default function Overview() {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<StripSkeleton />}>
        <TopStripCell />
      </Suspense>

      <Suspense fallback={<BoardSkeleton />}>
        <SignalsBoard />
      </Suspense>
    </div>
  );
}

async function TopStripCell() {
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

async function SignalsBoard() {
  const [signals, bankroll, spend] = await Promise.all([
    getRenderedSignals(),
    currentBalance(),
    todaysSpend(),
  ]);
  const dailyRemaining = Math.max(0, limits.maxDailyStakeEur - spend.real);

  const candidates: ComboCandidate[] = signals
    .filter((s) => s.tier !== "rejected")
    .map((s) => ({
      eventId: s.eventId,
      sport: s.sport,
      tier: s.tier,
      signal: s.signal,
      label: s.eventLabel,
      eventTime: s.startTime,
    }));
  const ladders = buildLadders(candidates, { correlationDiscount: limits.correlationDiscount });

  const byTier = {
    high_confidence: signals.filter((s) => s.tier === "high_confidence"),
    balanced: signals.filter((s) => s.tier === "balanced"),
    upside: signals.filter((s) => s.tier === "upside"),
  };

  return (
    <>
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <TierColumn tier="high_confidence" signals={byTier.high_confidence} bankroll={bankroll} dailyRemaining={dailyRemaining} />
        <TierColumn tier="balanced" signals={byTier.balanced} bankroll={bankroll} dailyRemaining={dailyRemaining} />
        <TierColumn tier="upside" signals={byTier.upside} bankroll={bankroll} dailyRemaining={dailyRemaining} />
      </section>
      <ComboLadderRow ladders={ladders} bankroll={bankroll} dailyRemaining={dailyRemaining} />
    </>
  );
}

function StripSkeleton() {
  return <div className="h-20 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />;
}

function BoardSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-3">
          <div className="h-6 w-40 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
          <div className="h-36 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
          <div className="h-36 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
        </div>
      ))}
    </div>
  );
}
