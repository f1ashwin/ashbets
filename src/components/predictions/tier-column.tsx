import type { RiskTier } from "@/lib/predictions/risk-tier";
import type { RenderedSignal } from "@/lib/predictions/signals";
import { SignalCard } from "./signal-card";

const HEADERS: Record<Exclude<RiskTier, "rejected">, { title: string; blurb: string }> = {
  high_confidence: {
    title: "High Confidence",
    blurb: "Lower variance, lower payout. The bankers.",
  },
  balanced: {
    title: "Balanced",
    blurb: "Mid-variance, mid-payout. Most picks land here.",
  },
  upside: {
    title: "Upside",
    blurb: "Higher variance, higher payout. Size small.",
  },
};

export function TierColumn({
  tier,
  signals,
  bankroll,
  dailyRemaining,
  max = 4,
}: {
  tier: Exclude<RiskTier, "rejected">;
  signals: RenderedSignal[];
  bankroll: number;
  dailyRemaining: number;
  max?: number;
}) {
  const slice = signals.slice(0, max);
  const header = HEADERS[tier];

  return (
    <section className="flex flex-col gap-3">
      <header>
        <h2 className="text-base font-semibold">{header.title}</h2>
        <p className="text-xs text-gray-500">{header.blurb}</p>
      </header>
      {slice.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-xs text-gray-500 dark:border-gray-700">
          No qualifying picks right now.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {slice.map((s) => (
            <SignalCard
              key={s.predictionId + s.signal.bookmaker + s.signal.outcome}
              signal={s}
              bankroll={bankroll}
              dailyRemaining={dailyRemaining}
            />
          ))}
        </div>
      )}
    </section>
  );
}
