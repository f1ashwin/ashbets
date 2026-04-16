export default function Home() {
  return (
    <div className="max-w-6xl mx-auto py-8">
      <h1 className="text-3xl font-bold mb-2">PuntLab</h1>
      <p className="text-gray-500 mb-8">
        Sports betting intelligence dashboard — value betting, odds comparison,
        CLV tracking
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="border rounded-lg p-6">
          <div className="text-2xl mb-2">⚽</div>
          <h2 className="text-lg font-semibold">Football</h2>
          <p className="text-sm text-gray-500 mt-1">
            EPL, Champions League, Bundesliga, La Liga
          </p>
          <p className="text-xs text-gray-400 mt-2">
            Models: Dixon-Coles + Elo ensemble
          </p>
        </div>

        <div className="border rounded-lg p-6">
          <div className="text-2xl mb-2">🏏</div>
          <h2 className="text-lg font-semibold">Cricket</h2>
          <p className="text-sm text-gray-500 mt-1">
            IPL, T20, international — venue + form models
          </p>
          <p className="text-xs text-gray-400 mt-2">
            Models: Elo + form + venue
          </p>
        </div>
      </div>

      <div className="border rounded-lg p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">Betting Strategy</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="font-medium">Approach</div>
            <div className="text-gray-500">Value betting with sharp line benchmarks</div>
          </div>
          <div>
            <div className="font-medium">North Star Metric</div>
            <div className="text-gray-500">Closing Line Value (CLV)</div>
          </div>
          <div>
            <div className="font-medium">Bankroll Rule</div>
            <div className="text-gray-500">Half-Kelly, max 2% per bet</div>
          </div>
          <div>
            <div className="font-medium">Per-Bet Cap</div>
            <div className="text-gray-500">€10 max (2% of €500 bankroll)</div>
          </div>
        </div>
      </div>

      <div className="border rounded-lg p-6 bg-gray-50 dark:bg-gray-900">
        <h2 className="text-lg font-semibold mb-2">Setup Status</h2>
        <ul className="space-y-2 text-sm">
          <li className="flex items-center gap-2">
            <span className="text-green-500">✓</span> Project scaffolded
          </li>
          <li className="flex items-center gap-2">
            <span className="text-green-500">✓</span> Database schema defined (8 tables)
          </li>
          <li className="flex items-center gap-2">
            <span className="text-green-500">✓</span> Prediction models (Elo, value calculator, calibration)
          </li>
          <li className="flex items-center gap-2">
            <span className="text-green-500">✓</span> Caching + rate limiting layer
          </li>
          <li className="flex items-center gap-2">
            <span className="text-yellow-500">○</span> Connect Supabase + run migrations
          </li>
          <li className="flex items-center gap-2">
            <span className="text-yellow-500">○</span> API clients (Odds API, API-Football, CricketData)
          </li>
          <li className="flex items-center gap-2">
            <span className="text-yellow-500">○</span> Live odds dashboard
          </li>
          <li className="flex items-center gap-2">
            <span className="text-yellow-500">○</span> Bet tracker + CLV tracking
          </li>
        </ul>
      </div>
    </div>
  );
}
