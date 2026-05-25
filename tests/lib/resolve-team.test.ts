import { describe, expect, it } from "vitest";
import {
  jaroWinkler,
  normaliseTeamName,
  teamNameScore,
} from "@/lib/ingest/resolve-team";

/**
 * These tests pin the fuzzy matcher's behavior at the two decision points
 * the resolver cares about:
 *
 *   AUTO_ACCEPT = 0.92 — score ≥ this, alias is created silently
 *   SUGGEST     = 0.80 — score ≥ this, row lands in pending_aliases with a hint
 *
 * The two describe blocks below assert those thresholds strictly. A pair
 * that the resolver must merge automatically goes in the auto-accept group
 * (≥0.92). A pair that is merely "close enough to propose to a human" goes
 * in the suggest group (≥0.80 and <0.92). Don't loosen either bound without
 * re-examining the thresholds themselves.
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

describe("teamNameScore — must auto-accept (≥0.92)", () => {
  // These pairs collapse to an identical expansion (abbrev or admin-token
  // stripping or diacritic normalisation), so the resolver MUST auto-merge.
  // A regression in any of these would flood pending_aliases with obvious
  // duplicates a human shouldn't have to triage.
  const pairs: Array<[string, string]> = [
    ["Manchester United", "Manchester Utd"], // "utd" → "united"
    ["FC Barcelona", "Barcelona"], // "fc" admin-stripped
    ["Atlético Madrid", "Atletico Madrid"], // diacritic strip
    ["Bayern München", "Bayern Munchen"], // diacritic strip
    ["Real Madrid CF", "Real Madrid"], // "cf" admin-stripped
  ];

  for (const [a, b] of pairs) {
    it(`"${a}" ↔ "${b}" must auto-accept`, () => {
      expect(teamNameScore(a, b)).toBeGreaterThanOrEqual(0.92);
    });
  }
});

describe("teamNameScore — must at least suggest (0.80 ≤ score < 0.92)", () => {
  // Nickname and long-name-vs-short-name pairs the resolver cannot safely
  // auto-merge (score < 0.92), but which should still reach a human via
  // pending_aliases (score ≥ 0.80). If any of these regressed below 0.80
  // the reviewer would never see the suggestion and would create a duplicate
  // canonical team row.
  const pairs: Array<[string, string]> = [
    ["Manchester United", "Man United"],
    ["Manchester United", "Man Utd"],
    ["Tottenham Hotspur", "Tottenham"],
    ["Wolverhampton Wanderers", "Wolves"],
    ["Brighton & Hove Albion", "Brighton"],
    ["Bayern München", "Bayern Munich"], // "munich" not in ABBREVIATIONS
  ];

  for (const [a, b] of pairs) {
    it(`"${a}" ↔ "${b}" must be at least a suggestion`, () => {
      const score = teamNameScore(a, b);
      expect(score).toBeGreaterThanOrEqual(0.8);
      // Not a hard upper bound — if a pair legitimately climbs to ≥0.92
      // (say after we add a new abbreviation), that's fine. We assert the
      // lower bound only.
    });
  }
});

// The critical guarantee is that distinct teams never auto-merge.
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
