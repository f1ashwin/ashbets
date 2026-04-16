export type Sport = "football" | "cricket";

export type EventStatus = "upcoming" | "live" | "completed" | "cancelled";

export type BetStatus = "pending" | "won" | "lost" | "void" | "cashout";

export type BetType = "single" | "accumulator";

export type Market = "h2h" | "spreads" | "totals" | "moneyline" | "prop";

export type OddsFormat = "decimal" | "american" | "fractional";

export type BankrollTransactionType =
  | "deposit"
  | "withdrawal"
  | "bet_placed"
  | "bet_settled"
  | "adjustment";

export interface SportConfig {
  key: Sport;
  label: string;
  oddsApiKeys: string[];
  icon: string;
  color: string;
  defaultLeagues?: number[];
}

export const SPORT_CONFIGS: Record<Sport, SportConfig> = {
  football: {
    key: "football",
    label: "Football",
    oddsApiKeys: [
      "soccer_epl",
      "soccer_uefa_champions_league",
      "soccer_germany_bundesliga",
      "soccer_spain_la_liga",
      "soccer_italy_serie_a",
      "soccer_france_ligue_one",
    ],
    icon: "circle-dot",
    color: "emerald",
    defaultLeagues: [39, 2, 3, 78, 135, 140, 61],
  },
  cricket: {
    key: "cricket",
    label: "Cricket",
    oddsApiKeys: [],
    icon: "trophy",
    color: "blue",
  },
} as const;
