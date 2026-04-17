export const metadata = { title: "Analytics — AshBets" };

export default function AnalyticsPage() {
  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-sm text-gray-500">CLV distribution, calibration curve, Brier over time.</p>
      </header>
      <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 dark:border-gray-700">
        Phase 2. Analytics dashboards land after first 100 settled bets so the
        calibration curve has a meaningful denominator.
      </div>
    </div>
  );
}
