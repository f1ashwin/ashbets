import { describe, expect, it } from "vitest";
import { evaluateValue, recommendedStake } from "@/lib/predictions/value-calculator";

describe("evaluateValue — raw Kelly", () => {
  it("returns an uncapped half-Kelly fraction so the caller can cap", () => {
    // h2h companions: home 2.0, draw 3.5, away 4.5 (typical h2h market)
    const s = evaluateValue(0.8, 2.0, "tipico", "home", [2.0, 3.5, 4.5]);
    // ev = 0.8 * 2 - 1 = 0.6; fullKelly = 0.6 / 1.0 = 0.6; halfKelly = 0.3
    expect(s.kellyFraction).toBeCloseTo(0.3, 5);
  });

  it("zeroes Kelly when ev <= 0", () => {
    const s = evaluateValue(0.4, 2.0, "tipico", "home", [2.0, 3.5, 4.5]);
    expect(s.kellyFraction).toBe(0);
    expect(s.isValue).toBe(false);
  });
});

describe("recommendedStake — cap walk", () => {
  it("returns kellyStake when all caps are loose", () => {
    // 0.005 Kelly, 1000 bankroll = 5. soft cap 2% = 20. Kelly wins.
    const r = recommendedStake(0.005, 1000);
    expect(r.stake).toBe(5);
    expect(r.boundBy).toBe("kelly");
  });

  it("hard-caps at 5% before soft-capping", () => {
    // Kelly 10%. Without a hard cap we'd end on soft cap. Hard cap clamps
    // first, but soft cap (2%) still binds because it's tighter.
    const r = recommendedStake(0.1, 1000);
    expect(r.stake).toBe(20);
    expect(r.boundBy).toBe("soft_cap");
  });

  it("honors a custom softCap and keeps the override", () => {
    const r = recommendedStake(0.1, 1000, { softCap: 0.03, hardCap: 0.05 });
    expect(r.stake).toBe(30);
    expect(r.boundBy).toBe("soft_cap");
  });

  it("daily-remaining tightens when below soft cap", () => {
    // Soft cap 20, daily remaining 8.
    const r = recommendedStake(0.05, 1000, { dailyRemaining: 8 });
    expect(r.stake).toBe(8);
    expect(r.boundBy).toBe("daily_remaining");
  });

  it("never pays more than maxBetCurrency", () => {
    const r = recommendedStake(0.05, 1000, { maxBetCurrency: 10 });
    expect(r.stake).toBe(10);
    expect(r.boundBy).toBe("max_bet");
  });
});
