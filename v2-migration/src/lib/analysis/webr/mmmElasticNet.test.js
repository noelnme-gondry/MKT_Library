import { describe, expect, it } from "vitest";
import { buildElasticNetFitDiagnostics, buildMmmElasticNetDesign, normalizeMmmElasticNetResult, prepareMmmElasticNetInput, resolveMmmElasticNetInput } from "./mmmElasticNet";

function panel(n = 120) {
  const week = Array.from({ length: n }, (_, index) => index + 1);
  const meta = week.map((_, index) => 100 + (index % 9) * 13);
  const google = week.map((_, index) => 80 + (index % 11) * 9);
  return {
    week,
    targets: { Regs: week.map((_, index) => 500 + index * 2 + meta[index] * 0.5 + google[index] * 0.3) },
    channels: [
      { key: "meta", label: "Meta", kind: "perf" },
      { key: "google", label: "Google", kind: "perf" },
    ],
    ch: { meta, google },
    dummy: { event: week.map((_, index) => index === 70 ? 1 : 0) },
    steps: {},
    external: {},
  };
}

describe("WebR MMM elastic-net challenger adapter", () => {
  it("builds a fixed time-safe feature library without outcome-derived transforms", () => {
    const design = buildMmmElasticNetDesign(panel());
    expect(design.X).toHaveLength(120);
    expect(design.terms.filter((term) => term.group === "Meta")).toHaveLength(4);
    expect(design.terms.some((term) => term.name === "annual_sin_1")).toBe(true);
  });

  it("requires 78 weeks and reuses current MMM rolling windows", () => {
    expect(prepareMmmElasticNetInput({ panel: panel(70), run: {}, target: "Regs" })).toMatchObject({
      ok: false,
      reason: "insufficient_history",
      requiredObservations: 78,
    });
    expect(prepareMmmElasticNetInput({ panel: panel(104), run: {}, target: "Regs" })).toMatchObject({
      ok: false,
      reason: "insufficient_comparable_history",
      requiredObservations: 120,
    });
    const prepared = prepareMmmElasticNetInput({
      panel: panel(),
      target: "Regs",
      run: {
        methodLabel: "Bayesian MMM",
        rollingBacktest: { cuts: [78, 96], horizon: 12 },
        backtest: { wmape: 12 },
      },
    });
    expect(prepared).toMatchObject({ ok: true, cuts: [78, 96], horizon: 12, baselineWmape: 12 });

    const bayesianPrepared = prepareMmmElasticNetInput({
      panel: panel(),
      target: "Regs",
      run: {
        methodLabel: "Bayesian MMM",
        rollingBacktest: { cuts: [80, 100], horizon: 10 },
        backtest: { wmape: 9 },
      },
    });
    expect(bayesianPrepared).toMatchObject({ ok: true, cuts: [80, 100], horizon: 10, baselineWmape: 9 });
    expect(resolveMmmElasticNetInput(bayesianPrepared)).toBe(bayesianPrepared);

    const rollingFallback = prepareMmmElasticNetInput({
      panel: panel(),
      target: "Regs",
      run: { rollingBacktest: { cuts: [78, 96], horizon: 12, meanWmape: 7.5 } },
    });
    expect(rollingFallback).toMatchObject({ baselineWmape: 7.5, sameValidationWindows: true });
  });

  it("allows only a multi-window 5%+ predictive replacement candidate", () => {
    const prepared = prepareMmmElasticNetInput({
      panel: panel(),
      target: "Regs",
      run: {
        methodLabel: "Bayesian MMM",
        rollingBacktest: { cuts: [78, 96], horizon: 12 },
        backtest: { wmape: 12 },
      },
    });
    const rows = prepared.terms.map((_, index) => ({
      coefficient: prepared.terms[index].isMedia ? 0.1 + index * 0.001 : 0.01,
      fold_coefficients: prepared.terms[index].isMedia ? "0.08|0.11" : "0.01|0.01",
      importance: index === 0 ? 1 : 0.2,
      n: 120,
      folds: 2,
      alpha: 0.5,
      lambda_factor: 0.01,
      wmape: 10,
      intercept: 250,
      fold_wmapes: "9|11",
      nonzero_features: 6,
    }));
    const normalized = normalizeMmmElasticNetResult(rows, prepared);
    expect(normalized).toMatchObject({
      replacementCandidate: true,
      recommendation: "predictive_replacement_candidate",
      validationMode: "nested-time-ordered-outer-wmape",
    });
    expect(normalized.channelModels).toHaveLength(2);
    expect(normalized.channelModels[0].terms).toHaveLength(4);
    expect(normalized.channelModels[0].terms[0].foldCoefficients).toEqual([0.08, 0.11]);
    expect(normalized.foldWmapes).toEqual([9, 11]);
    expect(normalized.fit).toMatchObject({ intercept: 250 });
    expect(normalized.fit.actual).toHaveLength(120);
    expect(normalized.fit.fitted).toHaveLength(120);
    expect(normalized.fit.drivers.map((driver) => driver.name)).toEqual(expect.arrayContaining([
      "Baseline", "Trend", "Seasonality", "Meta", "Google", "Events",
    ]));

    expect(normalizeMmmElasticNetResult(rows.map((row) => ({ ...row, wmape: 12.3 })), prepared)).toMatchObject({
      replacementCandidate: false,
      recommendation: "more_validation_required",
    });
    expect(normalizeMmmElasticNetResult(rows.map((row) => ({ ...row, wmape: 13 })), prepared)).toMatchObject({
      replacementCandidate: false,
      recommendation: "keep_bayesian",
    });
  });

  it("reconstructs fitted values and weekly driver contributions without fabricating intervals", () => {
    const input = {
      y: [13, 17, 21],
      X: [[1, 0], [2, 1], [3, 0]],
      labels: ["W1", "W2", "W3"],
      terms: [
        { name: "media_meta", group: "Meta", kind: "media", isMedia: true },
        { name: "event", group: "Events", kind: "control", isMedia: false },
      ],
    };
    const coefficients = [{ coefficient: 4 }, { coefficient: 2 }];
    const fit = buildElasticNetFitDiagnostics(input, coefficients, 9);
    expect(fit).toMatchObject({ labels: ["W1", "W2", "W3"], actual: [13, 17, 21], fitted: [13, 19, 21], intercept: 9 });
    expect(fit.drivers.find((driver) => driver.name === "Meta")?.values).toEqual([4, 8, 12]);
    expect(fit.drivers.find((driver) => driver.name === "Events")?.values).toEqual([0, 2, 0]);
    fit.fitted.forEach((value, index) => {
      expect(fit.drivers.reduce((sum, driver) => sum + driver.values[index], 0)).toBeCloseTo(value, 12);
    });
    expect(fit.drivers.reduce((sum, driver) => sum + driver.rmsShare, 0)).toBeCloseTo(1, 10);
    expect(fit).not.toHaveProperty("confidenceInterval");
  });

  it("marks highly collinear media channels as one interpretation group", () => {
    const prepared = prepareMmmElasticNetInput({
      panel: panel(),
      target: "Regs",
      run: {
        methodLabel: "Bayesian MMM",
        rollingBacktest: { cuts: [78, 96], horizon: 12 },
        backtest: { wmape: 12 },
        collinear_pairs: [{ a: "media_meta", b: "media_google", corr: 0.95 }],
      },
    });
    expect(prepared.channelScenarios.map((channel) => channel.collinearityGroup)).toEqual([
      ["meta", "google"],
      ["meta", "google"],
    ]);
  });
});
