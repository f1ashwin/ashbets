"use client";

import { useState } from "react";
import type { MatchBet } from "@/lib/predictions/match-bets";

export function CopyBetButton({
  bet,
  event,
}: {
  bet: MatchBet;
  event: { homeTeam: string; awayTeam: string };
}) {
  const [copied, setCopied] = useState(false);

  const handleClick = async () => {
    const edgePct = (bet.edge * 100).toFixed(1);
    const probPct = (bet.modelProbability * 100).toFixed(1);
    const text = [
      "AshBets Bet Slip",
      `${event.homeTeam} vs ${event.awayTeam} — ${bet.selectionLabel}`,
      `Bookmaker: ${bet.bookmaker} · Odds: ${bet.odds.toFixed(2)} · Stake: €${bet.stake.toFixed(2)}`,
      `Edge: ${edgePct}% · Model prob: ${probPct}%`,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // clipboard may be unavailable in some contexts
    }

    const bookmakerUrl =
      typeof localStorage !== "undefined"
        ? localStorage.getItem("ashbets:bookmaker-url")
        : null;
    if (bookmakerUrl) {
      window.open(bookmakerUrl, "_blank", "noopener,noreferrer");
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
    >
      {copied ? "Copied ✓" : "Copy"}
    </button>
  );
}
