import { describe, expect, it } from "vitest";
import {
  buildElasticNetChannelModels,
  buildElasticNetResponseCurve,
  elasticNetMarginalAt,
  elasticNetResponseAt,
  evaluateElasticNetChannelGate,
  optimizeElasticNetBudget,
} from "./mmmElasticNetResponse";

function channel(overrides = {}) {
  return {
    key: "meta",
    label: "Meta",
    observedMin: 0,
    observedMax: 300,
    recentSpend: 100,
    recentActiveWeeks: 12,
    activeWeeks: 80,
    uniqueSpendValues: 20,
    spendCv: 0.35,
    collinearityGroup: ["meta"],
    coefficient: 0.3,
    positiveFoldShare: 1,
    foldChannelCoefficients: [0.28, 0.31],
    terms: [
      { alpha: 0, coefficient: 0.2, foldCoefficients: [0.18, 0.21], lastAdstock: 100 },
      { alpha: 0.6, coefficient: 0.1, foldCoefficients: [0.1, 0.1], lastAdstock: 220 },
    ],
    ...overrides,
  };
}

describe("WebR MMM Elastic-net response math", () => {
  it("preserves per-adstock final and validation-fold coefficients", () => {
    const input = {
      cuts: [78, 96],
      terms: [
        { isMedia: true, channelKey: "meta", adstockAlpha: 0 },
        { isMedia: true, channelKey: "meta", adstockAlpha: 0.6 },
      ],
      channelScenarios: [{
        key: "meta", label: "Meta", lastAdstockByAlpha: { 0: 100, 0.6: 220 },
        observedMin: 0, observedMax: 300, recentSpend: 100, activeWeeks: 80,
        uniqueSpendValues: 20, spendCv: 0.35, collinearityGroup: ["meta"],
      }],
    };
    const models = buildElasticNetChannelModels([
      { coefficient: 0.2, fold_coefficients: "0.18|0.21" },
      { coefficient: 0.1, fold_coefficients: "0.10|0.10" },
    ], input);
    expect(models[0].coefficient).toBeCloseTo(0.3, 12);
    expect(models[0].positiveFoldShare).toBe(1);
    expect(models[0].hasCompleteFoldEvidence).toBe(true);
    expect(models[0].terms[1]).toMatchObject({ alpha: 0.6, lastAdstock: 220, foldCoefficients: [0.1, 0.1] });
  });

  it("holds the channel gate when fold coefficients are missing instead of copying the final coefficient", () => {
    const input = {
      cuts: [78, 96],
      terms: [{ isMedia: true, channelKey: "meta", adstockAlpha: 0 }],
      channelScenarios: [{ ...channel(), lastAdstockByAlpha: { 0: 100 } }],
    };
    const [model] = buildElasticNetChannelModels([{ coefficient: 0.2, fold_coefficients: "" }], input);
    expect(model).toMatchObject({ hasCompleteFoldEvidence: false, positiveFoldShare: 0 });
    expect(evaluateElasticNetChannelGate(model, { folds: 2, increment: 20 })).toMatchObject({
      eligible: false,
      reasons: expect.arrayContaining(["unstable-fold-coefficient"]),
    });
  });

  it("produces a monotone concave current-carry response and fold range", () => {
    const model = channel();
    const at50 = elasticNetResponseAt(model, 50);
    const at100 = elasticNetResponseAt(model, 100);
    const first50 = at50.mean;
    const second50 = at100.mean - at50.mean;
    expect(at100.mean).toBeGreaterThan(at50.mean);
    expect(second50).toBeLessThan(first50);
    expect(at100.low).toBeLessThanOrEqual(at100.mean);
    expect(at100.high).toBeGreaterThanOrEqual(at100.mean);
    const marginal = elasticNetMarginalAt(model, 100, 20);
    expect(marginal.mean).toBeGreaterThan(0);
    expect(marginal.saturation).toBeGreaterThan(0);
  });

  it("keeps every curve point inside the observed weekly-spend range", () => {
    const curve = buildElasticNetResponseCurve(channel({ observedMin: 25 }), { steps: 20 });
    expect(curve.points).toHaveLength(21);
    expect(curve.points[0].spend).toBe(25);
    expect(curve.points.at(-1).spend).toBe(300);
    expect(curve.points.every((point) => point.spend >= curve.observedMin && point.spend <= curve.observedMax)).toBe(true);
  });

  it("opens recommendations only when stability, support, range, and marginal gates pass", () => {
    expect(evaluateElasticNetChannelGate(channel(), { folds: 2, increment: 20 })).toMatchObject({ eligible: true, reasons: [] });
    expect(evaluateElasticNetChannelGate(channel({
      positiveFoldShare: 0.5,
      collinearityGroup: ["meta", "google"],
      recentSpend: 295,
    }), { folds: 2, increment: 20 })).toMatchObject({
      eligible: false,
      reasons: expect.arrayContaining(["unstable-fold-coefficient", "high-collinearity", "outside-observed-spend-range"]),
    });
  });

  it("allocates deterministically by conservative marginal response and never exceeds observed maxima", () => {
    const meta = channel();
    const google = channel({
      key: "google",
      label: "Google",
      collinearityGroup: ["google"],
      terms: channel().terms.map((term) => ({
        ...term,
        coefficient: term.coefficient * 0.55,
        foldCoefficients: term.foldCoefficients.map((value) => value * 0.55),
      })),
      foldChannelCoefficients: [0.154, 0.1705],
    });
    const result = optimizeElasticNetBudget([meta, google], 300, {
      folds: 2,
      increment: 10,
      predictiveWinner: true,
    });
    expect(result.status).toBe("complete");
    expect(result.totalAllocated).toBeCloseTo(300, 8);
    expect(result.items.every((item) => item.plannedSpend <= 300)).toBe(true);
    expect(result.items.find((item) => item.key === "meta").plannedSpend)
      .toBeGreaterThan(result.items.find((item) => item.key === "google").plannedSpend);
    expect(optimizeElasticNetBudget([meta, google], 300, {
      folds: 2, increment: 10, predictiveWinner: false,
    })).toMatchObject({ status: "blocked", reasons: expect.arrayContaining(["webr-not-predictive-winner"]) });
  });
});
