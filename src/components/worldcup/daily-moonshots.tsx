import type { MoonshotBet } from "@/lib/predictions/moonshots";
import { PlaceBetButton } from "@/components/predictions/place-bet-button";
import { CopyBetButton } from "@/components/predictions/copy-bet-button";
import { formatPercent } from "@/lib/utils/formatters";
import { format } from "date-fns";

export function DailyMoonshots({ moonshots }: { moonshots: MoonshotBet[] }) {
  if (moonshots.length === 0) {
    return (
      <div className="rounded-xl bg-slate-900 px-5 py-4 text-slate-400 text-sm">
        <span className="mr-2">🌙</span>No moonshots today — no long-shot bets with edge &gt; 5% and odds &gt; 4.0 found.
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-slate-900 p-5 text-white shadow-md">
      <div className="mb-4">
        <h2 className="text-base font-bold text-white">🌙 Today&apos;s Moonshots</h2>
        <p className="mt-0.5 text-xs text-slate-400">
          High-edge long shots · odds &gt; 4.0 · edge &gt; 5% · max €{(moonshots[0]?.stake ?? 0) > 0 ? "1–2" : "1"} each
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {moonshots.map((m, i) => (
          <div
            key={i}
            className="rounded-lg border border-slate-700 bg-slate-800 p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-300">
                  {m.homeTeam} vs {m.awayTeam}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-500">
                  {format(new Date(m.startTime), "EEE, MMM d · HH:mm")}
                </p>
                <p className="mt-1.5 text-sm font-bold text-white">{m.selectionLabel}</p>
                <div className="mt-1 flex gap-3 text-[10px] text-slate-400">
                  <span>
                    @<span className="font-mono font-semibold text-amber-300">{m.odds.toFixed(2)}</span>
                  </span>
                  <span>
                    edge <span className="font-mono font-semibold text-emerald-400">{formatPercent(m.edge)}</span>
                  </span>
                  <span>
                    EV <span className="font-mono font-semibold text-sky-400">+{formatPercent(m.ev)}</span>
                  </span>
                </div>
                <p className="mt-0.5 text-[10px] text-slate-500">{m.bookmaker}</p>
              </div>
              <span className="shrink-0 text-sm font-semibold text-amber-300">
                €{m.stake.toFixed(2)}
              </span>
            </div>

            <div className="mt-3 flex gap-2">
              <PlaceBetButton
                payload={{
                  kind: "single",
                  eventId: m.eventId,
                  sport: "football",
                  market: m.market,
                  selection: m.selectionLabel,
                  outcome: m.selection,
                  bookmaker: m.bookmaker,
                  odds: m.odds,
                  modelProbability: m.modelProbability,
                  edge: m.edge,
                  stake: m.stake,
                }}
                label={`Log €${m.stake.toFixed(2)}`}
              />
              <CopyBetButton
                bet={{
                  market: m.market,
                  selection: m.selection,
                  selectionLabel: m.selectionLabel,
                  bookmaker: m.bookmaker,
                  odds: m.odds,
                  edge: m.edge,
                  stake: m.stake,
                  modelProbability: m.modelProbability,
                  hasEloWarning: false,
                }}
                event={{ homeTeam: m.homeTeam, awayTeam: m.awayTeam }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
