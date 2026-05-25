/**
 * Elo Rating System
 *
 * Maintains ratings for teams/fighters across sports.
 * Used as one input to the ensemble prediction model.
 */

const DEFAULT_RATING = 1500;
const HOME_ADVANTAGE = 65; // ~65 Elo points for home advantage in football

/** K-factors tuned per sport */
const K_FACTORS: Record<string, number> = {
  football: 20,
  cricket: 25,
};

export interface EloUpdate {
  entity: string;
  sport: string;
  oldRating: number;
  newRating: number;
  change: number;
}

/**
 * Calculate expected win probability based on Elo difference.
 */
export function expectedProbability(
  ratingA: number,
  ratingB: number,
  homeAdvantage = 0
): number {
  const adjustedA = ratingA + homeAdvantage;
  return 1 / (1 + Math.pow(10, (ratingB - adjustedA) / 400));
}

/**
 * Update Elo ratings after a match result.
 *
 * @param ratingA Current rating of team/fighter A
 * @param ratingB Current rating of team/fighter B
 * @param scoreA Actual outcome for A (1 = win, 0.5 = draw, 0 = loss)
 * @param sport Sport key for K-factor selection
 * @param isHome Whether A is the home team (adds home advantage to expected calc)
 */
export function updateRatings(
  ratingA: number,
  ratingB: number,
  scoreA: number,
  sport: string,
  isHome = false
): { newRatingA: number; newRatingB: number } {
  const k = K_FACTORS[sport] ?? 20;
  const homeAdv = isHome ? HOME_ADVANTAGE : 0;

  const expectedA = expectedProbability(ratingA, ratingB, homeAdv);
  const expectedB = 1 - expectedA;

  const newRatingA = ratingA + k * (scoreA - expectedA);
  const newRatingB = ratingB + k * (1 - scoreA - expectedB);

  return {
    newRatingA: Math.round(newRatingA * 100) / 100,
    newRatingB: Math.round(newRatingB * 100) / 100,
  };
}

/**
 * Convert Elo-based win probability to decimal odds.
 */
export function probabilityToOdds(probability: number): number {
  if (probability <= 0) return Infinity;
  if (probability >= 1) return 1;
  return Math.round((1 / probability) * 100) / 100;
}

/**
 * Calculate expected goals for home and away teams based on Elo ratings.
 */
export function expectedGoals(
  ratingHome: number,
  ratingAway: number,
  homeAdvantage = 0
): { home: number; away: number } {
  const ratingDiff = (ratingHome + homeAdvantage) - ratingAway;
  const baseRate = 1.3;
  const homeXg = baseRate * Math.exp(ratingDiff / 400);
  const awayXg = baseRate * Math.exp(-ratingDiff / 400);
  return { home: homeXg, away: awayXg };
}

/**
 * Generate match probabilities from Elo ratings.
 * For football (3-way): uses historical draw rate to split, and calculates Under/Over 2.5 totals.
 * For cricket (2-way): direct probability.
 */
export function matchProbabilities(
  ratingHome: number,
  ratingAway: number,
  sport: string,
  isNeutral = false
): Record<string, number> {
  const homeAdv = (sport === "football" && !isNeutral) ? HOME_ADVANTAGE : 0;
  const homeWinProb = expectedProbability(ratingHome, ratingAway, homeAdv);

  if (sport === "football") {
    // Approximate draw probability based on how close the match is
    // Draws are more likely when teams are evenly matched
    const drawBase = 0.25;
    const eloDiff = Math.abs((ratingHome + homeAdv) - ratingAway);
    const drawAdjust = Math.max(0, drawBase - eloDiff / 2000);
    const drawProb = drawAdjust;

    const adjustedHome = homeWinProb * (1 - drawProb);
    const adjustedAway = (1 - homeWinProb) * (1 - drawProb);

    // Totals market: Over/Under 2.5 goals using Poisson approximation
    const xG = expectedGoals(ratingHome, ratingAway, homeAdv);
    const lambda = xG.home + xG.away;
    const probUnder25 = Math.exp(-lambda) * (1 + lambda + (lambda * lambda) / 2);
    const probOver25 = 1 - probUnder25;

    return {
      home: Math.round(adjustedHome * 1000) / 1000,
      draw: Math.round(drawProb * 1000) / 1000,
      away: Math.round(adjustedAway * 1000) / 1000,
      over25: Math.round(probOver25 * 1000) / 1000,
      under25: Math.round(probUnder25 * 1000) / 1000,
    };
  }

  // 2-way sport (cricket)
  return {
    home: Math.round(homeWinProb * 1000) / 1000,
    away: Math.round((1 - homeWinProb) * 1000) / 1000,
  };
}
