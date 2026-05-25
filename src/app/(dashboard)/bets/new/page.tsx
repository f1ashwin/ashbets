export const metadata = { title: "Manual Bet — AshBets" };

export default function NewBetPage() {
  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-bold">Manual Bet</h1>
        <p className="text-sm text-gray-500">
          For bets placed outside the recommendation pipeline. Phase 2 — stubbed for now.
        </p>
      </header>
      <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700">
        Not yet implemented. Use the Place buttons on the overview for recommended picks.
      </div>
    </div>
  );
}
