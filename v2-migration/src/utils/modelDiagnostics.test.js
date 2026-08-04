import { describe, expect, it } from "vitest";
import { REG_STATS } from "./regMath";
import { computeOlsDiagnostics, computeVif } from "./modelDiagnostics";

function buildSeries({ n = 48, rho = 0, outlierAt = -1, outlierValue = 0 } = {}) {
  let previous = 0;
  let seed = 1729;
  const X = [];
  const y = [];
  for (let i = 0; i < n; i++) {
    const x = i / 3;
    seed = (seed * 48271) % 2147483647;
    const innovation = (seed / 2147483647 - 0.5) * 2;
    previous = rho * previous + innovation;
    X.push([1, x]);
    y.push(12 + 1.8 * x + previous + (i === outlierAt ? outlierValue : 0));
  }
  return { X, y };
}

describe("modelDiagnostics", () => {
  it("normal synthetic OLS emits finite plots, DW, and HC3 sensitivity metadata", () => {
    const { X, y } = buildSeries();
    const diagnostics = computeOlsDiagnostics(REG_STATS.ols(X, y), X);
    expect(diagnostics.dw).toBeGreaterThan(1.5);
    expect(diagnostics.dw).toBeLessThan(2.5);
    expect(diagnostics.qq.sample).toHaveLength(X.length);
    expect(diagnostics.residVsFitted.y).toHaveLength(X.length);
    expect(diagnostics.hc3.valid).toBe(true);
  });

  it("detects intentionally autocorrelated residuals with BG and DW", () => {
    const { X, y } = buildSeries({ n: 72, rho: 0.9 });
    const diagnostics = computeOlsDiagnostics(REG_STATS.ols(X, y), X);
    expect(diagnostics.dw).toBeLessThan(1.5);
    expect(diagnostics.bg?.pValue).toBeLessThan(0.05);
    expect(diagnostics.bg?.verdict).toBe("warn");
  });

  it("flags a clear influential observation with Cook's D", () => {
    const { X, y } = buildSeries({ n: 48, outlierAt: 31, outlierValue: 90 });
    const diagnostics = computeOlsDiagnostics(REG_STATS.ols(X, y), X);
    expect(diagnostics.influential).toContain(31);
  });

  it("VIF excludes the intercept, marks one predictor not applicable, and does not throw on collinearity", () => {
    const onePredictor = Array.from({ length: 16 }, (_, i) => [1, i]);
    expect(computeVif(onePredictor)).toMatchObject({ vif: [], maxVif: null, verdict: "not_applicable", variableIndices: [1] });
    const collinear = Array.from({ length: 24 }, (_, i) => [1, i, i * 2]);
    const vif = computeVif(collinear);
    expect(vif.verdict).toBe("severe");
    expect(vif.vif).toEqual([null, null]);
  });

  it("handles degenerate input honestly without throwing", () => {
    expect(computeOlsDiagnostics(null, [])).toMatchObject({ dw: null, leverages: [], cooksD: [] });
  });
});
