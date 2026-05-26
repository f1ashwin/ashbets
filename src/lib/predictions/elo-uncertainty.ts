/**
 * Teams whose WC 2026 Elo seed is unreliable.
 *
 * OVERSEEDED at default 1500 (new teams never seen in our data):
 *   Qatar, Iraq, Haiti, Curaçao, Cape Verde, DR Congo, Uzbekistan,
 *   Panama, Jordan, New Zealand, Bosnia & Herzegovina, South Africa, Paraguay
 *
 * UNDERSEEDED at 1350 (seeded in "Others" tier but clearly stronger):
 *   Norway (Haaland), Sweden, Turkey (Euro 2024 QF), Egypt (AFCON),
 *   Ivory Coast (AFCON 2023 winner)
 *
 * Keys must match events.homeTeam / events.awayTeam exactly (canonical names
 * after alias resolution). Verify against the `teams` table if unsure.
 */
export const ELO_UNCERTAIN_TEAMS = new Set<string>([
  "Qatar",
  "Iraq",
  "Haiti",
  "Curaçao",
  "Cape Verde",
  "DR Congo",
  "Uzbekistan",
  "Panama",
  "Jordan",
  "New Zealand",
  "Bosnia & Herzegovina",
  "South Africa",
  "Paraguay",
  "Norway",
  "Sweden",
  "Turkey",
  "Egypt",
  "Ivory Coast",
]);

export function hasEloUncertainty(homeTeam: string, awayTeam: string): boolean {
  return ELO_UNCERTAIN_TEAMS.has(homeTeam) || ELO_UNCERTAIN_TEAMS.has(awayTeam);
}
