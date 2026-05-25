import { formatCurrency, formatOdds, formatPercent } from "@/lib/utils/formatters";
import { recommendedStake } from "@/lib/predictions/value-calculator";
import { limits } from "@/lib/config/limits";
import type { ComboRecommendation } from "@/lib/predictions/combo";
import { PlaceBetButton } from "./place-bet-button";

const TITLES: Record<ComboRecommendation["kind"], string> = {
  safe: "Safe Ladder",
  balanced: "Balanced Ladder",
  moonshot: "Moonshot Ladder",
};

const BLURBS: Record<ComboRecommendation["kind"], string> = {
  safe: "Two high-confidence legs. Lower variance, modest combined odds.",
  balanced: "High-conf anchor + two balanced legs. Mid-risk.",
  moonshot: "Two upside legs. Entertainment tier — stake small.",
};

export function ComboCard({
  combo,
  bankroll,
  dailyRemaining,
}: {
  combo: ComboRecommendation | null;
  bankroll: number;
  dailyRemaining: number;
}) {
  if (!combo) {
    return (
      <article className="rounded-lg border border-dashed border-gray-300 p-4 text-center text-xs text-gray-500 dark:border-gray-700">
        No viable combo in this bucket today.
      </article>
    );
  }

  const { stake } = recommendedStake(combo.kellyFraction, bankroll, {
    softCap: limits.softCap,
    hardCap: limits.hardCap,
    dailyRemaining,
    maxBetCurrency: combo.kind === "moonshot" ? 1 : limits.maxDailyStakeEur,
  });

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <header>
        <h3 className="text-sm font-semibold">{TITLES[combo.kind]}</h3>
        <p className="text-xs text-gray-500">{BLURBS[combo.kind]}</p>
      </header>

      <ol className="flex flex-col gap-2 text-xs">
        {combo.legs.map((leg, i) => (
          <li key={leg.eventId} className="flex items-center justify-between gap-2 rounded border border-gray-100 px-2 py-1 dark:border-gray-800">
            <span className="truncate">
              <span className="text-gray-500">{i + 1}.</span> {leg.label}{" "}
              <span className="text-gray-500">— {leg.outcome}</span>
            </span>
            <span className="font-mono text-gray-500">{formatOdds(leg.odds, "decimal")}</span>
          </li>
        ))}
      </ol>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <Cell label="Odds" value={formatOdds(combo.combinedOdds, "decimal")} />
        <Cell label="EV" value={formatPercent(combo.combinedEV)} />
        <Cell label="Stake" value={formatCurrency(stake)} />
      </div>

      <p className="text-[10px] italic text-gray-500">
        Legs assumed independent; combined probability discounted by {formatPercent(limits.correlationDiscount, 0)} to cover residual correlation.
      </p>

      <div className="flex justify-end">
        <PlaceBetButton
          payload={{ kind: "combo", combo, stake }}
          disabled={stake <= 0}
          label={`Place ${combo.legs.length}-leg`}
        />
      </div>
    </article>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-gray-500">{label}</div>
      <div className="font-mono text-sm font-medium">{value}</div>
    </div>
  );
}
