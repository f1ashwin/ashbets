import { Suspense } from "react";
import { connection } from "next/server";
import { getRenderedSignals } from "@/lib/predictions/signals";
import { currentBalance } from "@/lib/db/queries/bankroll";
import { todaysSpend } from "@/lib/db/queries/bets";
import { limits } from "@/lib/config/limits";
import { TierColumn } from "@/components/predictions/tier-column";

export const metadata = { title: "Cricket — AshBets" };

export default function CricketPage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">Cricket</h1>
        <p className="text-sm text-gray-500">IPL · T20 · Internationals</p>
      </header>
      <Suspense fallback={<BoardSkeleton />}>
        <CricketBoard />
      </Suspense>
    </div>
  );
}

async function CricketBoard() {
  await connection();
  const [signals, bankroll, spend] = await Promise.all([
    getRenderedSignals("cricket"),
    currentBalance(),
    todaysSpend(),
  ]);
  const dailyRemaining = Math.max(0, limits.maxDailyStakeEur - spend.real);
  const byTier = {
    high_confidence: signals.filter((s) => s.tier === "high_confidence"),
    balanced: signals.filter((s) => s.tier === "balanced"),
    upside: signals.filter((s) => s.tier === "upside"),
  };
  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <TierColumn tier="high_confidence" signals={byTier.high_confidence} bankroll={bankroll} dailyRemaining={dailyRemaining} max={8} />
      <TierColumn tier="balanced" signals={byTier.balanced} bankroll={bankroll} dailyRemaining={dailyRemaining} max={8} />
      <TierColumn tier="upside" signals={byTier.upside} bankroll={bankroll} dailyRemaining={dailyRemaining} max={8} />
    </section>
  );
}

function BoardSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-40 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
      ))}
    </div>
  );
}
