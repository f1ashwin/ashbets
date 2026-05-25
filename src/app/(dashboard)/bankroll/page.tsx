import { Suspense } from "react";
import { currentBalance, recentLedger } from "@/lib/db/queries/bankroll";
import { formatCurrency } from "@/lib/utils/formatters";

export const metadata = { title: "Bankroll — AshBets" };

export default function BankrollPage() {
  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-bold">Bankroll</h1>
        <p className="text-sm text-gray-500">Current balance and recent ledger entries.</p>
      </header>
      <Suspense fallback={<div className="h-24 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />}>
        <BalanceCard />
      </Suspense>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />}>
        <Ledger />
      </Suspense>
    </div>
  );
}

async function BalanceCard() {
  const balance = await currentBalance();
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
      <div className="text-xs uppercase tracking-wide text-gray-500">Balance</div>
      <div className="text-3xl font-bold font-mono">{formatCurrency(balance)}</div>
    </div>
  );
}

async function Ledger() {
  const ledger = await recentLedger(25);
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
      <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-800">
        <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-900">
          <tr>
            <th className="px-3 py-2 font-medium">Time</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Amount</th>
            <th className="px-3 py-2 font-medium">Balance after</th>
            <th className="px-3 py-2 font-medium">Description</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
          {ledger.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-3 py-6 text-center text-xs text-gray-500">
                No transactions yet.
              </td>
            </tr>
          ) : (
            ledger.map((row) => (
              <tr key={row.id}>
                <td className="px-3 py-2">{row.createdAt.toISOString().slice(0, 16).replace("T", " ")}</td>
                <td className="px-3 py-2">{row.type}</td>
                <td className="px-3 py-2 font-mono">{formatCurrency(Number(row.amount))}</td>
                <td className="px-3 py-2 font-mono">{formatCurrency(Number(row.balanceAfter))}</td>
                <td className="px-3 py-2">{row.description ?? "—"}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
