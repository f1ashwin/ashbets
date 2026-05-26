/**
 * Value Betting Calculator
 *
 * Core engine for identifying value bets by comparing model probabilities
 * against bookmaker odds. Uses Pinnacle/Betfair as sharp benchmark.
 *
 * Kelly capping lives in `recommendedStake()`, not in `evaluateValue()`. The
 * raw kellyFraction stays uncapped so the tier classifier and UI can reason
 * about the true size the model wants; the caller applies soft (2%) or hard
 * (5%) caps depending on risk tolerance and remaining daily spend.
 */

export interface ValueBetSignal {
  outcome: string;
  bookmaker: string;
  odds: number;
  modelProbability: number;
  impliedProbability: number; // vig-stripped fair probability
  edge: number; // modelProbability - impliedProbability (vig-stripped)
  ev: number; // expected value per unit staked
  kellyFraction: number; // uncapped half-Kelly fraction of bankroll
  isValue: boolean; // edge > minimum threshold && ev > 0
}

/**
 * Strip the bookmaker's vig from a set of raw decimal odds using the
 * proportional method: normalize each raw implied probability so the set
 * sums to exactly 1.0 (100%).
 *
 * Example: h2h market [2.10, 3.40, 3.60] — raw implied probs sum to 108.2%.
 * After stripping: [home=44.2%, draw=27.3%, away=28.5%] — sums to 100%.
 *
 * @param targetOdds   The decimal odds for the specific outcome being evaluated
 * @param allOutcomeOdds All decimal odds in the same market (including targetOdds)
 */
export function vigStrippedProb(targetOdds: number, allOutcomeOdds: number[]): number {
  const rawImplied = allOutcomeOdds.map((o) => 1 / o);
  const overround = rawImplied.reduce((s, p) => s + p, 0);
  if (overround <= 0) return 1 / targetOdds; // fallback to raw if degenerate
  return (1 / targetOdds) / overround;
}

/**
 * Minimum edge required for a signal to qualify as a value bet.
 * Read from server env MIN_EDGE (default 0.02 = 2%). Must stay server-side —
 * exposing this to the client would let a compromised client bypass the filter.
 */
const MIN_EDGE_THRESHOLD = Number(process.env.MIN_EDGE ?? 0.02);

export function evaluateValue(
  modelProbability: number,
  decimalOdds: number,
  bookmaker: string,
  outcome: string,
  allOutcomeOdds: number[]
): ValueBetSignal {
  const impliedProb = vigStrippedProb(decimalOdds, allOutcomeOdds);
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
    kellyFraction: halfKelly,
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

      const allOdds = Object.values(bookie.outcomes).filter((o) => o > 0);
      const signal = evaluateValue(modelProb, odds, bookie.bookmaker, outcome, allOdds);
      if (signal.isValue) {
        signals.push(signal);
      }
    }
  }

  return signals.sort((a, b) => b.edge - a.edge);
}

export interface StakeOptions {
  /** Soft per-bet cap as fraction of bankroll (default 2%). */
  softCap?: number;
  /** Hard per-bet cap as fraction of bankroll (default 5%). Never exceeded. */
  hardCap?: number;
  /** Remaining daily spend in currency. If set, stake is also capped here. */
  dailyRemaining?: number;
  /** Absolute per-bet cap in currency (e.g. €10). Optional. */
  maxBetCurrency?: number;
}

export interface RecommendedStakeResult {
  stake: number;
  boundBy: "kelly" | "soft_cap" | "hard_cap" | "daily_remaining" | "max_bet";
}

/**
 * Compute the recommended stake in currency from a half-Kelly fraction.
 * Returns both the stake and which constraint bound it — useful for the
 * reasoning drawer ("2% soft cap" vs "daily cap reached").
 *
 * Ordering of checks matters. We start from the Kelly-suggested stake and
 * walk down: hard cap clamps first, then the tighter of soft cap and daily
 * remaining, then an absolute currency cap.
 */
export function recommendedStake(
  kellyFraction: number,
  bankroll: number,
  opts: StakeOptions = {}
): RecommendedStakeResult {
  const softCap = opts.softCap ?? 0.02;
  const hardCap = opts.hardCap ?? 0.05;

  const kellyStake = Math.max(0, bankroll * kellyFraction);
  const hardCapStake = bankroll * hardCap;
  const softCapStake = bankroll * softCap;

  let stake = kellyStake;
  let boundBy: RecommendedStakeResult["boundBy"] = "kelly";

  if (stake > hardCapStake) {
    stake = hardCapStake;
    boundBy = "hard_cap";
  }
  if (stake > softCapStake) {
    stake = softCapStake;
    boundBy = "soft_cap";
  }
  if (opts.dailyRemaining !== undefined && stake > opts.dailyRemaining) {
    stake = Math.max(0, opts.dailyRemaining);
    boundBy = "daily_remaining";
  }
  if (opts.maxBetCurrency !== undefined && stake > opts.maxBetCurrency) {
    stake = opts.maxBetCurrency;
    boundBy = "max_bet";
  }

  return { stake, boundBy };
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
