import { describe, it, expect } from "vitest";
import { ahaParseActionWindow, AHA_STATS, ahaCoverageBuckets } from "./ahaMath.js";

describe("ahaParseActionWindow", () => {
  it("parses {action}_d{N} suffix", () => {
    expect(ahaParseActionWindow("invite_d7")).toEqual({ action: "invite", window: 7 });
  });
  it("falls back to Infinity window when no dN suffix", () => {
    expect(ahaParseActionWindow("invite")).toEqual({ action: "invite", window: Infinity });
  });
});

// Deterministic synthetic dataset (§3 no Math.random): 100 users, feature value
// correlates with target so gridSearch finds a clean signal.
function buildSynthetic(n = 100) {
  const valuesAll = [];
  const targets = [];
  for (let i = 0; i < n; i++) {
    // value ramps 0..99; target=1 for the top half (strong precision/recall signal)
    valuesAll.push(i);
    targets.push(i >= 50 ? 1 : 0);
  }
  const idx = valuesAll.map((_, i) => i);
  return { valuesAll, targets, idx };
}

describe("AHA_STATS.coverage", () => {
  it("counts full population meeting k regardless of target", () => {
    const { valuesAll } = buildSynthetic();
    const cov = AHA_STATS.coverage(valuesAll, 50);
    expect(cov.allSupport).toBe(50); // values 50..99
    expect(cov.allPct).toBeCloseTo(0.5, 5);
  });
  it("empty array → zero coverage (no NaN)", () => {
    expect(AHA_STATS.coverage([], 10)).toEqual({ allSupport: 0, allPct: 0 });
  });
});

describe("AHA_STATS.gridSearch — per-window holdout + coverage", () => {
  it("every grid row carries its own holdout metrics + population coverage", () => {
    const { valuesAll, targets, idx } = buildSynthetic();
    const windowCols = [
      { header: "action_d1", window: 1, valuesAll },
      { header: "action_d7", window: 7, valuesAll: valuesAll.map((v) => v * 2) },
    ];
    const gs = AHA_STATS.gridSearch(windowCols, targets, idx, idx, 5);
    expect(gs).toBeTruthy();
    expect(gs.grid).toHaveLength(2);
    for (const row of gs.grid) {
      expect(row.holdout).toBeTruthy();
      expect(row.holdout.F1).toBeGreaterThanOrEqual(0);
      expect(row.allSupport).toBeGreaterThanOrEqual(0);
      expect(row.allPct).toBeGreaterThanOrEqual(0);
      expect(row.allPct).toBeLessThanOrEqual(1);
    }
    // top-level result mirrors the winning window's holdout/coverage (not just train).
    expect(gs.holdout).toBeTruthy();
    expect(gs.allSupport).toBeGreaterThanOrEqual(0);
  });
});

describe("AHA_STATS.thresholdSweep", () => {
  it("returns ascending-k sweep with P/R/F1 + coverage at every observed k", () => {
    const { valuesAll, targets, idx } = buildSynthetic();
    const sweep = AHA_STATS.thresholdSweep(valuesAll, targets, idx, 1);
    expect(sweep.length).toBeGreaterThan(0);
    // ascending k order
    for (let i = 1; i < sweep.length; i++) expect(sweep[i].k).toBeGreaterThan(sweep[i - 1].k);
    // stricter k (higher) => support(<=) shrinks or stays equal (monotone non-increasing)
    for (let i = 1; i < sweep.length; i++) expect(sweep[i].support).toBeLessThanOrEqual(sweep[i - 1].support);
    // population coverage matches AHA_STATS.coverage directly
    const sample = sweep[0];
    const cov = AHA_STATS.coverage(valuesAll, sample.k);
    expect(sample.allSupport).toBe(cov.allSupport);
    expect(sample.allPct).toBeCloseTo(cov.allPct, 10);
  });

  it("empty idx/no positive values → empty sweep (no throw)", () => {
    expect(AHA_STATS.thresholdSweep([], [], [], 1)).toEqual([]);
  });
});

describe("ahaCoverageBuckets", () => {
  it("folds a k-sweep into ~5% coverage buckets, sorted by 달성률 desc, optimal flagged", () => {
    const { valuesAll, targets, idx } = buildSynthetic(100);
    const sweep = AHA_STATS.thresholdSweep(valuesAll, targets, idx, 1);
    const baseRate = targets.reduce((s, t) => s + t, 0) / targets.length;
    const bestK = 50; // top-half threshold on this synthetic ramp
    const buckets = ahaCoverageBuckets(sweep, { stepPct: 5, bestK, baseRate });
    expect(buckets.length).toBeGreaterThan(1);
    // 달성률 내림차순
    for (let i = 1; i < buckets.length; i++)
      expect(buckets[i].allPct).toBeLessThanOrEqual(buckets[i - 1].allPct);
    // 최적 임계값 정확히 하나 포함·플래그
    const opt = buckets.filter((b) => b.isOptimal);
    expect(opt.length).toBe(1);
    expect(opt[0].k).toBe(bestK);
    // lift = P/baseRate 동봉
    expect(opt[0].lift).toBeCloseTo(opt[0].P / baseRate, 10);
    // 구간이 상식적으로 분포(연속 대표점 달성률 간격이 stepPct*2 이내)
    for (let i = 1; i < buckets.length; i++)
      expect(buckets[i - 1].allPct - buckets[i].allPct).toBeLessThan(0.1 + 1e-9);
  });

  it("empty sweep → empty (no throw)", () => {
    expect(ahaCoverageBuckets([], { stepPct: 5 })).toEqual([]);
    expect(ahaCoverageBuckets(null)).toEqual([]);
  });
});
