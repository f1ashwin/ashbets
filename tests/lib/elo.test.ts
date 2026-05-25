import { describe, expect, it } from "vitest";
import { expectedGoals, matchProbabilities } from "@/lib/predictions/elo";

describe("Elo expectedGoals", () => {
  it("returns base rate (1.3) when ratings are equal and home advantage is 0", () => {
    const xG = expectedGoals(1500, 1500, 0);
    expect(xG.home).toBeCloseTo(1.3, 5);
    expect(xG.away).toBeCloseTo(1.3, 5);
  });

  it("yields higher expected goals for stronger team", () => {
    const xG = expectedGoals(1700, 1500, 0);
    expect(xG.home).toBeGreaterThan(1.3);
    expect(xG.away).toBeLessThan(1.3);
    expect(xG.home).toBeGreaterThan(xG.away);
  });

  it("applies home advantage correctly", () => {
    const xG = expectedGoals(1500, 1500, 65);
    expect(xG.home).toBeGreaterThan(1.3);
    expect(xG.away).toBeLessThan(1.3);
  });
});

describe("Elo matchProbabilities with totals", () => {
  it("returns probabilities for football including over25 and under25", () => {
    const probs = matchProbabilities(1600, 1500, "football", true);
    
    // Check 3-way markets
    expect(probs.home).toBeDefined();
    expect(probs.draw).toBeDefined();
    expect(probs.away).toBeDefined();
    expect(probs.home + probs.draw + probs.away).toBeCloseTo(1.0, 1);

    // Check totals markets
    expect(probs.over25).toBeDefined();
    expect(probs.under25).toBeDefined();
    expect(probs.over25 + probs.under25).toBeCloseTo(1.0, 1);
  });

  it("correctly disables home advantage when isNeutral is true", () => {
    const probsNeutral = matchProbabilities(1500, 1500, "football", true);
    const probsHomeAdv = matchProbabilities(1500, 1500, "football", false);

    // With home advantage, home win rate should be higher than away
    expect(probsHomeAdv.home).toBeGreaterThan(probsHomeAdv.away);
    
    // Under neutral conditions, home win rate should equal away win rate
    expect(probsNeutral.home).toEqual(probsNeutral.away);
  });
});
