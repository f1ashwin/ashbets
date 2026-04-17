import { describe, expect, it } from "vitest";
import { freshnessOf } from "@/lib/predictions/staleness";

const NOW = new Date("2026-04-17T12:00:00Z");

describe("freshnessOf", () => {
  it("treats 0 age as fresh", () => {
    const r = freshnessOf(NOW, NOW);
    expect(r.freshness).toBe("fresh");
    expect(r.blockPlacement).toBe(false);
  });

  it("marks 3h old as fresh", () => {
    const r = freshnessOf(new Date("2026-04-17T09:00:00Z"), NOW);
    expect(r.freshness).toBe("fresh");
  });

  it("marks 5h old as stale but placeable", () => {
    const r = freshnessOf(new Date("2026-04-17T07:00:00Z"), NOW);
    expect(r.freshness).toBe("stale");
    expect(r.blockPlacement).toBe(false);
  });

  it("marks exactly 4h as fresh, not stale (boundary)", () => {
    const r = freshnessOf(new Date("2026-04-17T08:00:00Z"), NOW);
    expect(r.freshness).toBe("fresh");
  });

  it("marks 13h old as expired and blocks placement", () => {
    const r = freshnessOf(new Date("2026-04-16T23:00:00Z"), NOW);
    expect(r.freshness).toBe("expired");
    expect(r.blockPlacement).toBe(true);
  });

  it("clamps negative ages (clock skew) to 0", () => {
    const r = freshnessOf(new Date("2026-04-17T13:00:00Z"), NOW);
    expect(r.ageMs).toBe(0);
    expect(r.freshness).toBe("fresh");
  });
});
