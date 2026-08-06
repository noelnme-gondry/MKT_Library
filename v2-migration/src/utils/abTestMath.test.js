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

  it.each([
    { df: 1, critical: 12.7062047362 },
    { df: 2, critical: 4.30265272975 },
    { df: 2.5, critical: 3.57465484201 },
    { df: 5, critical: 2.57058183564 },
    { df: 10, critical: 2.22813885199 },
    { df: 30, critical: 2.0422724563 },
    { df: 100, critical: 1.98397151852 },
    { df: 1_000_000, critical: 1.95996635699 },
  ])("matches the two-sided 5% Student-t boundary at df=$df", ({ df, critical }) => {
    expect(STATS.studentTCDF(critical, df)).toBeCloseTo(0.975, 9);
    expect(STATS.studentTCDF(-critical, df)).toBeCloseTo(0.025, 9);
  });

  it("uses the exact small-sample Student-t distribution for Welch p-value and CI", () => {
    const criticalDf2 = 4.30265272975;
    const result = STATS.continuousTest(2, 100, 1, 2, 100 + criticalDf2, 1);

    expect(result.ok).toBe(true);
    expect(result.df).toBeCloseTo(2, 12);
    expect(result.z).toBeCloseTo(criticalDf2, 10);
    expect(result.pValue).toBeCloseTo(0.05, 10);
    expect(result.ciLow95).toBeCloseTo(0, 10);
    expect(result.ciHigh95).toBeCloseTo(2 * criticalDf2, 10);
  });

  it("uses the normal limit consistently for extremely large Welch degrees of freedom", () => {
    const z975 = 1.95996398454;
    expect(STATS.studentTCDF(z975, 1e15)).toBeCloseTo(0.975, 6);
    expect(STATS.studentTCDF(z975, Infinity)).toBeCloseTo(0.975, 6);

    const n = 500_000_000_000_001;
    const se = Math.sqrt(2 / n);
    const result = STATS.continuousTest(n, 100, 1, n, 100 + z975 * se, 1);
    expect(result.ok).toBe(true);
    expect(result.df).toBeGreaterThanOrEqual(1e15);
    expect(result.pValue).toBeCloseTo(0.05, 6);
    expect(result.ciLow95).toBeCloseTo(0, 6);
  });

  it("blocks non-finite or underflowed Welch derivations", () => {
    expect(STATS.continuousTest(2, 0, Number.MAX_VALUE, 2, 1, Number.MAX_VALUE)).toEqual({ ok: false, reason: "numerical_error" });
    expect(STATS.continuousTest(2, -Number.MAX_VALUE, 1, 2, Number.MAX_VALUE, 1)).toEqual({ ok: false, reason: "numerical_error" });
    expect(STATS.continuousTest(2, 0, Number.MIN_VALUE, 2, 1, Number.MIN_VALUE)).toEqual({ ok: false, reason: "numerical_error" });
  });

  it("does not run a proportion test for impossible conversion counts", () => {
    expect(STATS.twoPropZTest(100, 101, 100, 10)).toBeNull();
  });

  it("requires an explicit control arm for mass readout", () => {
    expect(STATS.massReadout([{ name: "A", n: 100, x: 10 }, { name: "B", n: 100, x: 12 }])).toEqual({ control: null, rows: [] });
  });
});

describe("twoPropZTest zero-control relative lift", () => {
  it("대조군 전환 0 + 실험군 전환>0이면 상대 lift는 0(변화없음) 아닌 NaN(신규 전환)", () => {
    // 옛 버그: liftRel=0 → 'z=7.16·p<0.0001·통계적 개선'과 같은 패널에서 '상대 Lift 0.00%' 모순.
    const r = STATS.twoPropZTest(1000, 0, 1000, 50);
    expect(r.pA).toBe(0);
    expect(r.pB).toBeCloseTo(0.05, 12);
    expect(Number.isNaN(r.liftRel)).toBe(true);
    expect(r.pValue).toBeLessThan(0.001);
    expect(r.liftAbs).toBeCloseTo(0.05, 12);
  });

  it("대조군·실험군 모두 0이면 상대 lift 0(변화없음) 유지", () => {
    const r = STATS.twoPropZTest(1000, 0, 1000, 0);
    expect(r.liftRel).toBe(0);
  });
});
