import { describe, expect, it } from "vitest";
import { buildMmmElasticNetDesign, normalizeMmmElasticNetResult, prepareMmmElasticNetInput } from "./mmmElasticNet";

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
  it("builds a fixed causal feature library without outcome-derived transforms", () => {
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
    const prepared = prepareMmmElasticNetInput({
      panel: panel(),
      target: "Regs",
      run: {
        methodLabel: "Classic MMM",
        aggregateRollingBacktest: { cuts: [78, 96], horizon: 12 },
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
  });

  it("allows only a multi-window 5%+ predictive replacement candidate", () => {
    const prepared = prepareMmmElasticNetInput({
      panel: panel(),
      target: "Regs",
      run: {
        methodLabel: "Classic MMM",
        aggregateRollingBacktest: { cuts: [78, 96], horizon: 12 },
        backtest: { wmape: 12 },
      },
    });
    const rows = prepared.terms.map((_, index) => ({
      importance: index === 0 ? 1 : 0.2,
      n: 120,
      folds: 2,
      alpha: 0.5,
      lambda_factor: 0.01,
      wmape: 10,
      nonzero_features: 6,
    }));
    expect(normalizeMmmElasticNetResult(rows, prepared)).toMatchObject({
      replacementCandidate: true,
      recommendation: "predictive_replacement_candidate",
      validationMode: "nested-time-ordered-outer-wmape",
    });

    expect(normalizeMmmElasticNetResult(rows.map((row) => ({ ...row, wmape: 12.3 })), prepared)).toMatchObject({
      replacementCandidate: false,
      recommendation: "more_validation_required",
    });
    expect(normalizeMmmElasticNetResult(rows.map((row) => ({ ...row, wmape: 13 })), prepared)).toMatchObject({
      replacementCandidate: false,
      recommendation: "keep_current_js",
    });
  });
});
