"use client";

import { useEffect, useState, useCallback } from "react";
import type { MatchBet } from "@/lib/predictions/match-bets";
import { PlaceBetButton } from "@/components/predictions/place-bet-button";
import { CopyBetButton } from "@/components/predictions/copy-bet-button";

interface DrawerData {
  event: {
    id: string;
    homeTeam: string;
    awayTeam: string;
    startTime: string;
    league: string | null;
    status: string;
  };
  probabilities: Record<string, number>;
  h2hOdds: Array<{
    bookmaker: string;
    home: number | null;
    draw: number | null;
    away: number | null;
  }>;
  totalsOdds: Array<{
    bookmaker: string;
    over25: number | null;
    under25: number | null;
  }>;
  topBets: MatchBet[];
  hasEloWarning: boolean;
}

const PROB_LABELS: Array<{ key: string; label: string; color: string }> = [
  { key: "home", label: "Home Win", color: "bg-emerald-500" },
  { key: "draw", label: "Draw", color: "bg-amber-400" },
  { key: "away", label: "Away Win", color: "bg-rose-500" },
  { key: "over25", label: "Over 2.5 Goals", color: "bg-sky-500" },
  { key: "under25", label: "Under 2.5 Goals", color: "bg-violet-500" },
];

const MIN_HIGHLIGHT_EDGE = 0.02;

function ValueCell({ odds, edge }: { odds: number | null; edge?: number }) {
  if (odds === null) return <td className="px-3 py-2 text-center text-xs text-gray-400">—</td>;
  const isValue = edge !== undefined && edge >= MIN_HIGHLIGHT_EDGE;
  return (
    <td
      className={`px-3 py-2 text-center text-xs font-mono tabular-nums ${
        isValue
          ? "bg-emerald-50 font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
          : "text-gray-700 dark:text-gray-300"
      }`}
    >
      {odds.toFixed(2)}
    </td>
  );
}

export function MatchOddsDrawer({
  eventId,
  onClose,
}: {
  eventId: string | null;
  onClose: () => void;
}) {
  const [data, setData] = useState<DrawerData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${id}/odds`);
      if (!res.ok) throw new Error("Failed to load odds");
      setData(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (eventId) fetchData(eventId);
    else setData(null);
  }, [eventId, fetchData]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isOpen = eventId !== null;

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Drawer panel */}
      <div
        className={`fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l bg-white shadow-xl transition-transform duration-300 ease-in-out dark:bg-gray-900 dark:border-gray-700 sm:w-[440px] ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b px-5 py-4 dark:border-gray-700">
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {data ? `${data.event.homeTeam} vs ${data.event.awayTeam}` : "Loading…"}
            </p>
            {data && (
              <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                {new Date(data.event.startTime).toLocaleString([], {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                {data.event.league ? `· ${data.event.league}` : ""}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-4 rounded-md p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {loading && (
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading odds…</p>
          )}
          {error && (
            <p className="text-sm text-rose-600">{error}</p>
          )}

          {data && (
            <>
              {/* Elo warning */}
              {data.hasEloWarning && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  ⚠ Elo seed uncertain — model probabilities may be inaccurate for this match.
                </div>
              )}

              {/* Model probability bars */}
              <section>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Model Probabilities
                </h3>
                <div className="space-y-2">
                  {PROB_LABELS.map(({ key, label, color }) => {
                    const prob = data.probabilities[key] ?? 0;
                    return (
                      <div key={key}>
                        <div className="mb-0.5 flex justify-between text-xs text-gray-600 dark:text-gray-400">
                          <span>{label}</span>
                          <span className="font-mono">{(prob * 100).toFixed(1)}%</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                          <div
                            className={`h-full rounded-full ${color}`}
                            style={{ width: `${prob * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* H2H odds table */}
              {data.h2hOdds.length > 0 && (
                <section>
                  <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Match Result (H2H)
                  </h3>
                  <div className="overflow-x-auto rounded-md border dark:border-gray-700">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-800">
                          <th className="px-3 py-2 text-left font-medium text-gray-500">Bookmaker</th>
                          <th className="px-3 py-2 text-center font-medium text-gray-500">Home</th>
                          <th className="px-3 py-2 text-center font-medium text-gray-500">Draw</th>
                          <th className="px-3 py-2 text-center font-medium text-gray-500">Away</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y dark:divide-gray-700">
                        {data.h2hOdds.map((row) => {
                          const best = data.topBets.find(
                            (b) => b.bookmaker === row.bookmaker && b.market === "h2h"
                          );
                          return (
                            <tr key={row.bookmaker} className="odd:bg-white even:bg-gray-50 dark:odd:bg-gray-900 dark:even:bg-gray-800/50">
                              <td className="px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300">
                                {row.bookmaker}
                              </td>
                              <ValueCell
                                odds={typeof row.home === "string" ? Number(row.home) : row.home}
                                edge={best?.selection === "home" ? best.edge : undefined}
                              />
                              <ValueCell
                                odds={typeof row.draw === "string" ? Number(row.draw) : row.draw}
                                edge={best?.selection === "draw" ? best.edge : undefined}
                              />
                              <ValueCell
                                odds={typeof row.away === "string" ? Number(row.away) : row.away}
                                edge={best?.selection === "away" ? best.edge : undefined}
                              />
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* Totals odds table */}
              {data.totalsOdds.length > 0 && (
                <section>
                  <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Total Goals (2.5)
                  </h3>
                  <div className="overflow-x-auto rounded-md border dark:border-gray-700">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-800">
                          <th className="px-3 py-2 text-left font-medium text-gray-500">Bookmaker</th>
                          <th className="px-3 py-2 text-center font-medium text-gray-500">Over 2.5</th>
                          <th className="px-3 py-2 text-center font-medium text-gray-500">Under 2.5</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y dark:divide-gray-700">
                        {data.totalsOdds.map((row) => {
                          const best = data.topBets.find(
                            (b) => b.bookmaker === row.bookmaker && b.market === "totals"
                          );
                          return (
                            <tr key={row.bookmaker} className="odd:bg-white even:bg-gray-50 dark:odd:bg-gray-900 dark:even:bg-gray-800/50">
                              <td className="px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300">
                                {row.bookmaker}
                              </td>
                              <ValueCell
                                odds={typeof row.over25 === "string" ? Number(row.over25) : row.over25}
                                edge={best?.selection === "over" ? best.edge : undefined}
                              />
                              <ValueCell
                                odds={typeof row.under25 === "string" ? Number(row.under25) : row.under25}
                                edge={best?.selection === "under" ? best.edge : undefined}
                              />
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* Recommended bets */}
              {data.topBets.length > 0 && (
                <section>
                  <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Recommended Bets
                  </h3>
                  <div className="space-y-2">
                    {data.topBets.map((bet, i) => (
                      <div
                        key={i}
                        className="rounded-md border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-950/40"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold text-gray-900 dark:text-gray-100">
                              {bet.selectionLabel}
                            </p>
                            <p className="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">
                              {bet.bookmaker} · @{bet.odds.toFixed(2)} · edge{" "}
                              {(bet.edge * 100).toFixed(1)}%
                            </p>
                          </div>
                          <span className="shrink-0 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                            €{bet.stake.toFixed(2)}
                          </span>
                        </div>
                        <div className="mt-2 flex gap-2">
                          <PlaceBetButton
                            payload={{
                              kind: "single",
                              eventId: data.event.id,
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
                            label="Log"
                          />
                          <CopyBetButton
                            bet={bet}
                            event={{ homeTeam: data.event.homeTeam, awayTeam: data.event.awayTeam }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {data.topBets.length === 0 && !loading && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  No value bets found for this match.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
