import { formatCurrency, formatOdds, formatPercent } from "@/lib/utils/formatters";
import { recommendedStake } from "@/lib/predictions/value-calculator";
import { limits } from "@/lib/config/limits";
import type { RenderedSignal } from "@/lib/predictions/signals";
import { FreshnessBadge } from "./freshness-badge";
import { TierBadge } from "./tier-badge";
import { PlaceBetButton } from "./place-bet-button";

export function SignalCard({
  signal,
  bankroll,
  dailyRemaining,
}: {
  signal: RenderedSignal;
  bankroll: number;
  dailyRemaining: number;
}) {
  const { stake } = recommendedStake(signal.signal.kellyFraction, bankroll, {
    softCap: limits.softCap,
    hardCap: limits.hardCap,
    dailyRemaining,
    maxBetCurrency: limits.maxDailyStakeEur,
  });

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-gray-500">
            {signal.sport}
            {signal.league ? ` · ${signal.league}` : null}
          </p>
          <h3 className="truncate text-sm font-semibold">{signal.eventLabel}</h3>
        </div>
        <TierBadge tier={signal.tier === "rejected" ? "balanced" : signal.tier} />
      </header>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <Cell label="Outcome" value={signal.signal.outcome} />
        <Cell label="Book" value={signal.signal.bookmaker} />
        <Cell label="Odds" value={formatOdds(signal.signal.odds, "decimal")} />
        <Cell label="Edge" value={formatPercent(signal.signal.edge)} />
        <Cell label="EV" value={formatPercent(signal.signal.ev)} />
        <Cell label="Stake" value={formatCurrency(stake)} />
      </div>

      <footer className="flex items-center justify-between gap-2">
        <FreshnessBadge freshness={signal.freshness} recordedAt={signal.oddsRecordedAt} />
        <PlaceBetButton
          disabled={signal.freshness.blockPlacement}
          payload={{
            kind: "single",
            eventId: signal.eventId,
            sport: signal.sport,
            market: "h2h",
            selection: signal.signal.outcome,
            outcome: signal.signal.outcome,
            bookmaker: signal.signal.bookmaker,
            odds: signal.signal.odds,
            modelProbability: signal.signal.modelProbability,
            edge: signal.signal.edge,
            stake,
          }}
        />
      </footer>
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
