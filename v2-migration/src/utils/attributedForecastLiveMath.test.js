import { describe, expect, it } from "vitest";
import { buildAttributedForecastDataset } from "./attributedForecastDataset";
import { runAttributedForecastLiveRouter, runAttributedForecastLiveScenario } from "./attributedForecastLiveMath";

function fixture() {
  const start = Date.UTC(2023, 0, 2);
  const rows = [];
  for (let week = 0; week < 120; week++) {
    const date = new Date(start + week * 7 * 86400000).toISOString().slice(0, 10);
    ["ANDROID", "IOS"].forEach((platform, platformIndex) => {
      const organic = 900 + platformIndex * 150 + week * 4 + Math.sin(week / 5) * 30;
      const cost = 100 + week * 2 + (week % 6) * 12 + platformIndex * 20;
      const paid = 18 + Math.sqrt(cost) * 5;
      rows.push({ week: date, platform, channel: "Organic", cost: 0, regs: organic });
      rows.push({ week: date, platform, channel: "Meta", cost, regs: paid });
    });
  }
  return rows;
}

function datasetFrom(rows) {
  return buildAttributedForecastDataset(rows, {
    timeHeader: "week",
    platformHeader: "platform",
    channelHeader: "channel",
    spendHeader: "cost",
    targetHeader: "regs",
  }, { asOfDate: "2026-01-01" });
}

describe("live-condition attributed forecast router", () => {
  it("selects on four-week rolling origins and separates live, known-spend, and naive errors", () => {
    const dataset = datasetFrom(fixture());
    const result = runAttributedForecastLiveRouter(dataset, { holdout: 12, horizon: 12 });
    expect(result.model).toBe("live-oos-organic-paid-v3");
    expect(result.foldStep).toBe(4);
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates.every((candidate) => candidate.folds.length > 10)).toBe(true);
    expect(result.candidates.every((candidate) =>
      Number.isFinite(candidate.pooledWmape)
      && Number.isFinite(candidate.conditionalPooledWmape)
      && Number.isFinite(candidate.naivePooledWmape),
    )).toBe(true);
    const selected = result.candidates.find((candidate) => candidate.route === result.selectedRoute);
    expect(selected.horizonMetrics).toHaveLength(12);
    expect(selected.useModelByHorizon).toHaveLength(12);
    expect(selected.folds.every((fold) => fold.regime && Number.isFinite(fold.naiveWmape))).toBe(true);
    expect(result.forecast.marginByHorizon).toHaveLength(12);
    expect(result.forecast.predicted.every((value, index) =>
      Math.abs(value - result.forecast.organic[index] - result.forecast.performance[index]) < 1e-8,
    )).toBe(true);
  });

  it("re-forecasts conditionally on an explicit future budget without producing negative components", () => {
    const dataset = datasetFrom(fixture());
    const router = runAttributedForecastLiveRouter(dataset, { holdout: 12, horizon: 12 });
    const baseline = runAttributedForecastLiveScenario(dataset, router, {}, 12);
    const budget = Object.fromEntries((baseline.channels || []).map((channel) => [channel, 1000]));
    const scenario = runAttributedForecastLiveScenario(dataset, router, budget, 12);
    expect(scenario.predicted).toHaveLength(12);
    expect(scenario.organic.every((value) => value >= 0)).toBe(true);
    expect(scenario.performance.every((value) => value >= 0)).toBe(true);
    expect(scenario.predicted.every((value, index) =>
      Math.abs(value - scenario.organic[index] - scenario.performance[index]) < 1e-8,
    )).toBe(true);
    if (router.selectedRoute === "android-ios-sum") {
      expect(scenario.parts.every((part) => part.panel?.channels?.length && part.futureCosts?.length === 12)).toBe(true);
    }
  });
});
