import { describe, expect, it } from "vitest";

import { normalizeSvmResult, prepareSvmInput } from "./svm";

function regressionInput(n = 160, predictorCount = 8, numericFeatureCount = 2) {
  const X = Array.from({ length: n }, (_, row) => [1, ...Array.from({ length: predictorCount }, (__, column) => ((row + 3) * (column + 5)) % 17)]);
  const y = Array.from({ length: n }, (_, index) => index * 0.01 + (index % 5) * 0.03);
  return { X, y, terms: ["(Intercept)", ...Array.from({ length: predictorCount }, (_, index) => `x${index}`)], numericFeatureCount };
}

describe("prepareSvmInput", () => {
  it("requires continuous production features in addition to categorical encodings", () => {
    expect(prepareSvmInput(regressionInput(200, 8, 0))).toMatchObject({ ok: false, reason: "insufficient_continuous_features", requiredNumericFeatures: 2 });
  });

  it("uses the declared independent-sample threshold", () => {
    expect(prepareSvmInput(regressionInput(119, 8))).toMatchObject({ ok: false, reason: "insufficient_observations", requiredObservations: 120 });
    expect(prepareSvmInput(regressionInput(160, 8))).toMatchObject({ ok: true, n: 160, predictorCount: 8 });
  });

  it("bounds browser-side tuning work before a large file can freeze the tab", () => {
    expect(prepareSvmInput(regressionInput(1001, 8))).toMatchObject({
      ok: false,
      reason: "too_many_observations",
      maxObservations: 1000,
    });
  });
});

describe("normalizeSvmResult", () => {
  it("keeps prediction-only recommendation and tuning evidence", () => {
    const input = prepareSvmInput(regressionInput(160, 8));
    const result = normalizeSvmResult([{
      n: 160, folds: 5, primary_metric: "rmse", secondary_metric: "oos_r2",
      svm_primary: 0.18, baseline_primary: 0.2, svm_secondary: 0.31, baseline_secondary: 0.22,
      relative_gain: 0.1, median_cost: 1, median_gamma: 0.1, package_version: "1.7-16",
    }], input);
    expect(result).toMatchObject({ status: "complete", recommendation: "svm_candidate", folds: 5, tuning: { cost: 1, gamma: 0.1 } });
  });
});
