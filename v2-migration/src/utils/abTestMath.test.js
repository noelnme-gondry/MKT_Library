import { describe, expect, it } from "vitest";
import { STATS } from "./abTestMath";

describe("bayesianAB deterministic grid integration", () => {
  it("returns byte-identical results for the same input", () => {
    const input = { nA: 1000, xA: 100, nB: 1000, xB: 135, sims: 10000 };
    expect(STATS.bayesianAB(input)).toEqual(STATS.bayesianAB(input));
  });

  it("recognizes a clearly stronger B posterior", () => {
    const result = STATS.bayesianAB({ nA: 1000, xA: 80, nB: 1000, xB: 150 });
    expect(result.probBWins).toBeGreaterThan(0.99);
    expect(result.expectedLift).toBeGreaterThan(0);
    expect(result.ciA[0]).toBeLessThan(result.ciA[1]);
    expect(result.ciB[0]).toBeLessThan(result.ciB[1]);
  });

  it("keeps posterior-mean lift finite when control has zero conversions", () => {
    const result = STATS.bayesianAB({ nA: 500, xA: 0, nB: 500, xB: 4 });
    expect(Number.isFinite(result.expectedLift)).toBe(true);
    expect(result.probBWins).toBeGreaterThan(0.5);
  });

  it("resolves a low-rate posterior at million-row scale", () => {
    const result = STATS.bayesianAB({ nA: 1_000_000, xA: 1_000, nB: 1_000_000, xB: 1_200 });
    expect(result.probBWins).toBeGreaterThan(0.999);
    expect(result.ciA[0]).toBeGreaterThan(0.0009);
    expect(result.ciA[1]).toBeLessThan(0.0011);
    expect(result.ciB[0]).toBeGreaterThan(0.0011);
    expect(result.ciB[1]).toBeLessThan(0.0013);
  });

  it("does not collapse sparse million-row posteriors into the same bin", () => {
    const result = STATS.bayesianAB({ nA: 1_000_000, xA: 100, nB: 1_000_000, xB: 150 });
    expect(result.probBWins).toBeGreaterThan(0.99);
    expect(result.ciA).not.toEqual(result.ciB);
  });

  it("refuses a continuous test with no estimable variation", () => {
    expect(STATS.continuousTest(20, 100, 0, 20, 110, 0)).toEqual({ ok: false, reason: "insufficient_variation" });
    expect(STATS.continuousTest(1, 100, 10, 20, 110, 10)).toEqual({ ok: false, reason: "insufficient_variation" });
  });

  it("does not run a proportion test for impossible conversion counts", () => {
    expect(STATS.twoPropZTest(100, 101, 100, 10)).toBeNull();
  });

  it("requires an explicit control arm for mass readout", () => {
    expect(STATS.massReadout([{ name: "A", n: 100, x: 10 }, { name: "B", n: 100, x: 12 }])).toEqual({ control: null, rows: [] });
  });
});
