import type { ComboRecommendation } from "@/lib/predictions/combo";
import { ComboCard } from "./combo-card";

export function ComboLadderRow({
  ladders,
  bankroll,
  dailyRemaining,
}: {
  ladders: {
    safe: ComboRecommendation | null;
    balanced: ComboRecommendation | null;
    moonshot: ComboRecommendation | null;
  };
  bankroll: number;
  dailyRemaining: number;
}) {
  return (
    <section className="flex flex-col gap-3">
      <header>
        <h2 className="text-base font-semibold">Combined bets</h2>
        <p className="text-xs text-gray-500">
          Three daily ladder suggestions. Only shown when EV stays positive after correlation discount.
        </p>
      </header>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <ComboCard combo={ladders.safe} bankroll={bankroll} dailyRemaining={dailyRemaining} />
        <ComboCard combo={ladders.balanced} bankroll={bankroll} dailyRemaining={dailyRemaining} />
        <ComboCard combo={ladders.moonshot} bankroll={bankroll} dailyRemaining={dailyRemaining} />
      </div>
    </section>
  );
}
