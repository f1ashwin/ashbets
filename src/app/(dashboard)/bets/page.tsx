import { Suspense } from "react";
import { listRecentBets } from "@/lib/db/queries/bets";
import { formatCurrency, formatOdds } from "@/lib/utils/formatters";

export const metadata = { title: "Bet Tracker — AshBets" };

export default function BetsPage() {
  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-bold">Bet Tracker</h1>
        <p className="text-sm text-gray-500">
          Placed bets with per-bet CLV. Paper bets are tagged.
        </p>
      </header>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />}>
        <BetsTable />
      </Suspense>
    </div>
  );
}

async function BetsTable() {
  const rows = await listRecentBets();
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
      <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-800">
        <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-900">
          <tr>
            <Th>Placed</Th>
            <Th>Type</Th>
            <Th>Sport</Th>
            <Th>Selection</Th>
            <Th>Stake</Th>
            <Th>Odds</Th>
            <Th>Status</Th>
            <Th>CLV</Th>
            <Th>Mode</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={9} className="px-3 py-6 text-center text-xs text-gray-500">
                No bets yet. Place one from the overview.
              </td>
            </tr>
          ) : (
            rows.map(({ bet, clv }) => (
              <tr key={bet.id}>
                <Td>{bet.placedAt.toISOString().slice(0, 16).replace("T", " ")}</Td>
                <Td>{bet.betType === "accumulator" ? `${bet.legCount}-leg` : "single"}</Td>
                <Td>{bet.sport}</Td>
                <Td>{bet.selection}</Td>
                <Td mono>{formatCurrency(Number(bet.stake))}</Td>
                <Td mono>{formatOdds(Number(bet.odds), "decimal")}</Td>
                <Td>{bet.status}</Td>
                <Td mono>{clv ? Number(clv.clvPercentage).toFixed(4) : "—"}</Td>
                <Td>{bet.paperOnly ? "paper" : "live"}</Td>
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
