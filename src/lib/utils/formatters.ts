import { formatDistanceToNowStrict } from "date-fns";
import type { OddsFormat } from "@/types/sports";

/**
 * Convert decimal odds to the specified format.
 * All odds are stored as decimal internally.
 */
export function formatOdds(decimal: number, format: OddsFormat): string {
  switch (format) {
    case "decimal":
      return decimal.toFixed(2);
    case "american":
      return decimalToAmerican(decimal);
    case "fractional":
      return decimalToFractional(decimal);
    default:
      return decimal.toFixed(2);
  }
}

function decimalToAmerican(decimal: number): string {
  if (decimal >= 2.0) {
    return `+${Math.round((decimal - 1) * 100)}`;
  }
  return `${Math.round(-100 / (decimal - 1))}`;
}

function decimalToFractional(decimal: number): string {
  const numerator = decimal - 1;
  // Find a reasonable fraction
  const precision = 100;
  const gcdValue = gcd(Math.round(numerator * precision), precision);
  const num = Math.round(numerator * precision) / gcdValue;
  const den = precision / gcdValue;
  return `${num}/${den}`;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * Calculate implied probability from decimal odds.
 */
export function impliedProbability(decimalOdds: number): number {
  return 1 / decimalOdds;
}

/**
 * Calculate expected value.
 * Returns a value > 0 for positive EV bets.
 */
export function expectedValue(probability: number, decimalOdds: number): number {
  return probability * decimalOdds - 1;
}

/**
 * Calculate Half-Kelly stake as a fraction of bankroll.
 * Returns 0 if the bet has negative or zero edge.
 */
export function halfKellyFraction(probability: number, decimalOdds: number): number {
  const fullKelly = (probability * decimalOdds - 1) / (decimalOdds - 1);
  if (fullKelly <= 0) return 0;
  return fullKelly * 0.5;
}

/**
 * Format currency amount.
 */
export function formatCurrency(amount: number, currency = "EUR"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format percentage.
 */
export function formatPercent(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Short human-readable age: "3h 42m ago", "2d ago". Used by the freshness
 * badge so the user sees both the age and the tier (green/amber/red).
 */
export function formatAge(recordedAt: Date | string | number): string {
  const date =
    typeof recordedAt === "string" || typeof recordedAt === "number"
      ? new Date(recordedAt)
      : recordedAt;
  return `${formatDistanceToNowStrict(date)} ago`;
}
