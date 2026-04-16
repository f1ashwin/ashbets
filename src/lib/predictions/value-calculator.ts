/**
 * Value Betting Calculator
 *
 * Core engine for identifying value bets by comparing model probabilities
 * against bookmaker odds. Uses Pinnacle/Betfair as sharp benchmark.
 */

export interface ValueBetSignal {
  outcome: string;
  bookmaker: string;
  odds: number;
  modelProbability: number;
  impliedProbability: number;
  edge: number; // modelProbability - impliedProbability
  ev: number; // expected value per unit staked
  kellyFraction: number; // half-kelly recommended stake as fraction of bankroll
  isValue: boolean; // edge > minimum threshold
}

/**
 * Minimum edge required for a signal to qualify as a value bet.
 * Read from server env MIN_EDGE (default 0.02 = 2%). Must stay server-side —
 * exposing this to the client would let a compromised client bypass the filter.
 */
const MIN_EDGE_THRESHOLD = Number(process.env.MIN_EDGE ?? 0.02);

/**
 * Evaluate whether a bet offers value.
 */
export function evaluateValue(
  modelProbability: number,
  decimalOdds: number,
  bookmaker: string,
  outcome: string
): ValueBetSignal {
  const impliedProb = 1 / decimalOdds;
  const edge = modelProbability - impliedProb;
  const ev = modelProbability * decimalOdds - 1;
  const fullKelly = ev > 0 ? ev / (decimalOdds - 1) : 0;
  const halfKelly = fullKelly * 0.5;

  return {
    outcome,
    bookmaker,
    odds: decimalOdds,
    modelProbability,
    impliedProbability: impliedProb,
    edge,
    ev,
    kellyFraction: Math.min(halfKelly, 0.02), // cap at 2% of bankroll
    isValue: edge >= MIN_EDGE_THRESHOLD && ev > 0,
  };
}

/**
 * Find the best value bet across all bookmakers for an event.
 */
export function findBestValue(
  modelProbabilities: Record<string, number>, // { home: 0.55, draw: 0.25, away: 0.20 }
  bookmakerOdds: Array<{
    bookmaker: string;
    outcomes: Record<string, number>; // { home: 2.1, draw: 3.5, away: 4.0 }
  }>
): ValueBetSignal[] {
  const signals: ValueBetSignal[] = [];

  for (const [outcome, modelProb] of Object.entries(modelProbabilities)) {
    for (const bookie of bookmakerOdds) {
      const odds = bookie.outcomes[outcome];
      if (!odds) continue;

      const signal = evaluateValue(modelProb, odds, bookie.bookmaker, outcome);
      if (signal.isValue) {
        signals.push(signal);
      }
    }
  }

  // Sort by edge descending
  return signals.sort((a, b) => b.edge - a.edge);
}

/**
 * Calculate recommended stake in currency based on Kelly fraction and bankroll.
 * Caller must pass the per-bet cap (MAX_BET_EUR). Cap is the absolute ceiling —
 * the smaller of Kelly-suggested and cap is returned.
 */
export function recommendedStake(
  kellyFraction: number,
  bankroll: number,
  maxBetEur: number
): number {
  const kellyStake = bankroll * kellyFraction;
  return Math.min(kellyStake, maxBetEur);
}

/**
 * Calculate Closing Line Value.
 * Positive CLV = you got better odds than the closing line (good).
 */
export function calculateClv(oddsTaken: number, closingOdds: number): number {
  const impliedTaken = 1 / oddsTaken;
  const impliedClosing = 1 / closingOdds;
  return impliedClosing - impliedTaken;
}

/**
 * Evaluate if a sharp bookmaker (Pinnacle/Betfair) confirms the value.
 * Returns true if soft book odds are better than sharp benchmark.
 */
export function confirmSharpValue(
  softBookOdds: number,
  sharpBookOdds: number
): boolean {
  return softBookOdds > sharpBookOdds;
}
