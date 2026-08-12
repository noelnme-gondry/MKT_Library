import { describe, it, expect } from "vitest";
import { REG_STATS, REG_TRANSFORMS } from "./regMath";

// Faithful reproduction of runRegStatsTests() from index.html (lines 21527-21635).
// Same inputs, same expected values, same tolerances — do NOT loosen.
const approx = (a, b, t) => Math.abs(a - b) <= t;

describe("runRegStatsTests (golden port)", () => {
  it("T1 · OLS β(2,3,-1.5)·R²1", () => {
    const X1 = [],
      y1 = [];
    for (let i = 0; i < 30; i++) {
      const x1 = i,
        x2 = (i * 7) % 11;
      X1.push([1, x1, x2]);
      y1.push(2 + 3 * x1 - 1.5 * x2);
    }
    const f1 = REG_STATS.ols(X1, y1);
    expect(approx(f1.beta[0], 2, 1e-6)).toBe(true);
    expect(approx(f1.beta[1], 3, 1e-6)).toBe(true);
    expect(approx(f1.beta[2], -1.5, 1e-6)).toBe(true);
    expect(approx(f1.R2, 1, 1e-9)).toBe(true);
  });

  it("T2 · tSF(2.776,4)≈.05·(1.96,∞)≈.05", () => {
    expect(approx(REG_STATS.tSF(2.776, 4), 0.05, 5e-4)).toBe(true);
    expect(approx(REG_STATS.tSF(1.96, 1e6), 0.05, 2e-3)).toBe(true);
  });

  it("T3 · transforms(z·minmax·adstock_log)", () => {
    const z = REG_TRANSFORMS.zscore([1, 2, 3, 4, 5]);
    const zm = z.reduce((a, b) => a + b, 0) / 5;
    const mm = REG_TRANSFORMS.minmax([10, 20, 30]);
    const ad = REG_TRANSFORMS.adstock_log([1, 0, 0], 0.5); // adstock [1,.5,.25] → log1p
    expect(approx(zm, 0, 1e-9)).toBe(true);
    expect(mm[0]).toBe(0);
    expect(mm[2]).toBe(1);
    expect(approx(ad[1], Math.log1p(0.5), 1e-9)).toBe(true);
  });

  it("T4 · r2of(VIF용) 유한", () => {
    const X1 = [];
    for (let i = 0; i < 30; i++) {
      const x1 = i,
        x2 = (i * 7) % 11;
      X1.push([1, x1, x2]);
    }
    const Xo = X1.map((r) => [1, r[1]]);
    const r2o = REG_STATS.r2of(
      Xo,
      X1.map((r) => r[2]),
    );
    expect(isFinite(r2o) && r2o >= 0 && r2o < 1).toBe(true);
  });

  it("T5 · 완전공선 ridge fallback", () => {
    const fit = REG_STATS.ols(
      [
        [1, 2, 4],
        [1, 3, 6],
        [1, 4, 8],
        [1, 5, 10],
      ],
      [1, 2, 3, 4],
    );
    expect(fit.regularized).toBe(true);
  });

  it("T5b · large-scale near-collinearity is marked regularized or rejected", () => {
    const X = Array.from({ length: 40 }, (_, index) => {
      const x = 1_000_000 + index * 10_000;
      return [1, x, 2 * x + (index % 2 ? 1e-4 : -1e-4)];
    });
    const y = X.map((row, index) => 3 + 0.4 * row[1] + (index % 3) * 0.01);
    let fit = null;
    try { fit = REG_STATS.ols(X, y); } catch { fit = null; }
    expect(fit === null || fit.regularized).toBe(true);
  });

  it("T5c · HC3 inference is finite on a well-conditioned heteroskedastic sample", () => {
    const X = Array.from({ length: 60 }, (_, index) => [1, index + 1]);
    const y = X.map((row, index) => 2 + 1.5 * row[1] + ((index % 5) - 2) * row[1] * 0.03);
    const fit = REG_STATS.ols(X, y);
    expect(fit.regularized).toBe(false);
    expect(fit.hc3Se.every(Number.isFinite)).toBe(true);
    expect(fit.hc3Pval.every((value) => value >= 0 && value <= 1)).toBe(true);
    expect(fit.hc3Valid).toBe(true);
  });

  it("T5d · singleton binary feature rejects HC3 inference", () => {
    const X = Array.from({ length: 30 }, (_, index) => [1, index === 29 ? 1 : 0]);
    const y = X.map((row, index) => 0.01 * index + (row[1] ? 100 : 0));
    const fit = REG_STATS.ols(X, y);
    expect(fit.regularized).toBe(false);
    expect(fit.maxLeverage).toBeGreaterThan(0.999999);
    expect(fit.hc3Valid).toBe(false);
    expect(fit.hc3Pval.every(Number.isNaN)).toBe(true);
  });

  // 감사 P0-2: 가드가 없을 때 R²=-Infinity와 p=1.06e-60("극도로 유의")이 화면에 나갔다.
  it("T5e · 상수 종속변수(TSS=0)에서 유한값 + estimable=false", () => {
    const X = [[1, 1], [1, 2], [1, 3], [1, 4], [1, 5], [1, 6]];
    const y = [100, 100, 100, 100, 100, 100];
    const fit = REG_STATS.ols(X, y);
    expect(fit.estimable).toBe(false);
    expect(Number.isFinite(fit.R2)).toBe(true);
    expect(Number.isFinite(fit.adjR2)).toBe(true);
    expect(fit.se.every(Number.isFinite)).toBe(true);
    expect(fit.tval.every(Number.isFinite)).toBe(true);
  });

  it("T5f · n === k (df=0)에서 se/tval이 유한하고 estimable=false", () => {
    const fit = REG_STATS.ols([[1, 1], [1, 2]], [3, 7]);
    expect(fit.estimable).toBe(false);
    expect(fit.se.every(Number.isFinite)).toBe(true);
    expect(fit.tval.every(Number.isFinite)).toBe(true);
  });

  it("T5g · 정상 입력에서는 estimable=true (가드가 no-op)", () => {
    const X = Array.from({ length: 40 }, (_, i) => [1, i + 1]);
    const y = X.map((row) => 3 + 2 * row[1]);
    const fit = REG_STATS.ols(X, y);
    expect(fit.estimable).toBe(true);
    expect(fit.regularized).toBe(false);
  });

  it("T6 · 결정론", () => {
    const X1 = [],
      y1 = [];
    for (let i = 0; i < 30; i++) {
      const x1 = i,
        x2 = (i * 7) % 11;
      X1.push([1, x1, x2]);
      y1.push(2 + 3 * x1 - 1.5 * x2);
    }
    const d1 = REG_STATS.ols(X1, y1).beta[1],
      d2 = REG_STATS.ols(X1, y1).beta[1];
    expect(d1 === d2).toBe(true);
  });
});
