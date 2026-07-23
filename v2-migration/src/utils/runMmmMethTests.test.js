// Golden test port of index.html `runMmmMethTests` (index.html 24525-24860).
// Verifies the v2 MMM math engine against the same inputs/expected values/tolerances.
//
// STATUS: active v2 MMM methodology regression suite. It preserves legacy golden
// checks and adds browser empirical-Bayes prior/forecast safeguards.
import { describe, it, expect } from "vitest";
import { _mmrLcg } from "./testFixtures.js";
import {
  MMM_METH_CONFIG,
  mmmValidate,
  mmmSelectAdstock,
  mmmRunMmm,
  mmmBayesianRun,
  mmmBayesianMediaPenaltySelection,
  mmmBayesianSeasonalitySelection,
  mmmBayesianWeeklyDecomp,
  mmmBayesianForecast,
  mmmForecastRollingSelection,
  mmmForecastGlobalBaseline,
  mmmForecastGlobalSeasonality,
  mmmForecastDampedTrendOffset,
  mmmForecastSeasonalAdjustedPanel,
  mmmForecastRestoreSeasonality,
  mmmBayesianHealth,
  mmmTrendExistence,
  mmmCannibalization,
  mmmGranger,
  mmmChangePoints,
  mmmChangePointDrivers,
  mmmIRF,
  mmmDeseasonHoliday,
  mmmAudit,
  mmmMacroFacts,
  mmmDetectCollinear,
  mmmResolveAbsorb,
  mmmChannelCoverage,
  mmmBuildIntervalCalibration,
  mmmApplyIntervalCalibration,
} from "./mmmMath.js";

describe("runMmmMethTests (golden port)", () => {
  it("selects recent Cost window by rolling holdout and excludes annual seasonality before two cycles", () => {
    const n = 75;
    const week = Array.from({ length: n }, (_, index) => index + 1);
    const meta = week.map((_, index) => 800 + ((index * 17) % 11) * 230);
    const google = week.map((_, index) => 600 + ((index * 7) % 13) * 180);
    const target = week.map((_, index) => 3000 + meta[index] * 1.8 + google[index] * 0.9 + index * 9);
    const panel = {
      week,
      ch: { meta, google },
      channels: [{ key: "meta", label: "Meta", kind: "perf" }, { key: "google", label: "Google", kind: "perf" }],
      targets: { Regs: target },
      dummy: {},
      steps: {},
    };
    const selection = mmmForecastRollingSelection(panel, {
      ...MMM_METH_CONFIG,
      steps: {},
    }, "Regs");
    expect(selection.enabled).toBe(true);
    expect(selection.selected.folds).toBeGreaterThanOrEqual(2);
    expect(selection.selected.wmape).toBeLessThanOrEqual(selection.selected.persistenceWmape);
    expect(selection.candidates.some((item) => item.spec === "cost-trend-year-quarter")).toBe(false);
    expect(selection.candidates.every((item) => item.window <= 51)).toBe(true);
  });

  it("fits full-history seasonality separately and restores it after recent Cost forecast", () => {
    const week = Array.from({ length: 52 }, (_, index) => index + 1);
    const target = week.map((value) => 1000 + value * 4 + 120 * Math.sin(2 * Math.PI * value / 13.04));
    const panel = { week, targets: { Regs: target }, ch: {}, dummy: {}, steps: {} };
    const seasonal = mmmForecastGlobalSeasonality(panel, "Regs", [13.04]);
    const adjusted = mmmForecastSeasonalAdjustedPanel(panel, "Regs", seasonal);
    expect(seasonal?.offsetAt(13)).toBeCloseTo(120 * Math.sin(2 * Math.PI * 13 / 13.04), 3);
    expect(adjusted.targets.Regs[12]).toBeCloseTo(1052, 2);
    const restored = mmmForecastRestoreSeasonality({
      actual: adjusted.targets.Regs,
      fittedHist: adjusted.targets.Regs,
      predFut: [1200, 1204], lo: [1180, 1184], hi: [1220, 1224], baselineFut: [1200, 1204],
      futWeek: [53, 54],
    }, panel, seasonal);
    expect(restored.actual[12]).toBeCloseTo(target[12], 6);
    expect(restored.predFut.every(Number.isFinite)).toBe(true);
  });

  it("damps a global trend after the final observed week instead of extending a shock linearly", () => {
    const trend = { trendOffsetAt: (week) => -568 * week };
    const linearChange = trend.trendOffsetAt(87) - trend.trendOffsetAt(75);
    const dampedChange = mmmForecastDampedTrendOffset(trend, 75, 87) - trend.trendOffsetAt(75);
    expect(dampedChange).toBeCloseTo(linearChange * 0.25, 8);
    const restored = mmmForecastRestoreSeasonality({
      actual: [100], fittedHist: [100], predFut: [100], lo: [90], hi: [110], baselineFut: [100], futWeek: [87],
    }, { week: [75] }, {
      offsetAt: trend.trendOffsetAt,
      futureOffsetAt: (week) => mmmForecastDampedTrendOffset(trend, 75, week),
    });
    expect(restored.predFut[0]).toBeCloseTo(100 + mmmForecastDampedTrendOffset(trend, 75, 87), 8);
  });

  it("estimates forecast trend after removing event and step level shifts", () => {
    const week = Array.from({ length: 75 }, (_, index) => index + 1);
    const delist = week.map((value) => value >= 40 ? 1 : 0);
    const target = week.map((value, index) => 5000 + value * 10 - delist[index] * 1200);
    const eventAdjusted = mmmForecastGlobalBaseline({
      week, targets: { Regs: target }, ch: {}, dummy: {}, steps: { ios_delist: delist },
    }, "Regs", []);
    const raw = mmmForecastGlobalBaseline({
      week, targets: { Regs: target }, ch: {}, dummy: {}, steps: {},
    }, "Regs", []);
    expect(eventAdjusted?.eventControls).toEqual(["step:ios_delist"]);
    expect(eventAdjusted.trendOffsetAt(75) - eventAdjusted.trendOffsetAt(63)).toBeCloseTo(120, 6);
    expect(raw.trendOffsetAt(75) - raw.trendOffsetAt(63)).toBeLessThan(0);
  });

  it("calibrates only from a sufficiently long chronological holdout and preserves asymmetric tails", () => {
    expect(mmmBuildIntervalCalibration([10, 20, 30], [9, 19, 29]).enabled).toBe(false);
    const calibration = mmmBuildIntervalCalibration(
      Array.from({ length: 8 }, (_, i) => 100 + i * 2 + (i % 3 === 0 ? 8 : -2)),
      Array.from({ length: 8 }, (_, i) => 100 + i * 2),
    );
    expect(calibration.enabled).toBe(true);
    expect(calibration.upperResidual).toBeGreaterThan(calibration.lowerResidual);
    const interval = mmmApplyIntervalCalibration(100, 90, 110, calibration);
    expect(interval.calibrated).toBe(true);
    expect(interval.lo).toBeLessThanOrEqual(90);
    expect(interval.hi).toBeGreaterThanOrEqual(110);
  });
  it("builds one browser empirical-Bayes fit for contributions and response curves", () => {
    const n = 64;
    const week = Array.from({ length: n }, (_, i) => i + 1);
    const spend = week.map((t) => 2500 + (t % 9) * 1100);
    const meta = week.map((t) => 1800 + ((t * 7) % 11) * 700);
    const ad = (x, lam) => x.reduce((out, value, i) => {
      out.push(value + (i ? lam * out[i - 1] : 0));
      return out;
    }, []);
    const target = ad(spend, 0.4).map((v, i) => 9000 + 4200 * (v / (v + 7000)) + i * 12);
    const panel = {
      week,
      ch: { google_roi: spend, meta },
      targets: { Regs: target },
      channels: [
        { key: "google_roi", label: "Google", kind: "perf" },
        { key: "meta", label: "Meta", kind: "perf" },
      ],
    };
    const run = mmmBayesianRun(panel, { ...MMM_METH_CONFIG, steps: {} }, "Regs");
    expect(run?.engine).toBe("bayesian");
    expect(Object.keys(run.saturationByChannel)).toEqual(["google_roi", "meta"]);
    expect(run.groupNames).toContain("Performance");
    expect(Number.isFinite(run.saturationByChannel.google_roi.responseAt(3000))).toBe(true);
    const decomp = mmmBayesianWeeklyDecomp(run);
    expect(decomp?.weeks).toHaveLength(n);
    expect(Number.isFinite(decomp?.rmse)).toBe(true);
    // 표준화는 추정 안정성 전용. 표시 기여 합은 원 단위 fitted와 일치해야 한다.
    expect(Math.max(...run.weeks.map((w) => Math.abs(
      w.baseline + Object.values(w.contrib).reduce((sum, value) => sum + value, 0) - w.fitted,
    )))).toBeLessThan(0.02);
    // 절편까지 합친 장기 추세는 감소해도 '음수 광고/기준선'이 아닌 자연수요 레벨이다.
    expect(run.weeks.every((w) => w.contrib.Trend > 0)).toBe(true);
  });

  it("keeps actual-spend media contribution at zero or above instead of showing a negative delta", () => {
    const n = 48;
    const week = Array.from({ length: n }, (_, index) => index + 1);
    const spend = week.map((value) => 400 + value * 35);
    const target = spend.map((value) => 12000 - value * 2);
    const run = mmmBayesianRun({
      week,
      ch: { meta: spend },
      targets: { Regs: target },
      channels: [{ key: "meta", label: "Meta", kind: "perf" }],
      dummy: {}, steps: {},
    }, {
      ...MMM_METH_CONFIG,
      includeTrend: false,
      seasonalityPeriods: [],
      baselineKnots: [],
    }, "Regs");
    const effect = run.saturationByChannel.meta;
    expect(effect.ln_coef).toBeGreaterThanOrEqual(0);
    expect([0, 500, 1000, 5000, 20000].every((spend) => effect.responseAt(spend) >= -1e-8)).toBe(true);
    expect(run.weeks.every((item) => item.contrib.Performance >= -1e-8)).toBe(true);
  });

  it("keeps industry demand separate from media and advances it only as an MMM control", () => {
    const n = 60;
    const week = Array.from({ length: n }, (_, index) => index + 1);
    const spend = week.map((value) => 500 + ((value * 7) % 9) * 80);
    const market = week.map((value) => 900 + ((value * 11) % 13) * 120);
    const target = week.map((_, index) => 2400 + spend[index] * 0.5 + market[index] * 1.8);
    const cfg = { ...MMM_METH_CONFIG, includeTrend: false, seasonalityPeriods: [], adstockGrid: [0], bayesHalfSaturationQuantiles: [0.6], bayesHillSlopeGrid: [1] };
    const panel = {
      week,
      ch: { meta: spend },
      external: { dating_market: market },
      externalDefs: [{ key: "dating_market", label: "Dating market downloads" }],
      targets: { Regs: target },
      channels: [{ key: "meta", label: "Meta", kind: "perf" }],
      dummy: {}, steps: {},
    };
    const run = mmmBayesianRun(panel, cfg, "Regs", false, { skipTransformUncertainty: true, enableMediaPenaltySelection: false, enableSeasonalitySelection: false });
    expect(run.groupNames).toContain("Industry Trend");
    expect(run.names).toContain("industry_dating_market");
    expect(run.weeks.some((item) => Math.abs(item.contrib["Industry Trend"]) > 1e-6)).toBe(true);
    const forecast = mmmBayesianForecast(run, panel, { meta: [1000] }, 1, { futureExternal: { dating_market: [1600] } });
    const held = mmmBayesianForecast(run, panel, { meta: [1000] }, 1, { futureExternal: { dating_market: [market.at(-1)] } });
    expect(forecast.predFut[0]).not.toBeCloseTo(held.predFut[0], 6);
  });

  it("chooses media regularization from chronological holdouts instead of a fixed shrinkage", () => {
    const n = 88;
    const week = Array.from({ length: n }, (_, index) => index + 1);
    const spend = week.map((value) => 300 + ((value * 37) % 17) * 180);
    const target = spend.map((value, index) => 2500 + value * 1.4 + (index % 4) * 12);
    const cfg = {
      ...MMM_METH_CONFIG,
      steps: {},
      includeTrend: false,
      seasonalityPeriods: [],
      adstockGrid: [0],
      bayesHalfSaturationQuantiles: [0.6],
      bayesHillSlopeGrid: [1],
      mediaPenaltyCandidates: [0.05, 4],
      mediaPenaltyMinTrain: 52,
      mediaPenaltyHoldoutWeeks: 12,
      mediaPenaltyMaxFolds: 3,
    };
    const panel = {
      week,
      ch: { meta: spend },
      targets: { Regs: target },
      channels: [{ key: "meta", label: "Meta", kind: "perf" }],
      dummy: {}, steps: {},
    };
    const selection = mmmBayesianMediaPenaltySelection(panel, cfg, "Regs", { skipTransformUncertainty: true });
    expect(selection.enabled).toBe(true);
    expect(selection.selected.folds).toBe(3);
    expect(selection.candidates).toHaveLength(2);
    expect([0.05, 4]).toContain(selection.cfg.mediaPenalty);
    expect(selection.selected.wmape).toBeLessThanOrEqual(selection.selected.bestWmape + selection.selected.tolerance);
    const run = mmmBayesianRun(panel, cfg, "Regs", false, { skipTransformUncertainty: true });
    expect(run.mediaPenaltySelection.enabled).toBe(true);
    expect(run.effectiveCfg.mediaPenalty).toBe(selection.cfg.mediaPenalty);
  });

  it("selects the smoothest seasonal shape that survives chronological holdouts", () => {
    const n = 104;
    const week = Array.from({ length: n }, (_, index) => index + 1);
    const target = week.map((value) => 4000
      + 360 * Math.sin((2 * Math.PI * value) / 52.18)
      + 180 * Math.cos((4 * Math.PI * value) / 52.18));
    const cfg = {
      ...MMM_METH_CONFIG,
      steps: {},
      includeTrend: false,
      adstockGrid: [0],
      seasonalityMinHistory: 78,
      seasonalityMinTrain: 52,
      seasonalityHoldoutWeeks: 12,
      seasonalityMaxFolds: 3,
      seasonalityCandidates: [
        { id: "none", periods: [] },
        { id: "annual-1", periods: [52.18] },
        { id: "annual-2", periods: [52.18, 26.09] },
        { id: "annual-4", periods: [52.18, 26.09, 17.39, 13.04] },
      ],
    };
    const panel = { week, ch: {}, targets: { Regs: target }, channels: [], dummy: {}, steps: {} };
    const selection = mmmBayesianSeasonalitySelection(panel, cfg, "Regs", { skipTransformUncertainty: true });
    expect(selection.enabled).toBe(true);
    expect(selection.selected.folds).toBe(3);
    expect(selection.selected.id).toBe("annual-2");
    const run = mmmBayesianRun(panel, cfg, "Regs", false, { skipTransformUncertainty: true });
    expect(run.seasonalitySelection.selected.id).toBe("annual-2");
    expect(run.seasonalityPeriods).toEqual([52.18, 26.09]);
  });

  it("keeps baseline knots in natural trend and exposes regime change only for mapped steps", () => {
    const n = 60;
    const week = Array.from({ length: n }, (_, index) => index + 1);
    const spend = week.map((value) => 800 + (value % 9) * 120);
    const run = mmmBayesianRun({
      week,
      ch: { meta: spend },
      targets: { Regs: week.map((value) => 4000 + value * 20 + (value > 30 ? (value - 30) * 18 : 0) + spend[value - 1] * 0.2) },
      channels: [{ key: "meta", label: "Meta", kind: "perf" }],
      dummy: {},
      steps: {},
    }, {
      ...MMM_METH_CONFIG,
      baselineKnots: [30],
      seasonalityPeriods: [],
    }, "Regs", false, { skipTransformUncertainty: true });
    expect(run.groupNames).not.toContain("Regime change");
    expect(run.weeks.every((item) => item.contrib["Regime change"] == null && Number.isFinite(item.contrib.Trend))).toBe(true);
  });

  it("profile-averages empirical-Bayes channel confidence over carryover and saturation candidates", () => {
    const n = 56;
    const week = Array.from({ length: n }, (_, i) => i + 1);
    const spend = week.map((t) => 900 + ((t * 13) % 17) * 460);
    const target = spend.map((value, i) => 4200 + 1600 * (value / (value + 4200)) + (i % 5) * 30);
    const run = mmmBayesianRun({
      week,
      ch: { google_roi: spend },
      targets: { Regs: target },
      channels: [{ key: "google_roi", label: "Google", kind: "perf" }],
    }, {
      ...MMM_METH_CONFIG,
      steps: {},
      adstockGrid: [0, 0.4],
      bayesHalfSaturationQuantiles: [0.4, 0.8],
      bayesHillSlopeGrid: [0.6, 1.2],
    }, "Regs", false);
    const effect = run.saturationByChannel.google_roi;
    expect(effect.transformUncertainty.candidateCount).toBe(8);
    expect(effect.transformUncertainty.effectiveCandidateCount).toBeGreaterThanOrEqual(1);
    expect(effect.transformUncertainty.effectiveCandidateCount).toBeLessThanOrEqual(8);
    expect(effect.transformUncertainty.topWeight).toBeGreaterThan(0);
    expect(effect.ci.every(Number.isFinite)).toBe(true);
    const incremental = effect.incrementalAt(effect.recentMean, 1000);
    expect(incremental.ci.every(Number.isFinite)).toBe(true);
    expect(incremental.ci[0]).toBeLessThanOrEqual(incremental.mean);
    expect(incremental.mean).toBeLessThanOrEqual(incremental.ci[1]);
    expect(effect.posteriorPositive).toBeGreaterThanOrEqual(0);
    expect(effect.posteriorPositive).toBeLessThanOrEqual(1);
  });

  it("can refit a reference market on the target market's exact transform units", () => {
    const n = 52;
    const panel = {
      week: Array.from({ length: n }, (_, index) => index + 1),
      ch: { meta: Array.from({ length: n }, (_, index) => 500 + ((index * 11) % 17) * 80) },
      targets: { Regs: Array.from({ length: n }, (_, index) => 1000 + index * 3 + ((index * 11) % 17) * 5) },
      channels: [{ key: "meta", label: "Meta", kind: "perf" }],
    };
    const fixed = { alpha: 0.7, ec: 975, slope: 1.4 };
    const run = mmmBayesianRun(panel, { ...MMM_METH_CONFIG, steps: {} }, "Regs", false, {
      channelParams: { meta: fixed },
      skipTransformUncertainty: true,
    });
    expect(run.params.meta).toMatchObject({ ...fixed, fixedFromTarget: true });
    expect(run.saturationByChannel.meta.params).toMatchObject(fixed);
  });

  it("blocks sustained-spend extrapolation even when raw weekly spend stays below its historical max", () => {
    const n = 64;
    const spend = Array.from({ length: n }, (_, index) => index % 2 === 0 ? 100 : 0);
    const panel = {
      week: Array.from({ length: n }, (_, index) => index + 1),
      ch: { meta: spend },
      targets: { Regs: spend.map((value, index) => 1000 + value * 0.4 + index) },
      channels: [{ key: "meta", label: "Meta", kind: "perf" }],
    };
    const run = mmmBayesianRun(panel, { ...MMM_METH_CONFIG, steps: {} }, "Regs", false, {
      channelParams: { meta: { alpha: 0.8, ec: 100, slope: 1 } },
      skipTransformUncertainty: true,
    });
    const effect = run.saturationByChannel.meta;
    expect(effect.recentMean + 40).toBeLessThanOrEqual(effect.coverage.observedMax);
    expect(effect.observedSustainableSpendMax).toBeLessThan(effect.coverage.observedMax);
    expect(effect.isIncrementInObservedRange(effect.recentMean, 40)).toBe(false);
    expect(effect.observedRangeProfileWeight).toBe(1);
  });

  it("applies an external media prior only to the matched channel", () => {
    const n = 52;
    const panel = {
      week: Array.from({ length: n }, (_, i) => i + 1),
      ch: { google_roi: Array.from({ length: n }, (_, i) => 1200 + i * 40), meta: Array.from({ length: n }, (_, i) => 900 + (i % 7) * 80) },
      targets: { Regs: Array.from({ length: n }, (_, i) => 3000 + i * 14) },
      channels: [{ key: "google_roi", label: "Google", kind: "perf" }, { key: "meta", label: "Meta", kind: "perf" }],
    };
    const run = mmmBayesianRun(panel, { ...MMM_METH_CONFIG, steps: {} }, "Regs", false, { mediaPriors: { meta: { mean: 55, precision: 0.8 } } });
    expect(run.appliedMediaPriors.meta).toEqual({ mean: 55, precision: 0.8 });
    expect(run.appliedMediaPriors.google_roi).toBeUndefined();
    expect(run.saturationByChannel.meta.transformUncertainty.priorLockedTransform).toBe(true);
    expect(run.saturationByChannel.meta.transformUncertainty.candidateCount).toBe(1);
  });

  it("preserves calibrated prior strength when the KPI unit is rescaled", () => {
    const n = 52;
    const spend = Array.from({ length: n }, (_, i) => 700 + ((i * 11) % 13) * 120);
    const target = spend.map((value, i) => 1200 + 45 * (value / (value + 900)) + ((i % 4) - 1.5) * 8);
    const panel = {
      week: Array.from({ length: n }, (_, i) => i + 1),
      ch: { meta: spend },
      targets: { Regs: target },
      channels: [{ key: "meta", label: "Meta", kind: "perf" }],
    };
    const cfg = { ...MMM_METH_CONFIG, steps: {}, adstockGrid: [0], bayesHalfSaturationQuantiles: [0.6], bayesHillSlopeGrid: [1] };
    const prior = { meta: { mean: 60, precision: 1 / (20 ** 2) } };
    const original = mmmBayesianRun(panel, cfg, "Regs", false, { mediaPriors: prior });
    const scale = 1000;
    const rescaled = mmmBayesianRun({
      ...panel,
      targets: { Regs: target.map((value) => value * scale) },
    }, cfg, "Regs", false, { mediaPriors: { meta: { mean: 60 * scale, precision: 1 / ((20 * scale) ** 2) } } });
    const a = original.saturationByChannel.meta;
    const b = rescaled.saturationByChannel.meta;
    expect(b.ln_coef / scale).toBeCloseTo(a.ln_coef, 5);
    expect(b.posteriorPositive).toBeCloseTo(a.posteriorPositive, 5);
    expect(rescaled.posterior.calibratedPriorCount).toBe(1);
    expect(original.posterior.priorScaleConverged).toBe(true);
    expect(original.posterior.priorScaleIterations).toBeLessThanOrEqual(6);
  });

  it("uses steady-state carryover in response curves and advances future controls", () => {
    const n = 64;
    const week = Array.from({ length: n }, (_, i) => i + 1);
    const spend = week.map((t) => 800 + ((t * 7) % 13) * 90);
    const promo = week.map((t) => (t % 9 === 0 ? 1 : 0));
    const target = spend.map((value, i) => 2500 + i * 11 + 180 * Math.sin((2 * Math.PI * (i + 1)) / 52.18) + value * 0.04 + 120 * promo[i]);
    const panel = {
      week,
      dateLabel: week.map((t) => `2025-W${String(t).padStart(2, "0")}`),
      ch: { meta: spend },
      dummy: { promo },
      useDummies: true,
      targets: { Regs: target },
      channels: [{ key: "meta", label: "Meta", kind: "perf" }],
    };
    const cfg = {
      ...MMM_METH_CONFIG,
      steps: {},
      adstockGrid: [0.6],
      bayesHalfSaturationQuantiles: [0.6],
      bayesHillSlopeGrid: [1],
    };
    const run = mmmBayesianRun(panel, cfg, "Regs", false);
    const effect = run.saturationByChannel.meta;
    const steady = 1000 / (1 - 0.6);
    const expected = effect.ln_coef * (steady / (steady + effect.params.ec));
    expect(effect.responseAt(1000)).toBeCloseTo(expected, 8);

    const forecast = mmmBayesianForecast(run, panel, { meta: Array(4).fill(1000) }, 4);
    const withKnownPromo = mmmBayesianForecast(run, panel, { meta: Array(4).fill(1000) }, 4, { futureDummy: { promo: [1, 0, 0, 0] } });
    const trendIndex = run.names.indexOf("trend") + 1;
    const sinIndex = run.names.indexOf("sin_0") + 1;
    expect(forecast.futureRows[0][trendIndex]).not.toBeCloseTo(run.standardizedX.at(-1)[trendIndex], 10);
    expect(forecast.futureRows[0][sinIndex]).not.toBeCloseTo(run.standardizedX.at(-1)[sinIndex], 10);
    expect(new Set(forecast.lo.map((value, i) => +(forecast.hi[i] - value).toFixed(6))).size).toBeGreaterThan(1);
    expect(withKnownPromo.predFut[0]).not.toBeCloseTo(forecast.predFut[0], 6);
    expect(forecast.horizon).toBe(4);
    expect(forecast.histLabels[0]).toBe("2025-W01");
  });

  it("keeps calibrated priors in forward validation and exposes analytical health checks", () => {
    const n = 64;
    const spend = Array.from({ length: n }, (_, i) => 1000 + ((i * 5) % 11) * 75);
    const panel = {
      week: Array.from({ length: n }, (_, i) => i + 1),
      ch: { meta: spend },
      targets: { Regs: spend.map((value, i) => 1800 + value * 0.08 + i * 3) },
      channels: [{ key: "meta", label: "Meta", kind: "perf" }],
    };
    const cfg = { ...MMM_METH_CONFIG, steps: {}, adstockGrid: [0], bayesHalfSaturationQuantiles: [0.6], bayesHillSlopeGrid: [1] };
    const run = mmmBayesianRun(panel, cfg, "Regs", true, { mediaPriors: { meta: { mean: 90, precision: 1 / (20 ** 2) } } });
    expect(run.backtest?.calibratedPriorCount).toBe(1);
    const health = mmmBayesianHealth(run);
    expect(health?.samplingDiagnostic).toBeNull();
    expect(health?.intervalScope).toContain("Conditional Gaussian");
    expect(health?.wmape).toBeGreaterThanOrEqual(0);
    expect(health?.identification?.parameterCount).toBeGreaterThan(1);
  });

  it("withholds budget recommendations when channels are not separately identifiable", () => {
    const n = 64;
    const spend = Array.from({ length: n }, (_, i) => 800 + ((i * 7) % 13) * 90);
    const panel = {
      week: Array.from({ length: n }, (_, i) => i + 1),
      ch: { meta: spend, google: spend.slice() },
      targets: { Regs: spend.map((value, i) => 2000 + value * 0.1 + i * 2) },
      channels: [
        { key: "meta", label: "Meta", kind: "perf" },
        { key: "google", label: "Google", kind: "perf" },
      ],
    };
    const cfg = { ...MMM_METH_CONFIG, adstockGrid: [0], bayesHalfSaturationQuantiles: [0.6], bayesHillSlopeGrid: [1] };
    const run = mmmBayesianRun(panel, cfg, "Regs", false);
    expect(run.identification.highCollinearity).toBe(true);
    expect(run.identification.budgetEligible).toBe(false);
    expect(run.collinear_pairs[0].corr).toBe(1);
    expect(run.saturationByChannel.meta.budgetEligible).toBe(false);
  });

  it("withholds per-channel budget use for sparse, constant, or recently inactive spend", () => {
    const n = 64;
    const sparseSpend = Array.from({ length: n }, (_, index) => index >= 46 && index < 56 ? 500 + index * 20 : 0);
    const constantSpend = Array(n).fill(1000);
    const coverage = mmmChannelCoverage({
      week: Array.from({ length: n }, (_, index) => index + 1),
      ch: { sparse: sparseSpend, constant: constantSpend },
      channels: [
        { key: "sparse", label: "Sparse", kind: "perf" },
        { key: "constant", label: "Constant", kind: "perf" },
      ],
    }, MMM_METH_CONFIG);
    expect(coverage.sparse.sparse).toBe(true);
    expect(coverage.sparse.trailingZero).toBe(true);
    expect(coverage.constant.constantSpend).toBe(true);
    expect(coverage.sparse.observedMax).toBe(Math.max(...sparseSpend));
    expect(Number.isFinite(coverage.sparse.observedP95)).toBe(true);

    const panel = {
      week: Array.from({ length: n }, (_, index) => index + 1),
      ch: { sparse: sparseSpend },
      targets: { Regs: sparseSpend.map((value, index) => 2000 + value * 0.2 + index * 4) },
      channels: [{ key: "sparse", label: "Sparse", kind: "perf" }],
    };
    const run = mmmBayesianRun(panel, { ...MMM_METH_CONFIG, steps: {}, adstockGrid: [0], bayesHalfSaturationQuantiles: [0.6], bayesHillSlopeGrid: [1] }, "Regs", false);
    expect(run.saturationByChannel.sparse.budgetEligible).toBe(false);
    expect(run.saturationByChannel.sparse.budgetGateReasons).toContain("sparse-active-weeks");
    expect(run.saturationByChannel.sparse.budgetGateReasons).toContain("recently-inactive");
    expect(run.saturationByChannel.sparse.isIncrementInObservedRange(500, 100)).toBe(true);
    expect(run.saturationByChannel.sparse.isIncrementInObservedRange(coverage.sparse.observedMax, 1)).toBe(false);
  });

  it("does not invent an RR audit by summing incompatible multi-Y targets", () => {
    const panel = {
      week: Array.from({ length: 24 }, (_, i) => i + 1),
      ch: { meta: Array.from({ length: 24 }, (_, i) => 100 + i) },
      targets: {
        Traffic: Array.from({ length: 24 }, (_, i) => 1000 + i),
        Revenue: Array.from({ length: 24 }, (_, i) => 100000 + i * 100),
      },
      channels: [{ key: "meta", label: "Meta", kind: "perf" }],
    };
    expect(mmmAudit(panel, MMM_METH_CONFIG)).toBeNull();
  });

  it("blocks missing calendar weeks and only blocks missing values for the selected Y", () => {
    const panel = {
      week: [1, 2, 3],
      calendarGaps: { count: 1, gaps: [{ after: "2025-01-06", before: "2025-01-20", missingWeeks: 1 }] },
      ch: { meta: [100, 120, 130] },
      targets: { Regs: [10, 12, 13], Revenue: [1000, NaN, 1300] },
      channels: [{ key: "meta", label: "Meta", kind: "perf" }],
    };
    const regs = mmmValidate(panel, "en", "Regs");
    expect(regs.issues.some((message) => message.includes("calendar week"))).toBe(true);
    expect(regs.issues.some((message) => message.includes("Revenue"))).toBe(false);
    expect(regs.warnings.some((message) => message.includes("Revenue"))).toBe(true);
    const revenue = mmmValidate({ ...panel, calendarGaps: { count: 0, gaps: [] } }, "en", "Revenue");
    expect(revenue.issues.some((message) => message.includes("Revenue"))).toBe(true);
    const mappedDiagnostics = mmmValidate({
      ...panel,
      calendarGaps: { count: 0, gaps: [] },
      timeDiagnostics: {
        issues: [{ messageKo: "중복 주차", messageEn: "Duplicate week" }],
        warnings: [{ messageKo: "경계 주 제외", messageEn: "Boundary week excluded" }],
      },
    }, "en", "Regs");
    expect(mappedDiagnostics.issues).toContain("Duplicate week");
    expect(mappedDiagnostics.warnings).toContain("Boundary week excluded");
    expect(mappedDiagnostics.issues.every((message) => typeof message === "string")).toBe(true);
  });

  it("blocks negative spend and non-binary weekly event/regime inputs", () => {
    const validation = mmmValidate({
      week: [1, 2, 3],
      ch: { meta: [100, -10, 120] },
      dummy: { promo: [0, 2, 1] },
      steps: { launch: [0, 0.5, 1] },
      targets: { Regs: [10, 12, 13] },
      channels: [{ key: "meta", label: "Meta", kind: "perf" }],
    }, "en", "Regs");
    expect(validation.issues.some((message) => message.includes("negative spend"))).toBe(true);
    expect(validation.issues.some((message) => message.includes("Event 'promo'") && message.includes("0 or 1"))).toBe(true);
    expect(validation.issues.some((message) => message.includes("Regime 'launch'") && message.includes("0 or 1"))).toBe(true);
  });

  it("warns when a one-week marker is incorrectly mapped as a persistent regime", () => {
    const report = mmmValidate({
      week: [1, 2, 3, 4, 5, 6],
      targets: { Regs: [10, 11, 12, 13, 14, 15] },
      ch: { meta: [1, 2, 3, 4, 5, 6] },
      channels: [{ key: "meta", label: "Meta" }],
      dummy: {},
      steps: { ios_reopen: [0, 0, 0, 1, 0, 0] },
    });
    expect(report.warnings.some((message) => message.includes("구조변화 'ios_reopen'의 ON 주차가 1주뿐"))).toBe(true);
  });

  it("T1-T8 MMM methodology pipeline matches index.html", () => {
    const rng = _mmrLcg(77);
    const n = 104;
    const week = Array.from({ length: n }, (_, i) => i + 1);
    const spend = week.map((t) => 5000 + t * 80 + (t > 50 ? 4000 : 0));
    const meta = week.map((t) => (t > 30 ? 2000 : 0));
    const ad = (x, l) => {
      const o = [];
      for (let i = 0; i < x.length; i++) o.push(x[i] + (i > 0 ? l * o[i - 1] : 0));
      return o;
    };
    const sat = ad(spend, 0.3).map((v) => Math.log1p(v));
    const target = week.map(
      (t, i) =>
        8000 +
        600 * sat[i] -
        5 * t +
        400 * Math.sin((2 * Math.PI * t) / 52.18) +
        rng() * 80,
    );
    const seolW = new Set([5, 6, 56, 57]),
      chuW = new Set([38, 39, 92, 93]);
    const dummy = {
      PreLNY: week.map((t) => (t === 4 || t === 55 ? 1 : 0)),
      Seollal: week.map((t) => (seolW.has(t) ? 1 : 0)),
      ChuseokOnly: week.map((t) => (chuW.has(t) ? 1 : 0)),
      PostChuWk: week.map((t) => (t === 40 || t === 94 ? 1 : 0)),
      OtherHol: week.map((t) => (t === 1 || t === 53 ? 1 : 0)),
    };
    const panel = {
      week,
      ch: { google_roi: spend, meta },
      dummy,
      targets: { Regs: target },
    };
    const cfg = MMM_METH_CONFIG;

    // T1 validate 통과
    const v = mmmValidate(panel);
    expect(v.issues.length).toBe(0);

    // T2 select_adstock best in grid
    const sa = mmmSelectAdstock(panel, cfg, "Regs");
    expect(cfg.adstockGrid.includes(sa.best_lambda)).toBe(true);

    // T3 spend 채널 elasticity 양수
    const mm = mmmRunMmm(panel, cfg, "Regs");
    const g = mm.elasticities.find((e) => e.var === "ln_google_roi");
    expect(g && g.coef > 0).toBe(true);

    // T4 Shapley 합=전체R²
    const sumSh = mm.shapley.rows.reduce((a, r) => a + r.r2_share, 0);
    expect(Math.abs(sumSh - mm.shapley.total) < 1e-6).toBe(true);

    // T5 trend existence verdict 문자열
    const tr = mmmTrendExistence(panel, cfg, "Regs");
    expect(typeof tr.verdict === "string" && tr.adf_ct_p != null).toBe(true);

    // T6 cannibalization 3-state verdict
    const cn = mmmCannibalization(panel, cfg, "Regs", {
      coef: g.coef,
      ci_lo: g.ci_lo,
      ci_hi: g.ci_hi,
      p: g.p,
    });
    const vt = cn.votes,
      vsum = vt.FOR + vt.AGAINST + vt.ABSTAIN;
    expect(
      ["ok", "cannibal", "inconclusive"].includes(cn.verdict_class) && vsum === 3,
    ).toBe(true);

    // T6b 검정력 게이트 OK 차단
    const colPanel = {
      week: panel.week,
      ch: { x: panel.week.map((w) => 1000 + w * 50) },
      dummy: {},
      targets: { Regs: panel.targets.Regs },
      channels: [{ key: "x", label: "x", kind: "perf" }],
    };
    const cnGate = mmmCannibalization(
      colPanel,
      cfg,
      "Regs",
      { coef: -0.01, ci_lo: -0.5, ci_hi: 0.48, p: 0.9, vif: 9 },
      "x",
    );
    expect(
      cnGate.power_gate.blocked &&
        cnGate.verdict_class !== "ok" &&
        cnGate.net_incrementality.vote === "ABSTAIN",
    ).toBe(true);

    const oscPanel = {
      week: panel.week,
      ch: { x: panel.week.map((w) => 5000 + 2000 * Math.sin(w / 3)) },
      dummy: {},
      targets: { Regs: panel.targets.Regs },
      channels: [{ key: "x", label: "x", kind: "perf" }],
    };

    // T6c 유의 음순효과→cannibal
    const cnNeg = mmmCannibalization(
      oscPanel,
      cfg,
      "Regs",
      { coef: -0.3, ci_lo: -0.5, ci_hi: -0.1, p: 0.001 },
      "x",
    );
    expect(
      cnNeg.net_incrementality.vote === "AGAINST" &&
        cnNeg.verdict_class === "cannibal",
    ).toBe(true);

    // T6d non-sig는 FOR 아님(ABSTAIN)
    const cnNS = mmmCannibalization(
      oscPanel,
      cfg,
      "Regs",
      { coef: 0.0027, ci_lo: -0.4, ci_hi: 0.41, p: 0.6668 },
      "x",
    );
    expect(cnNS.net_incrementality.vote).toBe("ABSTAIN");

    // T6e granger(prewhiten) null가드·시차탐지·결정론
    const gNull = mmmGranger(target.slice(0, 20), spend.slice(0, 20), 6);
    const gx = week.map((w) => 6000 + 2500 * Math.sin(w / 4));
    const lgx = gx.map((v) => Math.log1p(v));
    const gy = lgx.map((_, i) => 20000 + 5000 * lgx[Math.max(0, i - 2)] + 0.5 * rng());
    const gG = mmmGranger(gy, gx, 6);
    const gG2 = mmmGranger(gy, gx, 6);
    expect(
      gNull === null &&
        gG &&
        gG.spend_to_organic &&
        gG.organic_to_spend &&
        gG.spend_to_organic.coefSum > 0 &&
        gG.spend_to_organic.p < 0.05 &&
        JSON.stringify(gG) === JSON.stringify(gG2),
    ).toBe(true);

    // T6f changepoint null가드·반전(shift)탐지·결정론
    const cpShort = mmmChangePoints([1, 2, 3, 4, 5]);
    const up = Array.from({ length: 26 }, (_, i) => 100 + 10 * i);
    const down = Array.from({ length: 26 }, (_, i) => 350 - 10 * (i + 1));
    const vshape = up.concat(down);
    const cpV = mmmChangePoints(vshape, { minSeg: 4, penaltyMult: 2 });
    const cpV2 = mmmChangePoints(vshape, { minSeg: 4, penaltyMult: 2 });
    const nearPeak = cpV.points.some(
      (idx, i) => Math.abs(idx - 26) <= 3 && cpV.pointTypes[i] === "shift",
    );
    expect(
      cpShort.points.length === 0 &&
        cpV.points.length >= 1 &&
        nearPeak &&
        JSON.stringify(cpV) === JSON.stringify(cpV2),
    ).toBe(true);

    // T6g spike 분류 + 드라이버 카드
    const flat = Array.from({ length: 40 }, (_, i) => 1000 + (i % 2 === 0 ? 5 : -5));
    flat[20] = 5000;
    const cpSp = mmmChangePoints(flat, { minSeg: 4, penaltyMult: 2 });
    const hasSpike =
      cpSp.pointTypes.includes("spike") && cpSp.outliers.some((o) => o.idx === 20);
    const drvSp = mmmChangePointDrivers(
      { week: flat.map((_, i) => i + 1), targets: { Regs: flat }, ch: {}, dummy: {} },
      "Regs",
      cpSp,
    );
    const drvOk =
      drvSp.length === cpSp.points.length &&
      drvSp.every((d) => d.targetBefore != null && Array.isArray(d.channels));
    expect(hasSpike && drvOk).toBe(true);

    // T6h IRF null가드·구조·결정론
    const irfNull = mmmIRF(target.slice(0, 20), spend.slice(0, 20), { horizon: 12 });
    const irfA = mmmIRF(target, spend, { horizon: 12 }),
      irfB = mmmIRF(target, spend, { horizon: 12 });
    expect(
      irfNull === null &&
        irfA &&
        irfA.irf.length === 13 &&
        irfA.cum.length === 13 &&
        irfA.lag >= 1 &&
        JSON.stringify(irfA) === JSON.stringify(irfB),
    ).toBe(true);

    // T6i 계절·휴일 제거(대칭·base보존·분산↓·결정론)
    const seasY = week.map(
      (_, i) =>
        1000 +
        250 * Math.sin((2 * Math.PI * i) / 52.18) +
        (i === 5 || i === 57 ? 600 : 0) +
        rng() * 10,
    );
    const seasPanel = {
      week,
      targets: { Regs: seasY },
      dummy: { Spike: week.map((_, i) => (i === 5 || i === 57 ? 1 : 0)) },
      steps: {},
    };
    const adj = mmmDeseasonHoliday(seasPanel, "Regs");
    const adj2 = mmmDeseasonHoliday(seasPanel, "Regs");
    const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
    const sd = (a) => {
      const m = mean(a);
      return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length);
    };
    const baseKept = Math.abs(mean(adj) - mean(seasY)) < 0.5;
    const flatter = sd(adj) < sd(seasY) * 0.6;
    expect(
      adj.length === n &&
        baseKept &&
        flatter &&
        JSON.stringify(adj) === JSON.stringify(adj2),
    ).toBe(true);

    // T6j 산발집행→선행성 ABSTAIN·flighted 플래그
    const flightSp = week.map((_, i) => (i % 20 < 6 ? 8000 + rng() * 400 : 0));
    const flightPanel = {
      week,
      ch: { fl: flightSp },
      dummy: {},
      targets: { Regs: panel.targets.Regs },
      channels: [{ key: "fl", label: "fl", kind: "perf" }],
    };
    const cnFl = mmmCannibalization(
      flightPanel,
      cfg,
      "Regs",
      { coef: -0.2, ci_lo: -0.4, ci_hi: 0.02, p: 0.2 },
      "fl",
    );
    expect(
      cnFl.flighted === true &&
        cnFl.precedence.vote === "ABSTAIN" &&
        cnFl.flight_transitions >= 4,
    ).toBe(true);

    // T7 audit는 Regs+React composite가 있을 때만 유효(다른 Y 임의합산 금지)
    expect(mmmAudit(panel, cfg)).toBeNull();
    const react = panel.targets.Regs.map((value, i) => value * 0.2 + (i % 3));
    const auditPanel = {
      ...panel,
      targets: {
        ...panel.targets,
        React: react,
        RR: panel.targets.Regs.map((value, i) => value + react[i]),
      },
    };
    const au = mmmAudit(auditPanel, cfg);
    expect(au.r2 > 0 && au.r2 < 1).toBe(true);

    // T8 결정론
    const d1 = mmmRunMmm(panel, cfg, "Regs").elasticities[0].coef,
      d2 = mmmRunMmm(panel, cfg, "Regs").elasticities[0].coef;
    expect(d1 === d2).toBe(true);
  });

  // ── macro facts / collinear-absorb (deterministic, no RNG) ──
  it("mmmMacroFacts: YoY 2024→2025 for spend & target", () => {
    const cfg = MMM_METH_CONFIG;
    // 2 years, 4 weeks each; ch spend 2024=100/wk → 2025=200/wk (+100%), target 10→15 (+50%)
    const week = Array.from({ length: 8 }, (_, i) => i + 1);
    const dates = week.map((_, i) =>
      i < 4
        ? new Date(Date.UTC(2024, 0, 1 + i * 7))
        : new Date(Date.UTC(2025, 0, 1 + (i - 4) * 7)),
    );
    const panel = {
      week,
      ch: { g: week.map((_, i) => (i < 4 ? 100 : 200)) },
      dummy: {},
      targets: { Regs: week.map((_, i) => (i < 4 ? 10 : 15)) },
      channels: [{ key: "g", label: "Google", kind: "perf" }],
    };
    const mf = mmmMacroFacts(panel, cfg, dates);
    expect(mf["전체유료 spend YoY %"]).toBe(100);
    expect(mf["Google spend YoY %"]).toBe(100);
    expect(mf["Regs YoY %"]).toBe(50);
    // 단일 연도면 빈 객체
    const oneYr = dates.slice(0, 4);
    expect(
      Object.keys(mmmMacroFacts(panel, cfg, oneYr)).length,
    ).toBe(0);
  });

  it("mmmDetectCollinear + mmmResolveAbsorb: perfectly correlated ch~step", () => {
    const cfg = MMM_METH_CONFIG;
    const n = 30;
    const week = Array.from({ length: n }, (_, i) => i + 1);
    // step "LineOff" turns on at week 15 → ln(1+spend) that mirrors it perfectly
    const spend = week.map((_, i) => (i >= 14 ? 5000 : 0));
    const panel = {
      week,
      ch: { s: spend },
      dummy: {},
      steps: { LineOff: week.map((_, i) => (i >= 14 ? 1 : 0)) },
      stepDefs: [{ key: "LineOff", label: "LineOff", kind: "step" }],
      targets: { Regs: week.map((_, i) => 100 + i) },
      channels: [{ key: "s", label: "Spend", kind: "perf" }],
    };
    const pairs = mmmDetectCollinear(panel, cfg);
    expect(pairs.length).toBe(1);
    expect(pairs[0].channel).toBe("s");
    expect(pairs[0].step).toBe("LineOff");
    expect(Math.abs(pairs[0].corr)).toBeGreaterThanOrEqual(0.9);
    // 기본 흡수 = step
    const r1 = mmmResolveAbsorb(panel, cfg);
    expect(r1.absorbed.size).toBe(0);
    expect(r1.notices[0].side).toBe("none");
    expect(r1.notices[0].dropped).toBeNull();
    // choice=channel → 채널 흡수
    const r2 = mmmResolveAbsorb(panel, cfg, { "s__LineOff": "channel" });
    expect(r2.absorbed.has("s")).toBe(true);
    expect(r2.notices[0].side).toBe("channel");
  });
});
