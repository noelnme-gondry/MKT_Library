import { describe, expect, it } from "vitest";
import { buildAttributedForecastDataset } from "./attributedForecastDataset";
import { runAttributedForecastLiveRouter, runAttributedForecastLiveScenario } from "./attributedForecastLiveMath";

function fixture(length = 120) {
  const start = Date.UTC(2023, 0, 2);
  const rows = [];
  for (let week = 0; week < length; week++) {
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

function datasetFrom(rows, stepFields = []) {
  return buildAttributedForecastDataset(rows, {
    timeHeader: "week",
    platformHeader: "platform",
    channelHeader: "channel",
    spendHeader: "cost",
    targetHeader: "regs",
    stepFields,
  }, { asOfDate: "2030-01-01" });
}

describe("live-condition attributed forecast router", () => {
  it("uses a deterministic snapshot fallback and never silently turns missing Paid Cost into zero", () => {
    const rows = fixture(60);
    const firstPaid = rows.find((row) => row.channel === "Meta");
    firstPaid.cost = "";
    const fields = {
      timeHeader: "week",
      platformHeader: "platform",
      channelHeader: "channel",
      spendHeader: "cost",
      targetHeader: "regs",
      stepFields: [],
    };
    const conservative = buildAttributedForecastDataset(rows, fields);
    expect(conservative.snapshotDateSource).toBe("conservative-latest-week-excluded");
    expect(conservative.excludedPartialWeek).toBe(true);
    expect(conservative.weeks).toHaveLength(59);
    expect(conservative.invalidPaidCostRows).toBe(1);
    const explicit = buildAttributedForecastDataset(rows, fields, {
      asOfDate: "2030-01-01",
      asOfDateSource: "file-modified-time",
    });
    expect(explicit.weeks).toHaveLength(60);
    expect(explicit.snapshotDateSource).toBe("file-modified-time");
  });

  it("keeps a short-history point forecast but certifies only after three nested outer folds", () => {
    expect(runAttributedForecastLiveRouter(datasetFrom(fixture(73)), { horizon: 12 })).toBeNull();
    const pointOnly = runAttributedForecastLiveRouter(datasetFrom(fixture(74)), { horizon: 12 });
    expect(pointOnly).not.toBeNull();
    expect(pointOnly.outerFoldCount).toBe(0);
    expect(pointOnly.intervalCalibrationEligible).toBe(false);
    expect(pointOnly.eligible).toBe(false);
    const calibrated = runAttributedForecastLiveRouter(datasetFrom(fixture(170)), { horizon: 12 });
    expect(calibrated.outerFoldCount).toBeGreaterThanOrEqual(3);
    expect(calibrated.intervalCalibrationEligible).toBe(true);
    expect(calibrated.intervalCalibrationFoldCount).toBeGreaterThanOrEqual(8);
    expect(calibrated.minimumIntervalWeeks).toBe(170);
  }, 30_000);

  it("auto-maps repeated long event columns and OS-scoped wide event headers without summing channel rows", () => {
    const rows = fixture();
    rows.forEach((row) => {
      row["Liveness Check"] = row.week === "2024-09-30" ? 1 : 0;
      row["IOS Delist"] = row.week === "2024-10-07" && row.platform === "IOS" ? 1 : 0;
    });
    const dataset = datasetFrom(rows, [
      { header: "Liveness Check", plat: "common", stepMode: "boundary" },
      { header: "IOS Delist", plat: "ios", stepMode: "boundary" },
    ]);
    expect(dataset.eventHeaders).toEqual(["Liveness Check", "IOS Delist"]);
    expect(dataset.eventConflicts).toHaveLength(0);
    const active = dataset.events.filter((event) => event.value === 1);
    expect(active.filter((event) => event.key === "liveness_check" && event.platform === "android").length).toBeGreaterThan(1);
    expect(active.filter((event) => event.key === "liveness_check" && event.platform === "ios").length).toBeGreaterThan(1);
    expect(active.filter((event) => event.key === "ios_delist").every((event) => event.platform === "ios")).toBe(true);
    expect(active.find((event) => event.key === "ios_delist")).toMatchObject({
      platform: "ios",
      value: 1,
      sourceActiveWeeks: 1,
      mode: "step-boundary",
    });
  });

  it("selects on non-overlapping nested origins and separates live, known-spend, and naive errors", () => {
    const dataset = datasetFrom(fixture(170));
    const result = runAttributedForecastLiveRouter(dataset, { holdout: 12, horizon: 12 });
    expect(result.model).toBe("nested-oos-organic-paid-v5-auto-selection");
    expect(result.foldStep).toBe(12);
    expect([26, 52, 78]).toContain(result.selectedSpec.trainingWindow);
    expect(["none", "reset", "level"]).toContain(result.selectedSpec.stepPolicy);
    expect(result.lookbackCandidates.map((candidate) => candidate.trainingWindow)).toEqual([26, 52, 78]);
    expect(result.lookbackCandidates.filter((candidate) => candidate.available).every((candidate) => Number.isFinite(candidate.pooledWmape))).toBe(true);
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates.every((candidate) => candidate.folds.length >= 4)).toBe(true);
    expect(result.candidates.every((candidate) =>
      Number.isFinite(candidate.pooledWmape)
      && Number.isFinite(candidate.conditionalPooledWmape)
      && Number.isFinite(candidate.naivePooledWmape),
    )).toBe(true);
    const selected = result.candidates.find((candidate) => candidate.route === result.selectedRoute);
    expect(selected.horizonMetrics).toHaveLength(12);
    expect(selected.useModelByHorizon).toHaveLength(12);
    expect(selected.folds.every((fold) => fold.regime && Number.isFinite(fold.naiveWmape))).toBe(true);
    result.validation.folds.slice(1).forEach((fold, index) => {
      expect(result.validation.folds[index].offset - fold.offset).toBeLessThanOrEqual(-12);
    });
    const pooledNumerator = result.validation.folds.reduce((sum, fold) => sum + fold.absoluteError, 0);
    const pooledDenominator = result.validation.folds.reduce((sum, fold) => sum + fold.denominator, 0);
    expect(result.validation.pooledWmape).toBeCloseTo(pooledNumerator / pooledDenominator * 100, 10);
    expect(result.forecast.marginByHorizon).toHaveLength(12);
    expect(result.forecast.intervalCalibrationEligible).toBe(true);
    expect(result.forecast.predicted.every((value, index) =>
      Math.abs(value - result.forecast.organic[index] - result.forecast.performance[index]) < 1e-8,
    )).toBe(true);
  }, 30_000);

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

  it("does not let a dominant Android series hide a broken iOS component", () => {
    const start = Date.UTC(2023, 0, 2);
    const rows = [];
    for (let week = 0; week < 170; week++) {
      const date = new Date(start + week * 7 * 86400000).toISOString().slice(0, 10);
      const androidCost = 200 + (week % 7) * 15;
      const iosCost = 20 + (week % 5) * 3;
      rows.push({ week: date, platform: "ANDROID", channel: "Organic", cost: 0, regs: 10000 });
      rows.push({ week: date, platform: "ANDROID", channel: "Meta", cost: androidCost, regs: 1000 });
      rows.push({
        week: date,
        platform: "IOS",
        channel: "Organic",
        cost: 0,
        regs: [1200, 0, 800, 50][week % 4],
      });
      rows.push({ week: date, platform: "IOS", channel: "Meta", cost: iosCost, regs: 12 });
    }
    const result = runAttributedForecastLiveRouter(datasetFrom(rows), { horizon: 12 });
    const os = result.candidates.find((candidate) => candidate.route === "android-ios-sum");
    expect(os).toBeTruthy();
    expect(os.componentEvidence.find((component) => component.key === "ios-organic"))
      .toMatchObject({ passed: false });
    expect(result.osBreakdownEligible).toBe(false);
    expect(result.componentCertificationComplete).toBe(false);
    expect(result.eligible).toBe(false);
  }, 30_000);

  it("keeps third-platform totals on Direct and withholds component certification", () => {
    const rows = fixture(120);
    const start = Date.UTC(2023, 0, 2);
    for (let week = 0; week < 120; week++) {
      const date = new Date(start + week * 7 * 86400000).toISOString().slice(0, 10);
      rows.push({ week: date, platform: "WEB", channel: "Organic", cost: 0, regs: 400 + week });
      rows.push({ week: date, platform: "WEB", channel: "Search", cost: 70 + week, regs: 30 + week * 0.1 });
    }
    const result = runAttributedForecastLiveRouter(datasetFrom(rows), { horizon: 12 });
    expect(result.selectedRoute).toBe("direct-total");
    expect(result.allowedProductionRoutes).toEqual(["direct-total"]);
    expect(result.componentCertificationComplete).toBe(false);
    expect(result.eligible).toBe(false);
  });

  it("rejects mixed aggregate Total and platform rows before route scoring", () => {
    const rows = fixture(120);
    const start = Date.UTC(2023, 0, 2);
    for (let week = 0; week < 120; week++) {
      const date = new Date(start + week * 7 * 86400000).toISOString().slice(0, 10);
      rows.push({ week: date, platform: "TOTAL", channel: "Organic", cost: 0, regs: 2100 + week * 8 });
      rows.push({ week: date, platform: "TOTAL", channel: "Meta", cost: 240 + week * 4, regs: 60 });
    }
    const dataset = datasetFrom(rows);
    expect(dataset.platforms).toEqual(expect.arrayContaining(["android", "ios", "total"]));
    expect(runAttributedForecastLiveRouter(dataset, { horizon: 12 })).toBeNull();
  });

  it("locks budget response when every horizon falls back to the naive path", () => {
    const start = Date.UTC(2023, 0, 2);
    const rows = [];
    for (let week = 0; week < 170; week++) {
      const date = new Date(start + week * 7 * 86400000).toISOString().slice(0, 10);
      ["ANDROID", "IOS"].forEach((platform, platformIndex) => {
        rows.push({ week: date, platform, channel: "Organic", cost: 0, regs: 100 + platformIndex * 5 });
        rows.push({
          week: date,
          platform,
          channel: "Meta",
          cost: 30 + (week % 11) * 7 + platformIndex * 3,
          regs: 20,
        });
      });
    }
    const dataset = datasetFrom(rows);
    const result = runAttributedForecastLiveRouter(dataset, { horizon: 12 });
    expect(result.forecast.useModelByHorizon.every((useModel) => !useModel)).toBe(true);
    expect(result.budgetResponseEligible).toBe(false);
    const baseline = runAttributedForecastLiveScenario(dataset, result, {}, 12);
    const extreme = runAttributedForecastLiveScenario(
      dataset,
      result,
      Object.fromEntries(baseline.channels.map((channel) => [channel, 99999])),
      12,
    );
    expect(extreme.predicted).toEqual(baseline.predicted);
  }, 30_000);

  it("retains the longest evidence window when lookbacks are practically tied", () => {
    const start = Date.UTC(2023, 0, 2);
    const rows = [];
    for (let week = 0; week < 170; week++) {
      const date = new Date(start + week * 7 * 86400000).toISOString().slice(0, 10);
      ["ANDROID", "IOS"].forEach((platform) => {
        rows.push({ week: date, platform, channel: "Organic", cost: 0, regs: 100 });
        rows.push({
          week: date,
          platform,
          channel: "Meta",
          cost: 40 + (week % 9) * 5,
          regs: 20,
        });
      });
    }
    const result = runAttributedForecastLiveRouter(datasetFrom(rows), { horizon: 12 });
    expect(result.selectedSpec.trainingWindow).toBe(78);
    expect(result.dataPreservation).toEqual(expect.objectContaining({
      selectedSpecId: expect.stringContaining("lb78"),
    }));
    expect(result.dataPreservation.selectedSpecId.replace(/^lb\d+__/, ""))
      .toBe(result.dataPreservation.rawBestSpecId.replace(/^lb\d+__/, ""));
  }, 30_000);

  it("keeps Step-aware audit and default-scenario refits identical to production", () => {
    const rows = fixture(170);
    const boundaryWeek = [...new Set(rows.map((row) => row.week))][120];
    const stepFields = [
      { header: "Policy Reset", plat: "common", stepMode: "boundary" },
    ];
    rows.forEach((row) => {
      const isPostStep = row.week >= boundaryWeek;
      row["Policy Reset"] = row.week === boundaryWeek ? 1 : 0;
      if (isPostStep) {
        row.cost *= 0.1;
        row.regs *= row.channel === "Organic" ? 0.7 : 0.18;
      }
    });
    const dataset = datasetFrom(rows, stepFields);
    const router = runAttributedForecastLiveRouter(dataset, { horizon: 12 });
    expect(["level", "reset"]).toContain(router.selectedSpec.stepPolicy);
    const scenario = runAttributedForecastLiveScenario(dataset, router, {}, 12);
    expect(scenario.predicted).toEqual(router.forecast.predicted);
    expect(scenario.organic).toEqual(router.forecast.organic);
    expect(scenario.performance).toEqual(router.forecast.performance);
    if (router.selectedRoute === "android-ios-sum") {
      expect(scenario.parts.map((part) => part.futureCosts))
        .toEqual(router.forecast.parts.map((part) => part.futureCosts));
    }
    const trainingWeeks = new Set(
      [...new Set(rows.map((row) => row.week))].slice(0, -12),
    );
    const sealedAuditDataset = datasetFrom(
      rows.filter((row) => trainingWeeks.has(row.week)),
      stepFields,
    );
    const auditRefit = runAttributedForecastLiveScenario(
      sealedAuditDataset,
      router,
      {},
      12,
    );
    const validationStart = router.backtest.validationStartIndex;
    expect(auditRefit.predicted).toEqual(router.backtest.predicted.slice(validationStart));
    expect(auditRefit.organic).toEqual(router.backtest.organic.slice(validationStart));
    expect(auditRefit.performance).toEqual(router.backtest.performance.slice(validationStart));
  }, 30_000);

  it("validates the exact requested horizon and keeps the sealed outcome out of production selection", () => {
    const baseRows = fixture(180);
    const changedRows = baseRows.map((row) => ({ ...row }));
    const sealedWeeks = new Set([...new Set(baseRows.map((row) => row.week))].slice(-13));
    changedRows.forEach((row) => {
      if (sealedWeeks.has(row.week)) row.regs *= row.channel === "Organic" ? 3 : 0.1;
    });
    const first = runAttributedForecastLiveRouter(datasetFrom(baseRows), { holdout: 12, horizon: 13, foldStep: 1 });
    const changed = runAttributedForecastLiveRouter(datasetFrom(changedRows), { horizon: 13, foldStep: 1 });
    expect(first.selectionHoldoutWeeks).toBe(13);
    expect(first.foldStep).toBe(13);
    expect(first.forecast.predicted).toHaveLength(13);
    expect(first.forecast.marginByHorizon).toHaveLength(13);
    expect(first.selectedRoute).toBe(changed.selectedRoute);
    expect(first.selectedSpec.id).toBe(changed.selectedSpec.id);
    expect(first.forecast.useModelByHorizon).toEqual(changed.forecast.useModelByHorizon);
    expect(first.backtest.wmape).not.toBeCloseTo(changed.backtest.wmape, 2);
    const scenario = runAttributedForecastLiveScenario(datasetFrom(baseRows), first, {}, 13);
    expect(scenario.predicted).toHaveLength(13);
    expect(scenario.marginByHorizon).toEqual(first.forecast.marginByHorizon);
  }, 30_000);
});
