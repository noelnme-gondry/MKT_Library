import { describe, expect, it } from "vitest";
import { mmmBayesianForecast } from "./mmmMath";

function fixture() {
  const weeks = Array.from({ length: 12 }, (_, i) => ({ week: i + 1, actual: 100 + i, fitted: 100 + i }));
  const panel = {
    week: weeks.map((w) => w.week),
    targets: { Regs: weeks.map((w) => w.actual) },
    ch: { ios: Array.from({ length: 12 }, () => 10) },
    dates: [],
  };
  return {
    engine: "bayesian",
    weeks,
    names: ["lny", "trend", "media_ios"],
    channelMeta: [{ key: "ios", label: "iOS" }],
    params: { ios: { alpha: 0, ec: 10, slope: 1 } },
    saturationByChannel: { ios: { recentMean: 10 } },
    rawFeatureHistory: Array.from({ length: 12 }, (_, i) => [Math.log(100 + i), i, 0.5]),
    featureMeans: [Math.log(105), 5.5, 0.5],
    featureScales: [1, 1, 1],
    seasonalityPeriods: {},
    posterior: {
      beta: [100, 100, 1, 0],
      sigma: 1,
      sigma2: 1,
      r2: 0.8,
      XtXinv: Array.from({ length: 4 }, (_, i) => Array.from({ length: 4 }, (_, j) => (i === j ? 1 : 0))),
    },
  };
}

describe("mmmBayesianForecast safety", () => {
  it("carries lagged target control instead of resetting it to zero", () => {
    const run = fixture();
    const panel = { week: Array.from({ length: 12 }, (_, i) => i + 1), ch: { ios: Array.from({ length: 12 }, () => 10) }, dates: [] };
    const carried = mmmBayesianForecast(run, panel, null, 1);
    const forcedZero = mmmBayesianForecast(run, panel, null, 1, { futureDummy: { lny: [0] } });
    expect(carried.predFut[0]).toBeGreaterThan(forcedZero.predFut[0]);
  });

  it("damps a one-week trend shock by default", () => {
    const run = fixture();
    run.rawFeatureHistory[10][1] = 0;
    run.rawFeatureHistory[11][1] = 100;
    const panel = { week: Array.from({ length: 12 }, (_, i) => i + 1), ch: { ios: Array.from({ length: 12 }, () => 10) }, dates: [] };
    const damped = mmmBayesianForecast(run, panel, null, 1);
    const legacy = mmmBayesianForecast(run, panel, null, 1, { trendDamping: 1 });
    expect(legacy.predFut[0] - damped.predFut[0]).toBeGreaterThan(0);
  });

  it("flags a negative media coefficient as non-causal for OFF scenarios", () => {
    const run = fixture();
    run.posterior.beta[3] = -2;
    const panel = { week: Array.from({ length: 12 }, (_, i) => i + 1), ch: { ios: Array.from({ length: 12 }, () => 10) }, dates: [] };
    const result = mmmBayesianForecast(run, panel, { ios: [0] }, 1);
    expect(result.scenarioWarnings.some((warning) => warning.type === "negative-media-effect")).toBe(true);
  });
});
