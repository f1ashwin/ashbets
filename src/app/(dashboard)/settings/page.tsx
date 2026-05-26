import { limits } from "@/lib/config/limits";
import { formatCurrency, formatPercent } from "@/lib/utils/formatters";
import { BookmakerUrlField } from "@/components/settings/bookmaker-url-field";

export const metadata = { title: "Settings — AshBets" };

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-gray-500">
          Effective limits are shown below. Environment-driven — change via env vars and redeploy.
        </p>
      </header>

      <dl className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Row label="Daily stake cap" value={formatCurrency(limits.maxDailyStakeEur)} />
        <Row label="Per-bet soft cap" value={formatPercent(limits.softCap, 0)} />
        <Row label="Per-bet hard cap" value={formatPercent(limits.hardCap, 0)} />
        <Row label="Correlation discount" value={formatPercent(limits.correlationDiscount, 0)} />
        <Row label="Paper mode" value={limits.backtestGatePassed ? "off (live)" : "on"} />
      </dl>

      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <BookmakerUrlField />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="font-mono text-sm font-semibold">{value}</dd>
    </div>
  );
}
