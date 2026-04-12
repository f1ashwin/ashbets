import Link from "next/link";

const navItems = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/football", label: "Football", icon: "⚽" },
  { href: "/mma", label: "UFC / MMA", icon: "🥊" },
  { href: "/cricket", label: "Cricket", icon: "🏏" },
  { href: "/predictions", label: "Value Bets", icon: "🎯" },
  { href: "/bets", label: "Bet Tracker", icon: "📝" },
  { href: "/bankroll", label: "Bankroll", icon: "💰" },
  { href: "/analytics", label: "Analytics", icon: "📈" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-64 border-r border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950 flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <h1 className="text-xl font-bold tracking-tight">PuntLab</h1>
          <p className="text-xs text-gray-500 mt-1">Betting Intelligence</p>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-200 dark:border-gray-800 text-xs text-gray-500">
          <div>Max daily stake: €5</div>
          <div>Strategy: Value betting + CLV</div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
