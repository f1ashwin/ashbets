import { describe, expect, it } from "vitest";
import { buildLadders, type ComboCandidate } from "@/lib/predictions/combo";

function candidate(
  overrides: Partial<ComboCandidate> & {
    eventId: string;
    tier: ComboCandidate["tier"];
    modelProbability: number;
    odds: number;
  }
): ComboCandidate {
  return {
    eventId: overrides.eventId,
    sport: overrides.sport ?? "football",
    tier: overrides.tier,
    label: overrides.label ?? `${overrides.eventId} bet`,
    eventTime: overrides.eventTime ?? new Date("2026-04-17T18:00:00Z"),
    signal: {
      outcome: "home",
      bookmaker: "tipico",
      odds: overrides.odds,
      modelProbability: overrides.modelProbability,
      impliedProbability: 1 / overrides.odds,
      edge: overrides.modelProbability - 1 / overrides.odds,
      ev: overrides.modelProbability * overrides.odds - 1,
      kellyFraction: 0.01,
      isValue: true,
    },
  };
}

describe("buildLadders — Safe ladder", () => {
  it("combines two high_confidence legs from distinct events", () => {
    const cs: ComboCandidate[] = [
      candidate({ eventId: "e1", tier: "high_confidence", modelProbability: 0.6, odds: 1.8 }),
      candidate({ eventId: "e2", tier: "high_confidence", modelProbability: 0.58, odds: 1.85 }),
      candidate({ eventId: "e3", tier: "balanced", modelProbability: 0.4, odds: 2.6 }),
    ];
    const { safe } = buildLadders(cs);
    expect(safe).not.toBeNull();
    expect(safe!.legs).toHaveLength(2);
    expect(new Set(safe!.legs.map((l) => l.eventId)).size).toBe(2);
  });

  it("returns null when only one high_conf candidate exists", () => {
    const cs: ComboCandidate[] = [
      candidate({ eventId: "e1", tier: "high_confidence", modelProbability: 0.6, odds: 1.8 }),
    ];
    expect(buildLadders(cs).safe).toBeNull();
  });

  it("refuses two legs from the same event", () => {
    // Two 'high_confidence' signals on the same event — must not combine.
    const cs: ComboCandidate[] = [
      candidate({ eventId: "same", tier: "high_confidence", modelProbability: 0.6, odds: 1.8 }),
      candidate({ eventId: "same", tier: "high_confidence", modelProbability: 0.58, odds: 1.85 }),
    ];
    expect(buildLadders(cs).safe).toBeNull();
  });
});

describe("buildLadders — correlation discount gates combinedEV", () => {
  it("rejects a ladder whose EV becomes negative after the 7% discount", () => {
    // Two legs whose raw EV is marginal. 0.5 * 0.5 * 2.0 * 2.0 = 1.0 → EV 0.
    // Discounted: 0.93 * 1.0 - 1 = -0.07 → reject.
    const cs: ComboCandidate[] = [
      candidate({ eventId: "e1", tier: "high_confidence", modelProbability: 0.5, odds: 2.0 }),
      candidate({ eventId: "e2", tier: "high_confidence", modelProbability: 0.5, odds: 2.0 }),
    ];
    expect(buildLadders(cs).safe).toBeNull();
  });
});

describe("buildLadders — Balanced ladder", () => {
  it("produces an anchor + 2 balanced legs from distinct events", () => {
    const cs: ComboCandidate[] = [
      candidate({ eventId: "h1", tier: "high_confidence", modelProbability: 0.6, odds: 1.8 }),
      candidate({ eventId: "b1", tier: "balanced", modelProbability: 0.45, odds: 2.4 }),
      candidate({ eventId: "b2", tier: "balanced", modelProbability: 0.42, odds: 2.5 }),
      candidate({ eventId: "b3", tier: "balanced", modelProbability: 0.4, odds: 2.6 }),
    ];
    const { balanced } = buildLadders(cs);
    expect(balanced).not.toBeNull();
    expect(balanced!.legs).toHaveLength(3);
    expect(balanced!.legs.filter((l) => l.tier === "high_confidence")).toHaveLength(1);
    expect(balanced!.legs.filter((l) => l.tier === "balanced")).toHaveLength(2);
    expect(new Set(balanced!.legs.map((l) => l.eventId)).size).toBe(3);
  });
});

describe("buildLadders — Moonshot is gated by EV", () => {
  it("returns null if upside pool is empty", () => {
    const cs: ComboCandidate[] = [
      candidate({ eventId: "h1", tier: "high_confidence", modelProbability: 0.6, odds: 1.8 }),
    ];
    expect(buildLadders(cs).moonshot).toBeNull();
  });

  it("produces a combo when 2 upside legs survive the discount", () => {
    const cs: ComboCandidate[] = [
      candidate({ eventId: "u1", tier: "upside", modelProbability: 0.3, odds: 3.8 }),
      candidate({ eventId: "u2", tier: "upside", modelProbability: 0.28, odds: 4.1 }),
    ];
    const { moonshot } = buildLadders(cs);
    expect(moonshot).not.toBeNull();
    expect(moonshot!.combinedEV).toBeGreaterThan(0);
  });
});

describe("buildLadders — Kelly fraction is tight", () => {
  it("caps 2-leg combos at 1% of bankroll", () => {
    const cs: ComboCandidate[] = [
      // High-EV pair to force a big uncapped Kelly.
      candidate({ eventId: "e1", tier: "high_confidence", modelProbability: 0.7, odds: 1.8 }),
      candidate({ eventId: "e2", tier: "high_confidence", modelProbability: 0.68, odds: 1.85 }),
    ];
    const { safe } = buildLadders(cs);
    expect(safe!.kellyFraction).toBeLessThanOrEqual(0.01);
  });

  it("caps 3-leg combos at 0.5% of bankroll", () => {
    const cs: ComboCandidate[] = [
      candidate({ eventId: "h1", tier: "high_confidence", modelProbability: 0.7, odds: 1.8 }),
      candidate({ eventId: "b1", tier: "balanced", modelProbability: 0.5, odds: 2.3 }),
      candidate({ eventId: "b2", tier: "balanced", modelProbability: 0.48, odds: 2.4 }),
    ];
    const { balanced } = buildLadders(cs);
    expect(balanced!.kellyFraction).toBeLessThanOrEqual(0.005);
  });
});
