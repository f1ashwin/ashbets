import { formatCurrency, formatPercent } from "@/lib/utils/formatters";
import { limits } from "@/lib/config/limits";

export function TopStrip({
  bankroll,
  todaySpendReal,
  todaySpendPaper,
  pnlToday,
  betsToday,
}: {
  bankroll: number;
  todaySpendReal: number;
  todaySpendPaper: number;
  pnlToday: number;
  betsToday: number;
}) {
  const capProgress = Math.min(1, todaySpendReal / limits.maxDailyStakeEur);

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-wrap items-center gap-3">
        <Stat label="Bankroll" value={formatCurrency(bankroll)} />
        <Stat label="P&L today" value={formatCurrency(pnlToday)} />
        <Stat label="Bets today" value={String(betsToday)} />
        <Stat
          label="Daily cap"
          value={`${formatCurrency(todaySpendReal)} / ${formatCurrency(limits.maxDailyStakeEur)}`}
        />
        {!limits.backtestGatePassed ? (
          <span className="ml-auto inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
            Paper mode · {formatCurrency(todaySpendPaper)} today
          </span>
        ) : null}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${capProgress * 100}%` }}
        />
      </div>
      <p className="text-[10px] text-gray-500">
        Strategy: value-betting with Half-Kelly ≤ {formatPercent(limits.softCap, 0)}, hard cap {formatPercent(limits.hardCap, 0)}.
      </p>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[110px]">
      <div className="text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className="font-mono text-sm font-semibold">{value}</div>
    </div>
  );
}
