import { describe, expect, it } from "vitest";
import { normalizeRandomForestResult, prepareRandomForestInput } from "./randomForest";

function input(n = 120, predictorCount = 2) {
  return {
    X: Array.from({ length: n }, (_, index) => [1, ...Array.from({ length: predictorCount }, (_, featureIndex) => (index + featureIndex) % 7)]),
    y: Array.from({ length: n }, (_, index) => index % 3 === 0 ? 1 : 0),
    terms: ["(Intercept)", ...Array.from({ length: predictorCount }, (_, index) => ["hook", "length"][index] || `feature_${index}`)],
  };
}

describe("WebR Random Forest challenger adapter", () => {
  it("requires enough rows relative to the predictor count", () => {
    expect(prepareRandomForestInput(input(120))).toMatchObject({ ok: true, outcomeType: "classification" });
    expect(prepareRandomForestInput(input(80))).toMatchObject({
      ok: false,
      reason: "insufficient_observations",
      requiredObservations: 100,
    });
  });

  it("rejects a constant outcome", () => {
    const payload = input();
    expect(prepareRandomForestInput({ ...payload, y: payload.y.map(() => 1) })).toEqual({
      ok: false,
      reason: "constant_outcome",
    });
  });

  it("bounds browser-side fitting work before a large file can freeze the tab", () => {
    expect(prepareRandomForestInput(input(1001))).toMatchObject({
      ok: false,
      reason: "too_many_observations",
      maxObservations: 1000,
    });
  });

  it("caps predictors so the minimum-row rule never exceeds the browser row cap", () => {
    expect(prepareRandomForestInput(input(1000, 41))).toMatchObject({
      ok: false,
      reason: "too_many_predictors",
      maxPredictors: 40,
    });
  });

  it("marks Random Forest as a prediction candidate only above the 5% error gate", () => {
    const prepared = prepareRandomForestInput(input());
    const rows = [
      { importance: 0.2, n: 120, folds: 4, primary_metric: "brier", secondary_metric: "accuracy", rf_primary: 0.16, baseline_primary: 0.2, rf_secondary: 0.77, baseline_secondary: 0.71, relative_gain: 0.2 },
      { importance: 0.5, n: 120, folds: 4, primary_metric: "brier", secondary_metric: "accuracy", rf_primary: 0.16, baseline_primary: 0.2, rf_secondary: 0.77, baseline_secondary: 0.71, relative_gain: 0.2 },
    ];
    const result = normalizeRandomForestResult(rows, prepared);
    expect(result.recommendation).toBe("random_forest_candidate");
    expect(result.importance[0]).toMatchObject({ name: "length", importance: 0.5 });
  });
});
