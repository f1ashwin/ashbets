"use client";

import { useState, useCallback } from "react";
import { format } from "date-fns";
import type { MatchBet } from "@/lib/predictions/match-bets";
import { PlaceBetButton } from "@/components/predictions/place-bet-button";
import { MatchOddsDrawer } from "@/components/worldcup/match-odds-drawer";
import { formatCurrency, formatOdds, formatPercent } from "@/lib/utils/formatters";

export interface MatchCardData {
  event: {
    id: string;
    homeTeam: string;
    awayTeam: string;
    startTime: string; // ISO string, serialized from server
    league: string | null;
    status: string;
  };
  topBets: MatchBet[];
  hasEloWarning: boolean;
}

export interface DayGroup {
  dayKey: string;
  label: string;
  isToday: boolean;
  cards: MatchCardData[];
}

export function WorldCupSchedule({
  grouped,
  minEdge,
}: {
  grouped: DayGroup[];
  minEdge: number;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleClose = useCallback(() => setSelectedId(null), []);

  return (
    <>
      <div className="flex flex-col gap-6">
        {grouped.map((day) => (
          <section key={day.dayKey} className="flex flex-col gap-4">
            <h2 className="border-b border-gray-200 pb-1 text-lg font-bold text-gray-800 dark:border-gray-800 dark:text-gray-200">
              {day.label}{" "}
              {day.isToday && (
                <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-normal text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                  Today
                </span>
              )}
            </h2>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {day.cards.map((card) => (
                <MatchCardItem
                  key={card.event.id}
                  card={card}
                  minEdge={minEdge}
                  onOpen={() => setSelectedId(card.event.id)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <MatchOddsDrawer eventId={selectedId} onClose={handleClose} />
    </>
  );
}

function MatchCardItem({
  card,
  minEdge,
  onOpen,
}: {
  card: MatchCardData;
  minEdge: number;
  onOpen: () => void;
}) {
  const timeStr = format(new Date(card.event.startTime), "HH:mm");

  return (
    <div className="flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
      {/* Clickable header row */}
      <button
        type="button"
        onClick={onOpen}
        className="w-full text-left"
        aria-label={`Open odds for ${card.event.homeTeam} vs ${card.event.awayTeam}`}
      >
        <div className="flex items-center justify-between border-b border-gray-100 pb-3 dark:border-gray-800">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
              {card.event.homeTeam}
            </span>
            <span className="text-xs text-gray-400">vs</span>
            <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
              {card.event.awayTeam}
            </span>
            {card.hasEloWarning && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                ⚠ Elo uncertain
              </span>
            )}
          </div>
          <span className="rounded bg-emerald-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
            {timeStr}
          </span>
        </div>
      </button>

      {/* Bet recommendations */}
      {card.topBets.length === 0 ? (
        <div className="flex cursor-pointer items-center justify-center py-6 text-xs italic text-gray-400" onClick={onOpen}>
          No value bets (edge &lt; {formatPercent(minEdge, 0)}) — tap to view odds
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {card.topBets.map((bet) => (
            <div
              key={bet.market + bet.selection}
              className="flex flex-col justify-between rounded-lg border border-gray-100 bg-gray-50/50 p-3 dark:border-gray-800 dark:bg-gray-950/20"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="rounded bg-gray-200/50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                    {bet.market === "h2h" ? "Match Result" : "Totals"}
                  </span>
                  <span className="text-[10px] font-medium text-gray-500">{bet.bookmaker}</span>
                </div>
                <div className="mt-2 text-sm font-bold text-gray-800 dark:text-gray-200">
                  {bet.selectionLabel}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-1 border-t border-gray-100 pt-2 text-[10px] dark:border-gray-800">
                <div>
                  <span className="text-gray-500">Odds</span>
                  <div className="font-mono font-bold text-gray-950 dark:text-gray-50">
                    {formatOdds(bet.odds, "decimal")}
                  </div>
                </div>
                <div>
                  <span className="text-gray-500">Edge</span>
                  <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {formatPercent(bet.edge)}
                  </div>
                </div>
                <div>
                  <span className="text-gray-500">Stake</span>
                  <div className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    {formatCurrency(bet.stake)}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={onOpen}
                  className="text-[10px] text-emerald-600 underline underline-offset-2 hover:text-emerald-700 dark:text-emerald-400"
                >
                  View odds →
                </button>
                <PlaceBetButton
                  payload={{
                    kind: "single",
                    eventId: card.event.id,
                    sport: "football",
                    market: bet.market,
                    selection: bet.selectionLabel,
                    outcome: bet.selection,
                    bookmaker: bet.bookmaker,
                    odds: bet.odds,
                    modelProbability: bet.modelProbability,
                    edge: bet.edge,
                    stake: bet.stake,
                  }}
                  label={`Log ${formatCurrency(bet.stake)}`}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
