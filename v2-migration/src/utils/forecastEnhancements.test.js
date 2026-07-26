import { describe, expect, it } from "vitest";
import {
  forecastWmape,
  forecastResidualDiagnostics,
  forecastIntervalCalibration,
  splitForecastIntervals,
  buildForecastScenarioDefinitions,
  summarizeForecastScenario,
} from "./forecastEnhancements";

describe("forecast enhancements", () => {
  it("computes weighted error and residual diagnostics deterministically", () => {
    expect(forecastWmape([100, 120], [90, 132])).toBeCloseTo(10, 6);
    const diagnostics = forecastResidualDiagnostics([100, 120, 110, 130], [95, 118, 114, 125]);
    expect(diagnostics.n).toBe(4);
    expect(diagnostics.acf1).not.toBeNull();
  });

  it("reports interval coverage and separates parameter/predictive bands", () => {
    const calibration = forecastIntervalCalibration([10, 20, 30], [5, 15, 35], [15, 25, 35]);
    expect(calibration.coverage).toBeCloseTo(2 / 3, 6);
    const bands = splitForecastIntervals([10], [0], [20]);
    expect(bands[0].parameterLo).toBeGreaterThan(0);
    expect(bands[0].predictiveLo).toBe(0);
  });

  it("builds constrained comparison scenarios and deltas", () => {
    const scenarios = buildForecastScenarioDefinitions({
      baseline: { search: 100, meta: 50 },
      recent: { search: 80, meta: 40 },
      channels: [{ key: "search" }, { key: "meta" }],
      totalBudget: 180,
      maxBudget: 200,
    });
    expect(scenarios).toHaveLength(4);
    expect(Object.values(scenarios[0].budgets).reduce((a, b) => a + b, 0)).toBeCloseTo(180, 6);
    const summary = summarizeForecastScenario("plus-10", { predFut: [110, 120] }, { predFut: [100, 100] });
    expect(summary.percentFromBaseline).toBeCloseTo(15, 6);
  });
});
