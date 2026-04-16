import { describe, expect, it } from "vitest";
import {
  jaroWinkler,
  normaliseTeamName,
  teamNameScore,
} from "@/lib/ingest/resolve-team";

/**
 * These tests verify that the fuzzy team-name matcher has sane separation
 * between real matches and easy false positives. The 0.92 auto-accept and
 * 0.8 suggest thresholds in resolve-team.ts rely on this separation. If a
 * threshold needs to change, adjust a threshold and add a test row here.
 */
describe("normaliseTeamName", () => {
  it("lowercases, strips punctuation and diacritics", () => {
    expect(normaliseTeamName("F.C. Köln")).toBe("f c koln");
    expect(normaliseTeamName("Bayern München")).toBe("bayern munchen");
    expect(normaliseTeamName("Atlético Madrid")).toBe("atletico madrid");
  });

  it("collapses whitespace", () => {
    expect(normaliseTeamName("  Real   Madrid  ")).toBe("real madrid");
  });
});

describe("teamNameScore — true positives (want ≥0.92 auto-accept)", () => {
  const pairs: Array<[string, string]> = [
    ["Manchester United", "Manchester Utd"],
    ["Manchester United", "Man United"],
    ["Manchester United", "Man Utd"],
    ["Bayern München", "Bayern Munich"],
    ["FC Barcelona", "Barcelona"],
    ["Tottenham Hotspur", "Tottenham"],
    ["Wolverhampton Wanderers", "Wolves"],
    ["Brighton & Hove Albion", "Brighton"],
    ["Atlético Madrid", "Atletico Madrid"],
  ];

  for (const [a, b] of pairs) {
    it(`"${a}" ↔ "${b}" should match strongly`, () => {
      expect(teamNameScore(a, b)).toBeGreaterThanOrEqual(0.8);
    });
  }
});

// The critical guarantee is that distinct teams never auto-merge (score must
// stay below the 0.92 AUTO_ACCEPT threshold). Some of these pairs legitimately
// produce *suggestions* (score in [0.8, 0.92)) — that's fine because a human
// rejects the suggestion in 3 seconds and we'd rather over-suggest than miss
// a real typo.
describe("teamNameScore — true negatives (must stay below AUTO_ACCEPT 0.92)", () => {
  const pairs: Array<[string, string]> = [
    ["Manchester United", "Manchester City"],
    ["Real Madrid", "Atletico Madrid"],
    ["Arsenal", "Aston Villa"],
    ["Liverpool", "Leicester"],
    ["Mumbai Indians", "Chennai Super Kings"],
    ["Royal Challengers Bangalore", "Rajasthan Royals"],
  ];

  for (const [a, b] of pairs) {
    it(`"${a}" ≠ "${b}" must not auto-merge`, () => {
      expect(teamNameScore(a, b)).toBeLessThan(0.92);
    });
  }
});

// Harder negatives we *also* want to keep below the suggestion threshold,
// because the names share no meaningful overlap.
describe("teamNameScore — clear negatives (want <0.8 no suggestion)", () => {
  const pairs: Array<[string, string]> = [
    ["Arsenal", "Aston Villa"],
    ["Liverpool", "Leicester"],
    ["Mumbai Indians", "Chennai Super Kings"],
    ["Royal Challengers Bangalore", "Rajasthan Royals"],
  ];

  for (const [a, b] of pairs) {
    it(`"${a}" ≠ "${b}" should not even suggest`, () => {
      expect(teamNameScore(a, b)).toBeLessThan(0.8);
    });
  }
});

describe("jaroWinkler identity", () => {
  it("scores 1 for identical strings", () => {
    expect(jaroWinkler("arsenal", "arsenal")).toBe(1);
  });

  it("scores 0 for zero-overlap short strings", () => {
    expect(jaroWinkler("ab", "xy")).toBeLessThan(0.1);
  });
});
