import { Suspense } from "react";
import { getRenderedSignals } from "@/lib/predictions/signals";
import { formatOdds, formatPercent } from "@/lib/utils/formatters";
import { TierBadge } from "@/components/predictions/tier-badge";
import { FreshnessBadge } from "@/components/predictions/freshness-badge";

export const metadata = { title: "Value Bets — AshBets" };

export default function PredictionsPage() {
  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-bold">Value Bets</h1>
        <p className="text-sm text-gray-500">All qualifying value signals across sports, sorted by edge.</p>
      </header>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />}>
        <Board />
      </Suspense>
    </div>
  );
}

async function Board() {
  const signals = await getRenderedSignals();
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
      <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-800">
        <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-900">
          <tr>
            <Th>Event</Th>
            <Th>Sport</Th>
            <Th>Outcome</Th>
            <Th>Book</Th>
            <Th>Odds</Th>
            <Th>Model %</Th>
            <Th>Edge</Th>
            <Th>EV</Th>
            <Th>Tier</Th>
            <Th>Freshness</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
          {signals.length === 0 ? (
            <tr>
              <td colSpan={10} className="px-3 py-6 text-center text-xs text-gray-500">
                No qualifying value signals right now.
              </td>
            </tr>
          ) : (
            signals.map((s) => (
              <tr key={s.predictionId + s.signal.bookmaker + s.signal.outcome}>
                <Td>{s.eventLabel}</Td>
                <Td>{s.sport}</Td>
                <Td>{s.signal.outcome}</Td>
                <Td>{s.signal.bookmaker}</Td>
                <Td mono>{formatOdds(s.signal.odds, "decimal")}</Td>
                <Td mono>{formatPercent(s.signal.modelProbability)}</Td>
                <Td mono>{formatPercent(s.signal.edge)}</Td>
                <Td mono>{formatPercent(s.signal.ev)}</Td>
                <Td>{s.tier !== "rejected" ? <TierBadge tier={s.tier} /> : null}</Td>
                <Td>
                  <FreshnessBadge freshness={s.freshness} recordedAt={s.oddsRecordedAt} />
                </Td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 font-medium">{children}</th>;
}
function Td({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return <td className={`px-3 py-2 ${mono ? "font-mono" : ""}`}>{children}</td>;
}
