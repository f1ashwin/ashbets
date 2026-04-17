import { describe, expect, it } from "vitest";
import { tierOf, TIER_THRESHOLDS } from "@/lib/predictions/risk-tier";

describe("tierOf — football", () => {
  it("rejects EV <= 0 regardless of edge", () => {
    const r = tierOf({ modelProbability: 0.7, edge: 0.1, ev: -0.01 }, "football");
    expect(r.tier).toBe("rejected");
  });

  it("rejects when edge below 2% floor", () => {
    const r = tierOf({ modelProbability: 0.6, edge: 0.015, ev: 0.05 }, "football");
    expect(r.tier).toBe("rejected");
  });

  it("classifies 0.55 exactly as high_confidence", () => {
    const r = tierOf({ modelProbability: 0.55, edge: 0.03, ev: 0.05 }, "football");
    expect(r.tier).toBe("high_confidence");
  });

  it("classifies 0.35 as balanced (lower edge of the band)", () => {
    const r = tierOf({ modelProbability: 0.35, edge: 0.03, ev: 0.04 }, "football");
    expect(r.tier).toBe("balanced");
  });

  it("classifies 0.30 with 5% edge as upside", () => {
    const r = tierOf({ modelProbability: 0.3, edge: 0.05, ev: 0.06 }, "football");
    expect(r.tier).toBe("upside");
  });

  it("rejects 0.30 with only 3% edge (below football upside floor)", () => {
    const r = tierOf({ modelProbability: 0.3, edge: 0.03, ev: 0.04 }, "football");
    expect(r.tier).toBe("rejected");
  });
});

describe("tierOf — cricket has higher high-conf floor", () => {
  it("0.58 in cricket is balanced, not high_confidence", () => {
    const r = tierOf({ modelProbability: 0.58, edge: 0.04, ev: 0.05 }, "cricket");
    expect(r.tier).toBe("balanced");
  });

  it("0.62 in cricket is high_confidence", () => {
    const r = tierOf({ modelProbability: 0.62, edge: 0.03, ev: 0.05 }, "cricket");
    expect(r.tier).toBe("high_confidence");
  });

  it("0.40 with 4% edge is rejected in cricket (upside floor is 5%)", () => {
    const r = tierOf({ modelProbability: 0.4, edge: 0.04, ev: 0.05 }, "cricket");
    expect(r.tier).toBe("rejected");
  });

  it("0.40 with 5% edge is upside in cricket", () => {
    const r = tierOf({ modelProbability: 0.4, edge: 0.05, ev: 0.06 }, "cricket");
    expect(r.tier).toBe("upside");
  });
});

describe("threshold table is the canonical source", () => {
  it("football balanced lower bound is 0.35", () => {
    expect(TIER_THRESHOLDS.football.balanced).toBe(0.35);
  });
  it("cricket high-conf floor is 0.62", () => {
    expect(TIER_THRESHOLDS.cricket.highConf).toBe(0.62);
  });
});
