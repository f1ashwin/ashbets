import { SPORT_CONFIGS, type Sport } from "@/types/sports";

export function getSportConfig(sport: Sport) {
  return SPORT_CONFIGS[sport];
}

export function getOddsApiSportKeys(sport: Sport): string[] {
  return SPORT_CONFIGS[sport].oddsApiKeys;
}

export function getAllSports(): Sport[] {
  return Object.keys(SPORT_CONFIGS) as Sport[];
}

/**
 * Map an Odds API sport key back to our internal sport type.
 */
export function oddsApiKeyToSport(key: string): Sport | null {
  for (const [sport, config] of Object.entries(SPORT_CONFIGS)) {
    if (config.oddsApiKeys.includes(key)) {
      return sport as Sport;
    }
  }
  return null;
}
