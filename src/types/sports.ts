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
  markets: Market[];
  icon: string;
  color: string;
  defaultLeagues?: number[];
}

export const SPORT_CONFIGS: Record<Sport, SportConfig> = {
  football: {
    key: "football",
    label: "Football",
    oddsApiKeys: ["soccer_fifa_world_cup"],
    markets: ["h2h", "totals"],
    icon: "circle-dot",
    color: "emerald",
    defaultLeagues: [39, 2, 3, 78, 135, 140, 61],
  },
  cricket: {
    key: "cricket",
    label: "Cricket",
    oddsApiKeys: [],
    markets: ["h2h"],
    icon: "trophy",
    color: "blue",
  },
} as const;
