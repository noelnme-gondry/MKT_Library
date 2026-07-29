// Golden test port of index.html `runMmmMethTests` (index.html 24525-24860).
// Verifies the v2 MMM math engine against the same inputs/expected values/tolerances.
//
// STATUS: active v2 MMM methodology regression suite. It preserves legacy golden
// checks and adds browser empirical-Bayes prior/forecast safeguards.
import { describe, it, expect } from "vitest";
import { _mmrLcg } from "./testFixtures.js";
import { buildDemoCsv } from "./demoData.js";
import {
  MMM_METH_CONFIG,
  mmmExternalRelativeIndex,
  mmmValidate,
  mmmSelectAdstock,
  mmmRunMmm,
  mmmBayesianRun,
  mmmBayesianMcmcRun,
  mmmMeridianAdstock,
  mmmTruncatedNormalMoments,
  mmmAggregateCrossCheck,
  mmmDataQualityAudit,
  mmmBayesianCorrelatedGroupRefit,
  mmmBayesianMediaPenaltySelection,
  mmmBayesianSeasonalitySelection,
  mmmSeasonalityRollingRescueDecision,
  mmmBayesianWeeklyDecomp,
  mmmBayesianForecast,
  mmmForecastBackgroundCandidateCap,
  mmmForecastCandidateCap,
  mmmForecastCandidateSearchAudit,
  mmmForecastRollingSelection,
  MMM_FORECAST_DEFAULT_TREND_DAMPING,
  MMM_FORECAST_MEDIA_PENALTY_STRENGTHS,
  mmmForecastScaledMediaPenalty,
  mmmForecastDeclaredFitContract,
  mmmForecastNaiveBaselines,
  mmmForecastBlendPredictions,
  mmmForecastApplySelectedBlend,
  mmmForecastNestedSelection,
  mmmForecastCombineNestedParts,
  mmmForecastSelectNestedRoute,
  mmmForecastScenarioEligibility,
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
  mmmAutomaticTrendKnots,
  mmmTrendDirectionPlan,
  mmmJointStructureDecision,
} from "./mmmMath.js";

describe("runMmmMethTests (golden port)", () => {
  it("exposes deterministic Meridian-like truncated posterior primitives", () => {
    const moments = mmmTruncatedNormalMoments(0, 1);
    expect(moments.mean).toBeCloseTo(0.797884, 4);
    expect(moments.variance).toBeCloseTo(0.36338, 3);
    expect(mmmAggregateCrossCheck(100, 110, 0.15).verdict).toBe("consistent");
    expect(mmmAggregateCrossCheck(100, 140, 0.15).verdict).toBe("abstain-group-definition-sensitive");
    expect(JSON.stringify(moments)).toBe(JSON.stringify(mmmTruncatedNormalMoments(0, 1)));
  });
  it("supports Meridian-style normalized finite-lag adstock", () => {
    const geometric = mmmMeridianAdstock([0, 10, 0], 0.5, 2, "geometric");
    const binomial = mmmMeridianAdstock([0, 10, 0], 0.5, 2, "binomial");
    expect(geometric[1]).toBeCloseTo(10 / 1.75, 8);
    expect(binomial[1]).toBeCloseTo(2.5, 8);
    expect(geometric[2]).toBeGreaterThan(0);
    expect(binomial[2]).toBeGreaterThan(0);
  });

  it("fits the declared non-seasonal forecast structure without annual RBF reselection", () => {
    const n = 72;
    const week = Array.from({ length: n }, (_, index) => index + 1);
    const cost = week.map((value) => 600 + (value % 9) * 70);
    const contract = mmmForecastDeclaredFitContract({
      ...MMM_METH_CONFIG,
      trendDirectionFirst: true,
      seasonalityPeriods: [],
      seasonalityBasis: { type: "cyclic-rbf", knots: 8 },
      baselineKnots: [],
      adstockGrid: [0],
      bayesHalfSaturationQuantiles: [0.6],
      bayesHillSlopeGrid: [1],
    }, { skipTransformUncertainty: true });
    const run = mmmBayesianRun({
      week,
      ch: { cost },
      channels: [{ key: "cost", label: "Cost", kind: "perf" }],
      targets: { Regs: week.map((value, index) => 1200 + value * 4 + cost[index] * 0.7) },
      dummy: {},
      steps: {},
    }, contract.cfg, "Regs", false, contract.options);
    expect(contract.cfg.trendDirectionFirst).toBe(false);
    expect(contract.cfg.seasonalityBasis).toBe(null);
    expect(contract.options.enableJointStructureSelection).toBe(false);
    expect(contract.options.enableSeasonalitySelection).toBe(false);
    expect(contract.options.enableBaselineSelection).toBe(false);
    expect(contract.trendDamping).toBe(MMM_FORECAST_DEFAULT_TREND_DAMPING);
    expect(contract.trendDamping).toBe(0.25);
    expect(run).not.toBe(null);
    expect(run.names.some((name) => name.startsWith("season_rbf_") || /^(sin|cos)_/.test(name))).toBe(false);
  });

  it("keeps recent rolling origins and scores stable when an old calendar-consistent prefix is added", () => {
    const makePanel = (start, end) => {
      const week = Array.from({ length: end - start + 1 }, (_, index) => start + index);
      const cost = week.map((value) => 700 + (value % 9) * 90);
      return {
        week,
        ch: { cost },
        channels: [{ key: "cost", label: "Cost", kind: "perf" }],
        targets: { Regs: week.map((value, index) => 2400 + value * 6 + cost[index] * 0.8) },
        dummy: {},
        steps: {},
      };
    };
    const cfg = {
      ...MMM_METH_CONFIG,
      adstockGrid: [0],
      bayesHalfSaturationQuantiles: [0.5],
      bayesHillSlopeGrid: [1],
    };
    const options = {
      maxSelectionFolds: 6,
      candidateWindows: [26, 52, 78, 104],
    };
    // Both panels already support the same 26/52/78/104-week candidate set.
    // The second only adds rows older than every declared lookback.
    const recentOnly = mmmForecastRollingSelection(makePanel(41, 220), cfg, "Regs", options);
    const withPrefix = mmmForecastRollingSelection(makePanel(1, 220), cfg, "Regs", options);
    expect(recentOnly.relativeOriginOffsets).toEqual(withPrefix.relativeOriginOffsets);
    expect(recentOnly.relativeOriginOffsets).toEqual([60, 48, 36, 24, 12, 0]);
    recentOnly.relativeOriginOffsets.slice(1).forEach((offset, index) => {
      expect(recentOnly.relativeOriginOffsets[index] - offset).toBeGreaterThanOrEqual(recentOnly.horizon);
    });
    expect(recentOnly.selected.candidateId).toBe(withPrefix.selected.candidateId);
    expect(recentOnly.selected.wmape).toBeCloseTo(withPrefix.selected.wmape, 8);
    expect(recentOnly.selected.latestWmape).toBeCloseTo(withPrefix.selected.latestWmape, 8);
    expect(recentOnly.selected.foldSeries).toEqual(withPrefix.selected.foldSeries);
  }, 30_000);

  it("space-fills capped forecast candidates across every structural axis deterministically", () => {
    const n = 180;
    const week = Array.from({ length: n }, (_, index) => index + 1);
    const cost = week.map((value) => 800 + (value % 11) * 60);
    const target = week.map((value, index) =>
      3000 + value * 3 + 180 * Math.sin((2 * Math.PI * value) / 52.18) + cost[index] * 0.5,
    );
    const panel = {
      week,
      ch: { cost },
      channels: [{ key: "cost", label: "Cost", kind: "perf" }],
      targets: { Regs: target },
      dummy: { launch: week.map((value) => Number(value >= 90 && value < 96)) },
      steps: {},
    };
    const cfg = {
      ...MMM_METH_CONFIG,
      adstockGrid: [0],
      bayesHalfSaturationQuantiles: [0.6],
      bayesHillSlopeGrid: [1],
    };
    const options = {
      candidateWindows: [26, 52, 78, 104, 104],
      trendOptions: [
        { trendScope: "none" },
        { trendScope: "recent" },
        { trendScope: "global", trendWindow: 24 },
        { trendScope: "global", trendWindow: 36 },
        { trendScope: "global", trendWindow: "all" },
        { trendScope: "global", trendWindow: "all" },
      ],
      mediaPenaltyStrengths: [0, 0.01, 0.05, 0.2, 0.2],
      maxSelectionFolds: 8,
    };
    const run = (cap) => mmmForecastRollingSelection(panel, cfg, "Regs", {
      ...options,
      maxCandidateConfigurations: cap,
    });
    const full = run(40);
    const tiny = run(5);
    const tinyAgain = run(5);
    const expectedFamilies = [
      "cost-trend",
      "cost-trend-quarter",
      "cost-trend-global-quarter",
      "cost-trend-year-quarter",
      "cost-trend-global-year-quarter",
    ];
    expect(full.candidateConfigurationCounts.cap).toBe(40);
    expect(full.evaluatedCandidateConfigurations).toBe(40);
    expect(Object.keys(full.candidateConfigurationCounts.plannedByWindow)).toEqual(["26", "52", "78", "104", "expanding"]);
    expect(Object.keys(full.candidateConfigurationCounts.plannedByTrend)).toEqual([
      "global:24",
      "global:36",
      "global:all",
      "none",
      "recent",
    ]);
    expect(Object.keys(full.candidateConfigurationCounts.plannedByControl)).toEqual(["mapped", "none"]);
    expect(Object.keys(full.candidateConfigurationCounts.plannedByTransform)).toEqual([
      "auto",
      "hill",
      "identity",
      "log1p",
    ]);
    expect(Object.keys(full.candidateConfigurationCounts.plannedByPenalty)).toEqual(["0", "0.01", "0.05", "0.2"]);
    expect(Object.keys(full.candidateConfigurationCounts.plannedByDamping)).toEqual(["0", "0.25", "0.5", "0.75"]);
    expect([...new Set(full.candidates.map((candidate) =>
      candidate.windowMode === "expanding" ? "expanding" : String(candidate.window),
    ))].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true })))
      .toEqual(["26", "52", "78", "104", "expanding"]);
    expect([...new Set(full.candidates.map((candidate) =>
      candidate.trendScope === "global" ? `global:${candidate.trendWindow}` : candidate.trendScope,
    ))].sort()).toEqual(["global:24", "global:36", "global:all", "none", "recent"]);
    expect([...new Set(full.candidates.map((candidate) => candidate.controlPolicy))].sort())
      .toEqual(["mapped", "none"]);
    expect([...new Set(full.candidates.map((candidate) => candidate.transformPolicy))].sort())
      .toEqual(["auto", "hill", "identity", "log1p"]);
    expect([...new Set(full.candidates.map((candidate) => candidate.mediaPenaltyStrength))].sort((a, b) => a - b))
      .toEqual([0, 0.01, 0.05, 0.2]);
    expect([...new Set(full.candidates.map((candidate) => candidate.trendDamping))].sort((a, b) => a - b))
      .toEqual([0, 0.25, 0.5, 0.75]);
    expect([...new Set(full.candidates.map((candidate) => candidate.spec))].sort())
      .toEqual(expectedFamilies.slice().sort());
    expect(new Set(full.candidates.map((candidate) => candidate.candidateId)).size)
      .toBe(full.candidates.length);
    expectedFamilies.forEach((spec) => {
      expect(full.candidateConfigurationCounts.plannedBySpec[spec]).toBeGreaterThan(0);
      expect(tiny.candidateConfigurationCounts.plannedBySpec[spec]).toBe(1);
    });
    expect(tiny.evaluatedCandidateConfigurations).toBe(5);
    expect(Object.keys(tiny.candidateConfigurationCounts.plannedByWindow).length).toBeGreaterThanOrEqual(3);
    expect(Object.keys(tiny.candidateConfigurationCounts.plannedByTrend).length).toBeGreaterThanOrEqual(3);
    expect(full.candidateSearchAudit).toMatchObject({
      complete: true,
      planned: 40,
      evaluated: 40,
      missingAxes: {},
    });
    expect(JSON.stringify(tiny)).toBe(JSON.stringify(tinyAgain));
  }, 30_000);

  it("scales the browser candidate budget by feature complexity and gates incomplete coverage", () => {
    expect([
      mmmForecastCandidateCap(0),
      mmmForecastCandidateCap(8),
      mmmForecastCandidateCap(9),
      mmmForecastCandidateCap(16),
      mmmForecastCandidateCap(17),
      mmmForecastCandidateCap(32),
      mmmForecastCandidateCap(33),
      mmmForecastCandidateCap(100),
    ]).toEqual([40, 40, 24, 24, 16, 16, 8, 8]);
    expect([
      mmmForecastBackgroundCandidateCap(0),
      mmmForecastBackgroundCandidateCap(16),
      mmmForecastBackgroundCandidateCap(17),
      mmmForecastBackgroundCandidateCap(32),
      mmmForecastBackgroundCandidateCap(33),
      mmmForecastBackgroundCandidateCap(100),
    ]).toEqual([40, 40, 24, 24, 16, 16]);
    const audit = mmmForecastCandidateSearchAudit({
      planned: 8,
      attempted: 24,
      evaluated: 6,
      plannedAxes: {
        spec: { level: 4, annual: 4 },
        transform: { identity: 4, hill: 4 },
      },
      fittedAxes: {
        spec: { level: 6 },
        transform: { identity: 6 },
      },
    });
    expect(audit).toEqual({
      complete: false,
      reasons: ["candidate-search-incomplete", "candidate-diversity-incomplete"],
      planned: 8,
      attempted: 24,
      evaluated: 6,
      fitSuccessRate: 0.25,
      missingAxes: { spec: ["annual"], transform: ["hill"] },
    });
    expect(mmmForecastScenarioEligibility([{
      selection: { decisionEligible: false, decisionReasons: audit.reasons },
      run: { identification: {} },
    }])).toEqual({
      eligible: false,
      reasons: ["candidate-search-incomplete", "candidate-diversity-incomplete"],
    });
  });

  it("uses the same 104-week naive reference for 26- and 104-week candidates at a shared origin", () => {
    const n = 180;
    const week = Array.from({ length: n }, (_, index) => index + 1);
    const cost = week.map((value) => 900 + (value % 13) * 70);
    const panel = {
      week,
      ch: { cost },
      channels: [{ key: "cost", label: "Cost", kind: "perf" }],
      targets: {
        Regs: week.map((value, index) =>
          2600 + value * 4 + 120 * Math.sin((2 * Math.PI * value) / 52.18) + cost[index] * 0.7,
        ),
      },
      dummy: {},
      steps: {},
    };
    const cfg = {
      ...MMM_METH_CONFIG,
      adstockGrid: [0],
      bayesHalfSaturationQuantiles: [0.6],
      bayesHillSlopeGrid: [1],
    };
    const selectWindow = (window) => mmmForecastRollingSelection(panel, cfg, "Regs", {
      candidateWindows: [window],
      specIds: ["cost-trend"],
      trendOptions: [{ trendScope: "recent" }],
      mediaPenaltyStrengths: [0],
      maxCandidateConfigurations: 1,
      maxSelectionFolds: 8,
      baselineHistoryWeeks: 104,
    });
    const short = selectWindow(26);
    const long = selectWindow(104);
    const sharedOffsets = short.selected.foldSeries
      .map((fold) => fold.offset)
      .filter((offset) => long.selected.foldSeries.some((fold) => fold.offset === offset));
    expect(sharedOffsets.length).toBeGreaterThan(0);
    sharedOffsets.forEach((offset) => {
      const shortFold = short.selected.foldSeries.find((fold) => fold.offset === offset);
      const longFold = long.selected.foldSeries.find((fold) => fold.offset === offset);
      expect(shortFold.actual).toEqual(longFold.actual);
      expect(shortFold.baselines).toEqual(longFold.baselines);
      expect(shortFold.persistence).toEqual(longFold.persistence);
    });
  });

  it("searches standardized media penalties within the same declared fold contract", () => {
    expect(MMM_FORECAST_MEDIA_PENALTY_STRENGTHS).toEqual([0, 0.01, 0.05, 0.2]);
    expect(mmmForecastScaledMediaPenalty(0.05, 52)).toBeCloseTo(2.6, 12);
    expect(mmmForecastScaledMediaPenalty(0.05, 104)).toBeCloseTo(5.2, 12);
    const n = 120;
    const week = Array.from({ length: n }, (_, index) => index + 1);
    const cost = week.map((value) => 700 + (value % 11) * 75);
    const selection = mmmForecastRollingSelection({
      week,
      ch: { cost },
      channels: [{ key: "cost", label: "Cost", kind: "perf" }],
      targets: { Regs: week.map((value, index) => 3200 + value * 2 + cost[index] * 0.6) },
      dummy: {},
      steps: {},
    }, {
      ...MMM_METH_CONFIG,
      adstockGrid: [0],
      bayesHalfSaturationQuantiles: [0.6],
      bayesHillSlopeGrid: [1],
    }, "Regs", {
      horizon: 4,
      candidateWindows: [52],
      specIds: ["cost-trend"],
      trendOptions: [{ trendScope: "recent" }],
      mediaPenaltyStrengths: [0, 0.05],
      maxCandidateConfigurations: 2,
      maxSelectionFolds: 8,
    });
    expect(selection.candidateConfigurationCounts.plannedByPenalty).toEqual({ "0": 1, "0.05": 1 });
    expect(selection.candidates.map((candidate) => candidate.mediaPenaltyStrength).sort()).toEqual([0, 0.05]);
    selection.candidates.forEach((candidate) => {
      expect(candidate.mediaPenalty).toBeCloseTo(
        mmmForecastScaledMediaPenalty(candidate.mediaPenaltyStrength, candidate.window),
        12,
      );
      expect(candidate.candidateId).toContain(`ridge-${candidate.mediaPenaltyStrength}`);
    });
    expect(selection.fitContract.mediaPenaltyScale).toBe("standardized-per-row");
    expect(selection.fitContract.foldLocalAbsorption).toBe(true);
    expect(selection.selected.mediaPenalty).toBeCloseTo(
      mmmForecastScaledMediaPenalty(selection.selected.mediaPenaltyStrength, selection.selected.window),
      12,
    );
  });

  it("selects regression-naive blends on prior folds and never on the sealed fold", () => {
    const makeFold = (offset, actual, regression, baseline) => ({
      offset,
      actual: [actual],
      predicted: [regression],
      conditionalPredicted: [regression],
      persistence: [baseline],
      baselines: {
        "recent-mean-8": [baseline],
        "damped-local-trend-13": [baseline + 2],
      },
    });
    const candidate = {
      candidateId: "generic-regression",
      window: 52,
      spec: "cost-trend",
      controlPolicy: "mapped",
      trendScope: "recent",
      trendWindow: null,
      foldSeries: [
        makeFold(60, 100, 130, 70),
        makeFold(48, 100, 130, 70),
        makeFold(36, 100, 130, 70),
        makeFold(24, 100, 130, 70),
        makeFold(12, 100, 130, 70),
        makeFold(0, 100, 110, 90),
      ],
    };
    const nested = mmmForecastNestedSelection([candidate], {
      horizon: 12,
      minPriorFolds: 3,
      blendWeights: [0, 0.25, 0.5, 0.75, 1],
    });
    expect(nested.latest.regressionWeight).toBe(0.5);
    expect(nested.latest.blendBaselineId).toBe("recent-mean-8");
    expect(nested.latest.priorWmape).toBeCloseTo(0, 12);
    expect(nested.latest.wmape).toBeCloseTo(0, 12);
    expect(nested.latest.beatsBestBaseline).toBe(true);
    expect(mmmForecastBlendPredictions([110], [90], 0.5)).toEqual([100]);
    const applied = mmmForecastApplySelectedBlend({
      predFut: [110],
      lo: [100],
      hi: [120],
      baselineFut: [80],
      mediaContributionFut: [30],
      futWeek: [21],
    }, {
      week: Array.from({ length: 20 }, (_, index) => index + 1),
      targets: { Regs: Array(20).fill(90) },
    }, "Regs", {
      selectedBlend: { baselineId: "recent-mean-8", regressionWeight: 0.5 },
    });
    expect(applied.predFut).toEqual([100]);
    expect(applied.lo).toEqual([90]);
    expect(applied.hi).toEqual([110]);
    expect(applied.baselineFut).toEqual([85]);
    expect(applied.mediaContributionFut).toEqual([15]);
    expect(applied.blendApplied).toBe(true);

    const changedSealed = {
      ...candidate,
      foldSeries: candidate.foldSeries.map((fold) =>
        fold.offset === 0 ? makeFold(0, 1000, 5, 900) : fold,
      ),
    };
    const changed = mmmForecastNestedSelection([changedSealed], {
      horizon: 12,
      minPriorFolds: 3,
      blendWeights: [0, 0.25, 0.5, 0.75, 1],
    });
    expect(changed.latest.candidateId).toBe(nested.latest.candidateId);
    expect(changed.latest.regressionWeight).toBe(nested.latest.regressionWeight);
    expect(changed.latest.blendBaselineId).toBe(nested.latest.blendBaselineId);
    expect(changed.latest.priorWmape).toBeCloseTo(nested.latest.priorWmape, 12);
    expect(changed.latest.wmape).not.toBeCloseTo(nested.latest.wmape, 4);
  });

  it("offers annual seasonal-naive only after two observed cycles", () => {
    const makePanel = (n) => {
      const week = Array.from({ length: n }, (_, index) => index + 1);
      return {
        week,
        targets: { Regs: week.map((value) => 2000 + 300 * Math.sin((2 * Math.PI * value) / 52.18)) },
      };
    };
    const future = [105, 106, 107, 108];
    expect(mmmForecastNaiveBaselines(makePanel(103), "Regs", future)["seasonal-naive-52"]).toBeUndefined();
    const mature = mmmForecastNaiveBaselines(makePanel(104), "Regs", future);
    expect(mature["seasonal-naive-52"]).toHaveLength(4);
    expect(mature["seasonal-naive-52"].every(Number.isFinite)).toBe(true);
  });

  it("compares several cheap generic level and damped-trend references", () => {
    const week = Array.from({ length: 60 }, (_, index) => index + 1);
    const baselines = mmmForecastNaiveBaselines({
      week,
      targets: { Regs: week.map((value) => 1000 + value * 8) },
    }, "Regs", [61, 62, 63]);
    expect(Object.keys(baselines)).toEqual(expect.arrayContaining([
      "last-value",
      "recent-mean-4",
      "recent-mean-8",
      "recent-mean-13",
      "recent-mean-26",
      "damped-local-trend-8",
      "damped-local-trend-13",
      "damped-local-trend-26",
      "damped-local-trend-13-phi-0.5",
      "damped-local-trend-13-phi-0.95",
    ]));
    expect(Object.values(baselines).every((values) =>
      values.length === 3 && values.every(Number.isFinite),
    )).toBe(true);
  });

  it("rebuilds the exact custom naive baseline selected by nested OOS", () => {
    const applied = mmmForecastApplySelectedBlend({
      predFut: [90, 95],
      lo: [80, 85],
      hi: [100, 105],
      baselineFut: [70, 70],
      mediaContributionFut: [20, 25],
      futWeek: [7, 8],
    }, {
      week: [1, 2, 3, 4, 5, 6],
      targets: { Regs: [10, 20, 30, 40, 50, 60] },
    }, "Regs", {
      selectedBlend: { baselineId: "recent-mean-3", regressionWeight: 0 },
      naiveBaselineOptions: { recentMeanWeeks: 3 },
      blendMargins: [],
    });
    expect(applied.blendApplied).toBe(true);
    expect(applied.blendWarning).toBeUndefined();
    expect(applied.predFut).toEqual([50, 50]);
  });

  it("calibrates nested horizon margins only after eight outer OOS folds", () => {
    const makeCandidate = (offsets) => ({
      candidateId: "stable",
      window: 26,
      spec: "cost-trend",
      controlPolicy: "none",
      trendScope: "none",
      trendWindow: null,
      foldSeries: offsets.map((offset) => ({
        offset,
        actual: [100, 100],
        predicted: [98, 102],
        conditionalPredicted: [98, 102],
        baselines: { "last-value": [80, 80] },
      })),
    });
    const tooFew = mmmForecastNestedSelection(
      [makeCandidate([60, 48, 36, 24, 12, 0])],
      { horizon: 12, minPriorFolds: 3, blendWeights: [1] },
    );
    expect(tooFew.developmentFolds).toHaveLength(2);
    expect(tooFew.intervalCalibrationEligible).toBe(false);
    expect(tooFew.intervalCalibrationFoldCount).toBe(0);
    expect(tooFew.developmentMargins).toEqual([]);

    const enough = mmmForecastNestedSelection(
      [makeCandidate([132, 120, 108, 96, 84, 72, 60, 48, 36, 24, 12, 0])],
      { horizon: 12, minPriorFolds: 3, blendWeights: [1] },
    );
    expect(enough.developmentFolds).toHaveLength(8);
    expect(enough.intervalCalibrationEligible).toBe(true);
    expect(enough.intervalCalibrationFoldCount).toBe(8);
    expect(enough.developmentMargins).toEqual([2, 2]);
  });

  it("keeps more history when a short window is only practically tied, but accepts a material short-window win", () => {
    const offsets = [48, 36, 24, 12, 0];
    const makeCandidate = (candidateId, window, error) => ({
      candidateId,
      window,
      windowMode: "fixed",
      spec: "cost-trend",
      controlPolicy: "none",
      trendScope: "none",
      trendWindow: null,
      foldSeries: offsets.map((offset) => ({
        offset,
        actual: [100],
        predicted: [100 - error],
        conditionalPredicted: [100 - error],
        baselines: { "last-value": [80] },
      })),
    });
    const nearTie = mmmForecastNestedSelection([
      makeCandidate("short", 26, 1),
      makeCandidate("long", 104, 1.05),
    ], { horizon: 12, minPriorFolds: 3, blendWeights: [1] });
    expect(nearTie.latest.candidateId).toBe("long");
    expect(nearTie.latest.dataPreservation).toEqual(expect.objectContaining({
      applied: true,
      rawBestCandidateId: "short",
      selectedCandidateId: "long",
    }));

    const materialWin = mmmForecastNestedSelection([
      makeCandidate("short", 26, 0.5),
      makeCandidate("long", 104, 1.2),
    ], { horizon: 12, minPriorFolds: 3, blendWeights: [1] });
    expect(materialWin.latest.candidateId).toBe("short");
    expect(materialWin.latest.dataPreservation.applied).toBe(false);

    const crossFamilyTie = mmmForecastNestedSelection([
      makeCandidate("short-quarter", 26, 1),
      {
        ...makeCandidate("long-year", 104, 1.05),
        spec: "cost-trend-year-quarter",
        trendScope: "global",
        trendWindow: 36,
      },
    ], { horizon: 12, minPriorFolds: 3, blendWeights: [1] });
    expect(crossFamilyTie.latest.candidateId).toBe("long-year");

    const fallbackShort = {
      ...makeCandidate("fallback-short", 26, 10),
      structuralFallback: true,
    };
    const fallbackLong = {
      ...makeCandidate("fallback-long", 104, 100),
      structuralFallback: true,
    };
    const fallback = mmmForecastNestedSelection(
      [fallbackShort, fallbackLong],
      { horizon: 12, minPriorFolds: 3, blendWeights: [1] },
    );
    expect(fallback.latest.candidateId).toBe("fallback-short");
  });

  it("keeps hyperparameter selection unchanged when only the sealed latest outcomes change", () => {
    const n = 150;
    const week = Array.from({ length: n }, (_, index) => index + 1);
    const cost = week.map((value) => 900 + (value % 13) * 55);
    const baseTarget = week.map((value, index) => 4000 + value * 2 + cost[index] * 0.55);
    const makeSelection = (target, absorbed = new Set()) => mmmForecastRollingSelection({
      week,
      ch: { cost },
      channels: [{ key: "cost", label: "Cost", kind: "perf" }],
      targets: { Regs: target },
      dummy: {},
      steps: {},
    }, {
      ...MMM_METH_CONFIG,
      absorbed,
      adstockGrid: [0],
      bayesHalfSaturationQuantiles: [0.6],
      bayesHillSlopeGrid: [1],
    }, "Regs", {
      candidateWindows: [52, 78],
      specIds: ["cost-trend"],
      trendOptions: [{ trendScope: "recent" }],
      mediaPenaltyStrengths: [0, 0.05],
      maxCandidateConfigurations: 4,
      maxSelectionFolds: 8,
    });
    const first = makeSelection(baseTarget);
    const changed = makeSelection(baseTarget.map((value, index) =>
      index >= n - 12 ? value * (index % 2 ? 0.2 : 2.5) : value,
    ));
    expect(first.selected.candidateId).toBe(changed.selected.candidateId);
    expect(first.selected.mediaPenaltyStrength).toBe(changed.selected.mediaPenaltyStrength);
    expect(first.selected.selectedBlend).toEqual(changed.selected.selectedBlend);
    expect(first.selected.wmape).toBeCloseTo(changed.selected.wmape, 10);
    expect(first.productionSelected.candidateId).toBe(changed.productionSelected.candidateId);
    expect(first.productionSelected.mediaPenaltyStrength).toBe(changed.productionSelected.mediaPenaltyStrength);
    expect(first.productionSelected.selectedBlend).toEqual(changed.productionSelected.selectedBlend);
    expect(first.productionSelected.wmape).toBeCloseTo(changed.productionSelected.wmape, 10);
    expect(first.selected.latestWmape).not.toBeCloseTo(changed.selected.latestWmape, 2);
    const futureDerivedAbsorption = makeSelection(baseTarget, new Set(["cost"]));
    expect(futureDerivedAbsorption.selected.candidateId).toBe(first.selected.candidateId);
    expect(futureDerivedAbsorption.selected.wmape).toBeCloseTo(first.selected.wmape, 10);
  });

  it("uses the exact integer horizon and refuses overlapping rolling origins", () => {
    const n = 134;
    const week = Array.from({ length: n }, (_, index) => index + 1);
    const cost = week.map((value) => 600 + (value % 9) * 75);
    const selection = mmmForecastRollingSelection({
      week,
      ch: { cost },
      channels: [{ key: "cost", label: "Cost", kind: "perf" }],
      targets: { Regs: week.map((value, index) => 2500 + value * 2 + cost[index] * 0.7) },
      dummy: {},
      steps: {},
    }, {
      ...MMM_METH_CONFIG,
      adstockGrid: [0],
      bayesHalfSaturationQuantiles: [0.6],
      bayesHillSlopeGrid: [1],
    }, "Regs", {
      horizon: 12.7,
      foldStep: 1,
      relativeOriginStride: 1,
      candidateWindows: [26],
      specIds: ["cost-trend"],
      trendOptions: [{ trendScope: "none" }],
      transformPolicies: [{ id: "identity", families: ["identity"] }],
      mediaPenaltyStrengths: [0],
      trendDampingStrengths: [0],
      includeExpandingWindow: false,
      maxCandidateConfigurations: 1,
      maxSelectionFolds: 8,
    });
    expect(selection.horizon).toBe(13);
    expect(selection.foldStep).toBe(13);
    expect(selection.relativeOriginStride).toBe(13);
    selection.relativeOriginOffsets.slice(1).forEach((offset, index) => {
      expect(selection.relativeOriginOffsets[index] - offset).toBeGreaterThanOrEqual(13);
    });
    expect(selection.selected.foldSeries.every((fold) =>
      fold.actual.length === 13 && fold.predicted.length === 13,
    )).toBe(true);
  });

  it("normalizes the final Bayesian forecast to the same integer horizon contract", () => {
    const week = Array.from({ length: 52 }, (_, index) => index + 1);
    const cost = week.map((value) => 500 + (value % 7) * 80);
    const panel = {
      week,
      ch: { cost },
      channels: [{ key: "cost", label: "Cost", kind: "perf" }],
      targets: { Regs: cost.map((value, index) => 1500 + value * 0.6 + index * 2) },
      dummy: {},
      steps: {},
    };
    const cfg = {
      ...MMM_METH_CONFIG,
      absorbed: new Set(),
      adstockGrid: [0],
      mediaTransformFamilies: ["identity"],
      bayesHalfSaturationQuantiles: [0.5],
      bayesHillSlopeGrid: [1],
      seasonalityPeriods: [],
      seasonalityBasis: null,
      includeTrend: true,
    };
    const contract = mmmForecastDeclaredFitContract(cfg, { skipTransformUncertainty: true });
    const run = mmmBayesianRun(panel, contract.cfg, "Regs", false, contract.options);
    const rounded = mmmBayesianForecast(run, panel, null, 12.2);
    expect(rounded.horizon).toBe(12);
    expect(rounded.predFut).toHaveLength(12);
    expect(rounded.futWeek).toHaveLength(12);
    expect(rounded.futLabels).toHaveLength(12);
    const minimum = mmmBayesianForecast(run, panel, null, 0);
    expect(minimum.horizon).toBe(1);
    expect(minimum.predFut).toHaveLength(1);
  });

  it("lets a fixed log-response family beat linear and Hill alternatives on log-generated data", () => {
    const n = 160;
    const week = Array.from({ length: n }, (_, index) => index + 1);
    const levels = [0, 3, 15, 80, 400, 2000, 10000];
    const cost = week.map((_, index) => levels[(index * 5 + index % 3) % levels.length]);
    const selection = mmmForecastRollingSelection({
      week,
      ch: { cost },
      channels: [{ key: "cost", label: "Cost", kind: "perf" }],
      targets: { Regs: cost.map((value, index) => 1500 + 500 * Math.log1p(value) + (index % 2) * 0.01) },
      dummy: {},
      steps: {},
    }, {
      ...MMM_METH_CONFIG,
      adstockGrid: [0],
      bayesHalfSaturationQuantiles: [0.5],
      bayesHillSlopeGrid: [1],
    }, "Regs", {
      horizon: 4,
      candidateWindows: [52],
      specIds: ["cost-trend"],
      trendOptions: [{ trendScope: "none" }],
      transformPolicies: [
        { id: "identity", families: ["identity"] },
        { id: "log1p", families: ["log1p"] },
        { id: "hill", families: ["hill"] },
      ],
      mediaPenaltyStrengths: [0],
      trendDampingStrengths: [0],
      includeExpandingWindow: false,
      maxCandidateConfigurations: 3,
      maxSelectionFolds: 8,
    });
    const byPolicy = Object.fromEntries(selection.candidates.map((candidate) => [
      candidate.transformPolicy,
      candidate,
    ]));
    expect(Object.keys(byPolicy).sort()).toEqual(["hill", "identity", "log1p"]);
    expect(byPolicy.log1p.wmape).toBeLessThan(byPolicy.identity.wmape);
    expect(byPolicy.log1p.wmape).toBeLessThan(byPolicy.hill.wmape);
    expect(selection.productionSelected.transformPolicy).toBe("log1p");
    expect(selection.productionSelected.mediaTransformFamilies).toEqual(["log1p"]);
  });

  it("does not use held-out future dummy values to choose the deployed estimator", () => {
    const n = 120;
    const horizon = 4;
    const week = Array.from({ length: n }, (_, index) => index + 1);
    const cost = week.map((value) => 500 + (value % 10) * 60);
    const target = week.map((value, index) => 1800 + value * 2 + cost[index] * 0.65);
    const select = (promo) => mmmForecastRollingSelection({
      week,
      ch: { cost },
      channels: [{ key: "cost", label: "Cost", kind: "perf" }],
      targets: { Regs: target },
      dummy: { promo },
      steps: {},
    }, {
      ...MMM_METH_CONFIG,
      adstockGrid: [0],
      bayesHalfSaturationQuantiles: [0.5],
      bayesHillSlopeGrid: [1],
    }, "Regs", {
      horizon,
      candidateWindows: [26],
      specIds: ["cost-trend"],
      trendOptions: [{ trendScope: "none" }],
      transformPolicies: [{ id: "identity", families: ["identity"] }],
      mediaPenaltyStrengths: [0],
      trendDampingStrengths: [0],
      includeExpandingWindow: false,
      maxCandidateConfigurations: 2,
      maxSelectionFolds: 8,
    });
    const base = select(Array(n).fill(0));
    const changedFuture = select(Array.from({ length: n }, (_, index) => Number(index >= n - horizon)));
    expect(changedFuture.productionSelected.candidateId).toBe(base.productionSelected.candidateId);
    expect(changedFuture.productionSelected.selectedBlend).toEqual(base.productionSelected.selectedBlend);
    expect(changedFuture.productionSelected.wmape).toBeCloseTo(base.productionSelected.wmape, 12);
    expect(changedFuture.nested.developmentFolds).toEqual(base.nested.developmentFolds);
  });

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
    expect(selection.selected.folds).toBe(selection.decisionMinFolds);
    expect(selection.foldStep).toBe(selection.horizon);
    // 긴 이력에서도 중첩된 origin을 다시 적합하지 않는다. 최신 기준의
    // 상대 origin만 사용해 앞에 과거 행을 붙여도 검증 날짜가 움직이지 않는다.
    expect(selection.availableHoldoutOrigins).toBeGreaterThan(selection.evaluatedHoldoutOrigins);
    expect(selection.evaluatedHoldoutOrigins).toBeLessThanOrEqual(8);
    expect(selection.evaluatedCandidateConfigurations).toBeLessThanOrEqual(40);
    expect(selection.decisionMinFolds).toBe(3);
    expect(selection.transformGrid.adstock).toEqual(MMM_METH_CONFIG.adstockGrid);
    expect(selection.transformGrid.halfSaturationQuantiles).toEqual(MMM_METH_CONFIG.bayesHalfSaturationQuantiles);
    expect(selection.transformGrid.hillSlopes).toEqual(MMM_METH_CONFIG.bayesHillSlopeGrid);
    expect(selection.transformGrid.perChannelUpperBound).toBe(
      MMM_METH_CONFIG.adstockGrid.length
        * (
          2
          + MMM_METH_CONFIG.bayesHalfSaturationQuantiles.length
            * MMM_METH_CONFIG.bayesHillSlopeGrid.length
        ),
    );
    expect(selection.transformGrid.families).toEqual(["identity", "log1p", "hill"]);
    expect(selection.fitContract.trendDampingSelection).toBe("rolling-oos-candidate-axis");
    expect(selection.fitContract.trendDampingStrengths).toEqual([0, 0.25, 0.5, 0.75]);
    expect(selection.fitContract.adaptiveSeasonality).toBe(false);
    expect(selection.nested.latest).not.toBe(null);
    expect(selection.nested.latest.priorFolds).toBe(selection.decisionMinFolds);
    expect(selection.selected.wmape).toBe(null);
    expect(selection.selected.selectionScoreWmape).toBeLessThanOrEqual(selection.selected.persistenceWmape);
    expect(selection.candidates.some((item) => item.spec === "cost-trend-year-quarter")).toBe(false);
    expect(selection.candidates.every((item) => item.window <= 51)).toBe(true);
  });

  it("keeps explicitly mapped structural steps in every forecast candidate", () => {
    const n = 75;
    const week = Array.from({ length: n }, (_, index) => index + 1);
    const cost = week.map((_, index) => 500 + (index % 9) * 40);
    const regime = week.map((_, index) => index >= 48 ? 1 : 0);
    const target = week.map((_, index) => 2000 + cost[index] * 1.2 + regime[index] * 500);
    const selection = mmmForecastRollingSelection({
      week,
      ch: { cost },
      channels: [{ key: "cost", label: "Cost", kind: "perf" }],
      targets: { Regs: target },
      dummy: {},
      steps: { regime },
      stepDefs: [{ key: "regime", label: "Regime" }],
    }, { ...MMM_METH_CONFIG, absorbed: new Set() }, "Regs");
    expect(selection.candidates.length).toBeGreaterThan(0);
    expect(selection.selected.controlPolicy).toBe("mapped");
    expect(selection.productionSelected.controlPolicy).toBe("mapped");
    expect(selection.candidateConfigurationCounts.plannedByControl).toEqual(expect.objectContaining({
      mapped: expect.any(Number),
      none: expect.any(Number),
    }));
  });

  it("restores global trend offsets before scoring the persistence baseline", () => {
    const n = 140;
    const week = Array.from({ length: n }, (_, index) => index + 1);
    const cost = week.map((_, index) => 500 + (index % 7) * 20);
    const target = week.map((_, index) => 1000 + index * 50);
    const selection = mmmForecastRollingSelection({
      week,
      ch: { cost },
      channels: [{ key: "cost", label: "Cost", kind: "perf" }],
      targets: { Regs: target },
      dummy: {},
      steps: {},
    }, { ...MMM_METH_CONFIG, absorbed: new Set() }, "Regs", {
      horizon: 4,
      candidateWindows: [26],
      annualMinWeeks: 999,
    });
    const globalTrend = selection.candidates.filter((candidate) => candidate.trendScope === "global");
    expect(globalTrend.length).toBeGreaterThan(0);
    expect(Math.min(...globalTrend.map((candidate) => candidate.latestPersistenceWmape))).toBeLessThan(10);
  });

  it("keeps short-history forecasts but withholds channel Cost scenarios until three holdouts", () => {
    const selection = {
      decisionEligible: false,
      decisionReasons: ["fewer-than-three-holdouts"],
    };
    expect(mmmForecastScenarioEligibility([{ selection, run: { identification: {} } }])).toEqual({
      eligible: false,
      reasons: ["fewer-than-three-holdouts"],
    });
    expect(mmmForecastScenarioEligibility([{
      selection: { decisionEligible: true, decisionReasons: [] },
      run: { identification: { highCollinearity: true, lowInformation: false } },
    }])).toEqual({ eligible: false, reasons: ["high-collinearity"] });
  });

  it("nests window selection before each cutoff and keeps the latest 12 weeks sealed", () => {
    const fold = (offset, actual, predicted) => ({
      offset,
      actual: [actual],
      predicted: [predicted],
      conditionalPredicted: [predicted],
      persistence: [80],
    });
    const candidates = [
      {
        candidateId: "stable",
        window: 52,
        spec: "cost-trend",
        controlPolicy: "mapped",
        trendScope: "recent",
        trendWindow: null,
        foldSeries: [48, 36, 24, 12, 0].map((offset) => fold(offset, 100, offset === 0 ? 120 : 95)),
      },
      {
        candidateId: "latest-only",
        window: 26,
        spec: "cost-trend-quarter",
        controlPolicy: "mapped",
        trendScope: "global",
        trendWindow: 24,
        foldSeries: [48, 36, 24, 12, 0].map((offset) => fold(offset, 100, offset === 0 ? 100 : 150)),
      },
    ];
    const nested = mmmForecastNestedSelection(candidates, { horizon: 12, minPriorFolds: 3, blendWeights: [1] });
    expect(nested.latest.candidateId).toBe("stable");
    expect(nested.latest.wmape).toBeCloseTo(20, 8);
    expect(nested.productionCandidateId).toBe("stable");

    // OS 합산과 Direct 경로 역시 봉인 최신 fold가 아니라 더 오래된 nested
    // 성적으로 경로를 고른다.
    const android = { ...nested, folds: nested.folds.map((item) => ({ ...item, actual: [60], predicted: [57] })) };
    const ios = { ...nested, folds: nested.folds.map((item) => ({ ...item, actual: [40], predicted: [38] })) };
    const os = mmmForecastCombineNestedParts([android, ios], { route: "android-ios-sum" });
    const direct = {
      route: "direct-total",
      folds: os.folds.map((item) => ({ ...item, predicted: item.offset === 0 ? [100] : [80], wmape: item.offset === 0 ? 0 : 20 })),
    };
    direct.latest = direct.folds.find((item) => item.offset === 0);
    const route = mmmForecastSelectNestedRoute([direct, os], { horizon: 12 });
    expect(route.auditRoute).toBe("android-ios-sum");
    expect(route.productionRoute).toBe("android-ios-sum");
    expect(route.latestWmape).toBeCloseTo(5, 8);
    expect(route.certified).toBe(true);

    const paidOrganic = mmmForecastCombineNestedParts(
      ["android-organic", "android-paid", "ios-organic", "ios-paid"].map((component) => ({
        ...nested,
        component,
        folds: nested.folds.map((item) => ({
          ...item,
          actual: [25],
          predicted: [24],
          baselinePredicted: [20],
        })),
      })),
      { route: "paid-organic-bottom-up" },
    );
    const paidOrganicRoute = mmmForecastSelectNestedRoute([direct, paidOrganic], { horizon: 12 });
    expect(paidOrganicRoute.auditRoute).toBe("paid-organic-bottom-up");
    expect(paidOrganicRoute.productionRoute).toBe("paid-organic-bottom-up");
    expect(paidOrganicRoute.osGuardrail).toHaveLength(4);
    expect(paidOrganicRoute.osGuardrailPassed).toBe(true);
    expect(paidOrganicRoute.certified).toBe(true);
  });

  it("withholds Total certification when either OS fails its own nested guardrail", () => {
    const makePart = (component, actual, predicted) => ({
      component,
      horizon: 12,
      folds: [36, 24, 12, 0].map((offset) => ({
        offset,
        actual: [actual],
        predicted: [predicted],
        baselinePredicted: [actual * 0.7],
        wmape: Math.abs(actual - predicted) / actual * 100,
      })),
    });
    const android = makePart("android", 90, 98);
    const ios = makePart("ios", 10, 20);
    const os = mmmForecastCombineNestedParts([android, ios], { route: "android-ios-sum" });
    const route = mmmForecastSelectNestedRoute([os], { horizon: 12 });
    expect(route.latestWmape).toBeCloseTo(18, 8);
    expect(route.osGuardrail).toEqual([
      expect.objectContaining({ component: "android", passed: true }),
      expect.objectContaining({ component: "ios", passed: false }),
    ]);
    expect(route.osGuardrailPassed).toBe(false);
    expect(route.certified).toBe(false);
  });

  it("scores OS-sum routes against the same Total actual as Direct Total", () => {
    const makePart = (component) => ({
      component,
      horizon: 12,
      folds: [36, 24, 12, 0].map((offset) => ({
        offset,
        actual: [100],
        predicted: [100],
        baselinePredicted: [90],
      })),
    });
    const direct = {
      route: "direct-total",
      horizon: 12,
      folds: [36, 24, 12, 0].map((offset) => ({
        offset,
        actual: [1000],
        predicted: [950],
        baselinePredicted: [800],
      })),
    };
    direct.latest = direct.folds.find((fold) => fold.offset === 0);
    const os = mmmForecastCombineNestedParts(
      [makePart("android"), makePart("ios")],
      { route: "android-ios-sum", actualRoute: direct },
    );
    expect(os.actualSource).toBe("direct-total");
    expect(os.latest.actual).toEqual([1000]);
    expect(os.latest.predicted).toEqual([200]);
    const route = mmmForecastSelectNestedRoute([direct, os], { horizon: 12 });
    expect(route.auditRoute).toBe("direct-total");
    expect(route.productionRoute).toBe("direct-total");
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
    expect(restored.baselineFut[0]).toBe(0);
    expect(restored.baselineFloorApplied).toBe(1);
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
    const widenedOnly = mmmForecastApplySelectedBlend({
      predFut: [100],
      lo: [80],
      hi: [120],
      baselineFut: [90],
      mediaContributionFut: [10],
      futWeek: [10],
    }, {
      week: Array.from({ length: 9 }, (_, index) => index + 1),
      targets: { Regs: Array(9).fill(100) },
    }, "Regs", {
      selectedBlend: { baselineId: "last-value", regressionWeight: 1 },
      blendMargins: [2],
    });
    expect(widenedOnly.lo).toEqual([80]);
    expect(widenedOnly.hi).toEqual([120]);
    expect(widenedOnly.intervalCalibration).toBe("rolling-oos-p90-absolute-error");
    const nonnegative = mmmForecastApplySelectedBlend({
      predFut: [-100],
      lo: [-120],
      hi: [-80],
      baselineFut: [0],
      mediaContributionFut: [-100],
      futWeek: [10],
    }, {
      week: Array.from({ length: 9 }, (_, index) => index + 1),
      targets: { Regs: Array(9).fill(100) },
    }, "Regs", {
      selectedBlend: { baselineId: "last-value", regressionWeight: 1 },
      blendMargins: [10],
    });
    expect(nonnegative.predFut).toEqual([0]);
    expect(nonnegative.lo).toEqual([0]);
    expect(nonnegative.hi).toEqual([10]);
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
    expect(Object.keys(run.channelContributions)).toEqual(["google_roi", "meta"]);
    expect(run.groupNames).toContain("Performance");
    expect(Number.isFinite(run.saturationByChannel.google_roi.responseAt(3000))).toBe(true);
    const decomp = mmmBayesianWeeklyDecomp(run);
    expect(decomp?.weeks).toHaveLength(n);
    expect(Number.isFinite(decomp?.rmse)).toBe(true);
    // 표준화는 추정 안정성 전용. 표시 기여 합은 원 단위 fitted와 일치해야 한다.
    expect(Math.max(...run.weeks.map((w) => Math.abs(
      w.baseline + Object.values(w.contrib).reduce((sum, value) => sum + value, 0) - w.fitted,
    )))).toBeLessThan(0.02);
    expect(Math.max(...run.weeks.map((w) => Math.abs(
      (w.contrib.Performance || 0) - Object.values(w.channelContrib).reduce((sum, value) => sum + value, 0),
    )))).toBeLessThan(1e-9);
    // 절편까지 합친 장기 추세는 감소해도 '음수 광고/기준선'이 아닌 자연수요 레벨이다.
    expect(run.weeks.every((w) => w.contrib.Trend > 0)).toBe(true);
  });

  it("keeps paid media nonnegative by default but supports an explicit signed Organic-halo fit", () => {
    const n = 72;
    const week = Array.from({ length: n }, (_, index) => index + 1);
    const spend = week.map((value) => 500 + (value % 11) * 100);
    const target = spend.map((value, index) => 6000 - value * 1.4 + index * 0.5);
    const panel = {
      week,
      ch: { paid_spend: spend },
      targets: { OrganicRegs: target },
      channels: [{ key: "paid_spend", label: "Paid spend", kind: "perf" }],
      dummy: {},
      steps: {},
      external: {},
    };
    const baseCfg = {
      ...MMM_METH_CONFIG,
      trendDirectionFirst: false,
      includeTrend: true,
      seasonalityPeriods: [],
      seasonalityBasis: null,
      baselineKnots: [],
      adstockGrid: [0],
      bayesHalfSaturationQuantiles: [0.5],
      bayesHillSlopeGrid: [1],
    };
    const options = {
      enableMediaPenaltySelection: false,
      enableSeasonalitySelection: false,
      enableBaselineSelection: false,
      enableJointStructureSelection: false,
      skipTransformUncertainty: true,
    };
    const nonnegative = mmmBayesianRun(panel, baseCfg, "OrganicRegs", false, options);
    const signed = mmmBayesianRun(panel, { ...baseCfg, allowSignedMedia: true }, "OrganicRegs", false, options);
    const mediaIndex = signed.names.indexOf("media_paid_spend");
    expect(nonnegative.mediaCoefficientConstraint).toBe("nonnegative");
    expect(nonnegative.absoluteBeta[mediaIndex]).toBeGreaterThanOrEqual(0);
    expect(signed.mediaCoefficientConstraint).toBe("signed");
    expect(signed.penaltyAudit.mediaCoefficientConstraint).toBe("signed");
    expect(signed.absoluteBeta[mediaIndex]).toBeLessThan(0);
    expect(signed.channelContributions.paid_spend.totalMean).toBeLessThan(0);
    const low = mmmBayesianForecast(signed, panel, { paid_spend: Array(4).fill(500) }, 4, { clampScenario: false });
    const high = mmmBayesianForecast(signed, panel, { paid_spend: Array(4).fill(1500) }, 4, { clampScenario: false });
    expect(low.predFut.every(Number.isFinite)).toBe(true);
    expect(high.predFut.every(Number.isFinite)).toBe(true);
    expect(high.predFut.reduce((sum, value) => sum + value, 0)).toBeLessThan(
      low.predFut.reduce((sum, value) => sum + value, 0),
    );
    expect(high.scenarioWarnings.some((warning) => warning.type === "negative-media-effect")).toBe(true);
  });

  it("runs deterministic HMC and returns posterior contribution intervals", () => {
    const n = 48;
    const week = Array.from({ length: n }, (_, i) => i + 1);
    const google = week.map((t) => 1200 + (t % 7) * 260);
    const meta = week.map((t) => 900 + ((t * 5) % 9) * 180);
    const target = week.map((t, i) => 5000 + 1.8 * google[i] + 0.9 * meta[i] + t * 20);
    const panel = {
      week,
      ch: { google, meta },
      targets: { Regs: target },
      channels: [
        { key: "google", label: "Google", kind: "perf" },
        { key: "meta", label: "Meta", kind: "brand" },
      ],
      dummy: {},
      steps: {},
      external: {},
    };
    const analytical = mmmBayesianRun(panel, { ...MMM_METH_CONFIG, steps: {} }, "Regs", false, {
      enableMediaPenaltySelection: false,
      enableSeasonalitySelection: false,
      enableBaselineSelection: false,
    });
    const first = mmmBayesianMcmcRun(analytical, { seed: 77, burn: 60, samples: 100, leapfrog: 4, stepSize: 0.02 });
    const second = mmmBayesianMcmcRun(analytical, { seed: 77, burn: 60, samples: 100, leapfrog: 4, stepSize: 0.02 });
    expect(first?.mcmc?.enabled).toBe(true);
    expect(first.mcmc.acceptanceRate).toBeGreaterThan(0);
    expect(first.mcmc.acceptanceRate).toBeLessThanOrEqual(1);
    expect(first.mcmc.seed).toBe(77);
    expect(first.weeks.map((weekRow) => weekRow.fitted)).toEqual(second.weeks.map((weekRow) => weekRow.fitted));
    expect(first.weeks.every((weekRow) => weekRow.lo <= weekRow.fitted && weekRow.fitted <= weekRow.hi)).toBe(true);
    const multi = mmmBayesianMcmcRun(analytical, { seed: 77, chains: 2, burn: 60, samples: 100, leapfrog: 4, stepSize: 0.02 });
    expect(multi?.mcmc?.multiChain).toBe(true);
    expect(multi.mcmc.chains).toBe(2);
    expect(multi.mcmc.rhat.length).toBeGreaterThan(0);
    expect(Number.isFinite(multi.mcmc.maxRhat)).toBe(true);
    expect(Number.isFinite(multi.mcmc.minEss)).toBe(true);
    const meridianAnalytical = mmmBayesianRun(panel, {
      ...MMM_METH_CONFIG,
      steps: {},
      meridianMode: true,
      meridianAdstockDecay: "binomial",
      meridianMaxLag: 4,
      meridianHillBeforeAdstock: false,
    }, "Regs", false, {
      enableMediaPenaltySelection: false,
      enableSeasonalitySelection: false,
      enableBaselineSelection: false,
    });
    expect(meridianAnalytical?.meridianSpec?.enabled).toBe(true);
    expect(meridianAnalytical?.meridianSpec?.adstockDecay).toBe("binomial");
    expect(mmmBayesianMcmcRun(meridianAnalytical, { seed: 77, burn: 60, samples: 100, leapfrog: 4, stepSize: 0.02 })?.mcmc?.enabled).toBe(true);
  });

  it("uses matched Reach/Frequency inputs for Meridian media channels", () => {
    const week = Array.from({ length: 52 }, (_, index) => index + 1);
    const spend = week.map((index) => 500 + (index % 8) * 90);
    const reach = week.map((index) => 2000 + (index % 6) * 140);
    const frequency = week.map((index) => 1.5 + (index % 5) * 0.2);
    const target = week.map((_, index) => 3000 + reach[index] * 0.35 + frequency[index] * 80 + index * 4);
    const run = mmmBayesianRun({
      week,
      ch: { meta: spend },
      reach: { metaReach: reach },
      frequency: { metaFrequency: frequency },
      mediaInputMap: { meta: { type: "reach-frequency", reachKey: "metaReach", frequencyKey: "metaFrequency" } },
      targets: { Regs: target },
      channels: [{ key: "meta", label: "Meta", kind: "perf" }],
      dummy: {}, steps: {}, external: {},
    }, {
      ...MMM_METH_CONFIG,
      meridianMode: true,
      seasonalityPeriods: [],
      adstockGrid: [0],
      bayesHalfSaturationQuantiles: [0.6],
      bayesHillSlopeGrid: [1],
    }, "Regs", false, {
      enableMediaPenaltySelection: false,
      enableSeasonalitySelection: false,
      enableBaselineSelection: false,
      skipTransformUncertainty: true,
    });
    expect(run?.meridianSpec?.rfChannels).toEqual(["meta"]);
    expect(run?.meridianSpec?.spendChannels).toEqual([]);
    expect(Number.isFinite(run?.channelContributions?.meta?.totalMean)).toBe(true);
    const identity = mmmBayesianRun({
      week,
      ch: { meta: spend },
      reach: { metaReach: reach },
      frequency: { metaFrequency: frequency },
      mediaInputMap: { meta: { type: "reach-frequency", reachKey: "metaReach", frequencyKey: "metaFrequency" } },
      targets: { Regs: target },
      channels: [{ key: "meta", label: "Meta", kind: "perf" }],
      dummy: {}, steps: {}, external: {},
    }, {
      ...MMM_METH_CONFIG,
      meridianMode: true,
      seasonalityPeriods: [],
      mediaTransformFamilies: ["identity", "log1p", "hill"],
      adstockGrid: [0],
      bayesHalfSaturationQuantiles: [0.6],
      bayesHillSlopeGrid: [1],
    }, "Regs", false, {
      enableMediaPenaltySelection: false,
      enableSeasonalitySelection: false,
      enableBaselineSelection: false,
      skipTransformUncertainty: true,
      channelParams: {
        meta: { family: "identity", alpha: 0, ec: null, slope: null },
      },
    });
    expect(identity?.params?.meta).toEqual(expect.objectContaining({
      family: "identity",
      fixedFromTarget: true,
    }));
    expect(identity?.weeks.every((row) => Number.isFinite(row.fitted))).toBe(true);
  });

  it("keeps Reach/Frequency aligned inside every rolling forecast fold", () => {
    const n = 100;
    const week = Array.from({ length: n }, (_, index) => index + 1);
    const spend = week.map((value) => 500 + (value % 7) * 80);
    const reach = week.map((value) => 1500 + (value % 11) * 90);
    const frequency = week.map((value) => 1.2 + (value % 5) * 0.2);
    const panel = {
      week,
      ch: { meta: spend },
      reach: { metaReach: reach },
      frequency: { metaFrequency: frequency },
      mediaInputMap: {
        meta: {
          type: "reach-frequency",
          reachKey: "metaReach",
          frequencyKey: "metaFrequency",
        },
      },
      targets: {
        Regs: week.map((value, index) =>
          1200 + reach[index] * frequency[index] * 0.35 + value),
      },
      channels: [{ key: "meta", label: "Meta", kind: "perf" }],
      dummy: {},
      steps: {},
      external: {},
    };
    const selection = mmmForecastRollingSelection(panel, {
      ...MMM_METH_CONFIG,
      seasonalityPeriods: [],
      adstockGrid: [0],
      bayesHalfSaturationQuantiles: [0.6],
      bayesHillSlopeGrid: [1],
    }, "Regs", {
      horizon: 6,
      candidateWindows: [52],
      specIds: ["cost-trend"],
      trendOptions: [{ trendScope: "none" }],
      transformPolicies: [{ id: "identity", families: ["identity"] }],
      mediaPenaltyStrengths: [0],
      trendDampingStrengths: [0],
      maxCandidateConfigurations: 1,
      maxSelectionFolds: 5,
    });
    expect(selection.enabled).toBe(true);
    expect(selection.selected?.transformPolicy).toBe("identity");
    expect(selection.nested?.latest?.actual).toHaveLength(6);
    expect(selection.nested?.latest?.predicted).toHaveLength(6);
    expect(selection.nested.latest.predicted.every(Number.isFinite)).toBe(true);
    expect(selection.selected).toMatchObject({
      spendFreeAblationAvailable: true,
      spendFreeWmape: expect.any(Number),
      spendFreeFoldWins: expect.any(Number),
    });
  });

  it("uses supplied future Reach/Frequency under the default non-Meridian forecast config", () => {
    const n = 64;
    const week = Array.from({ length: n }, (_, index) => index + 1);
    const spend = week.map((value) => 500 + (value % 7) * 25);
    const reach = week.map((value) => 1000 + (value % 9) * 80);
    const frequency = week.map((value) => 1.2 + (value % 4) * 0.25);
    const panel = {
      week,
      ch: { meta: spend },
      reach: { metaReach: reach },
      frequency: { metaFrequency: frequency },
      mediaInputMap: {
        meta: {
          type: "reach-frequency",
          reachKey: "metaReach",
          frequencyKey: "metaFrequency",
        },
      },
      targets: {
        Regs: week.map((value, index) =>
          500 + reach[index] * frequency[index] * 0.4 + value),
      },
      channels: [{ key: "meta", label: "Meta", kind: "perf" }],
      dummy: {},
      steps: {},
      external: {},
    };
    const run = mmmBayesianRun(panel, {
      ...MMM_METH_CONFIG,
      seasonalityPeriods: [],
      includeTrend: false,
      mediaTransformFamilies: ["identity"],
      adstockGrid: [0],
    }, "Regs", false, {
      enableMediaPenaltySelection: false,
      enableSeasonalitySelection: false,
      enableBaselineSelection: false,
      skipTransformUncertainty: true,
      channelParams: {
        meta: { family: "identity", alpha: 0, ec: null, slope: null },
      },
    });
    expect(run?.meridianSpec).toMatchObject({
      enabled: false,
      rfChannels: ["meta"],
    });
    const common = {
      futureFrequency: { meta: [2, 2] },
      clampScenario: false,
    };
    const low = mmmBayesianForecast(run, panel, { meta: [600, 600] }, 2, {
      ...common,
      futureReach: { meta: [800, 800] },
    });
    const high = mmmBayesianForecast(run, panel, { meta: [600, 600] }, 2, {
      ...common,
      futureReach: { meta: [2400, 2400] },
    });
    expect(low.predFut).toHaveLength(2);
    expect(high.predFut).toHaveLength(2);
    expect(high.predFut[0]).toBeGreaterThan(low.predFut[0]);
    expect(high.predFut[1]).toBeGreaterThan(low.predFut[1]);
  });


  it("uses a broad business prior without locking transform uncertainty", () => {
    const n = 64;
    const week = Array.from({ length: n }, (_, index) => index + 1);
    const meta = week.map((value) => 500 + ((value * 13) % 11) * 90);
    const snap = week.map((value) => 300 + ((value * 17) % 13) * 75);
    const target = week.map((value, index) => 5000 + value * 3 + meta[index] * 0.4 + snap[index] * 0.2);
    const run = mmmBayesianRun({
      week,
      ch: { meta, snap },
      targets: { Regs: target },
      channels: [{ key: "meta", label: "Meta", kind: "perf" }, { key: "snap", label: "Snap", kind: "perf" }],
      dummy: {}, steps: {}, external: {},
    }, {
      ...MMM_METH_CONFIG,
      seasonalityPeriods: [],
      seasonalityMinHistory: 104,
      mediaPenaltyCandidates: [1],
      adstockGrid: [0, 0.4],
      bayesHalfSaturationQuantiles: [0.4, 0.8],
      bayesHillSlopeGrid: [0.8, 1],
    }, "Regs", false, {
      enableBusinessContributionPrior: true,
      enableBaselineSelection: false,
      enableMediaPenaltySelection: false,
    });
    expect(run.businessContributionPrior).toMatchObject({
      enabled: true,
      meanShare: 0.3,
      shareSd: 0.25,
      channelCount: 2,
    });
    expect(run.channelContributions.meta.source).toBe("data-plus-business-prior");
    expect(run.saturationByChannel.meta.transformUncertainty?.priorLockedTransform).toBe(false);
    expect(run.jointTransform.enabled).toBe(true);
    expect(run.jointTransform.appliedToUncertainty).toBe(true);
    expect(run.jointTransform.channelMarginals.meta.models.length).toBeGreaterThan(1);
  });

  it("audits panel quality before model fitting", () => {
    const panel = {
      week: [1, 2, 3],
      weekLabel: ["2025-01-06", "2025-01-13", "2025-01-20"],
      ch: { meta: [10, 20, 30] },
      targets: { Regs: [100, 110, 120] },
      channels: [{ key: "meta", label: "Meta", kind: "perf" }],
      dummy: {}, steps: {}, external: {},
    };
    const audit = mmmDataQualityAudit(panel);
    expect(audit.valid).toBe(true);
    expect(audit.issues).toEqual([]);
    const invalid = mmmDataQualityAudit({ ...panel, week: [1, 1, 3] });
    expect(invalid.valid).toBe(false);
    expect(invalid.issues).toContain("non-increasing-week");
  });

  it("refits highly correlated channels as one input and keeps individual reference allocations visible", () => {
    const n = 60;
    const week = Array.from({ length: n }, (_, index) => index + 1);
    const snap = week.map((value) => 400 + ((value * 11) % 9) * 80);
    const tiktok = snap.map((value, index) => value * 0.98 + (index % 3) * 4);
    const search = week.map((value) => 250 + ((value * 7) % 13) * 55);
    const target = week.map((value, index) => 4000 + value * 2 + (snap[index] + tiktok[index]) * 0.35 + search[index] * 0.15);
    const panel = {
      week,
      ch: { snap, tiktok, search },
      targets: { Regs: target },
      channels: [
        { key: "snap", label: "Snap", kind: "perf" },
        { key: "tiktok", label: "TikTok", kind: "perf" },
        { key: "search", label: "Search", kind: "perf" },
      ],
      dummy: {}, steps: {}, external: {},
    };
    const cfg = {
      ...MMM_METH_CONFIG,
      seasonalityPeriods: [],
      seasonalityMinHistory: 104,
      mediaPenaltyCandidates: [1],
      adstockGrid: [0],
      bayesHalfSaturationQuantiles: [0.6],
      bayesHillSlopeGrid: [1],
    };
    const run = mmmBayesianRun(panel, cfg, "Regs", false, {
      enableBusinessContributionPrior: true,
      enableBaselineSelection: false,
      enableMediaPenaltySelection: false,
      skipTransformUncertainty: true,
    });
    const refit = mmmBayesianCorrelatedGroupRefit(panel, run, "Regs");
    expect(refit.enabled).toBe(true);
    expect(refit.groups[0].members).toEqual(["snap", "tiktok"]);
    expect(refit.groups[0].contribution.totalMean).toBeGreaterThan(0);
    expect(refit.individualContributions.snap.allocationReliability).toBe("reference-low");
    expect(
      refit.individualContributions.snap.totalMean + refit.individualContributions.tiktok.totalMean,
    ).toBeCloseTo(refit.groups[0].contribution.totalMean, 6);
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
    const marketReference = Math.exp(market.reduce((sum, value) => sum + Math.log(value), 0) / market.length);
    const target = week.map((_, index) => 4200 + spend[index] * 0.5 + Math.log(market[index] / marketReference) * 1800);
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
    expect(Math.abs(run.weeks.reduce((sum, item) => sum + item.contrib["Industry Trend"], 0) / n)).toBeLessThan(1e-6);
    const forecast = mmmBayesianForecast(run, panel, { meta: [1000] }, 1, { futureExternal: { dating_market: [1600] } });
    const held = mmmBayesianForecast(run, panel, { meta: [1000] }, 1, { futureExternal: { dating_market: [market.at(-1)] } });
    expect(forecast.predFut[0]).not.toBeCloseTo(held.predFut[0], 6);
  });

  it("uses industry inputs as scale-invariant relative market demand, not raw installs", () => {
    const base = [100, 110, 90, 130, 120];
    const scaled = base.map((value) => value * 1000);
    const first = mmmExternalRelativeIndex(base);
    const second = mmmExternalRelativeIndex(scaled);
    expect(first.mode).toBe("log-relative");
    expect(first.values.reduce((sum, value) => sum + value, 0) / first.values.length).toBeCloseTo(0, 12);
    first.values.forEach((value, index) => expect(value).toBeCloseTo(second.values[index], 12));
  });

  it("chooses media regularization from chronological holdouts instead of a fixed shrinkage", () => {
    const n = 88;
    const week = Array.from({ length: n }, (_, index) => index + 1);
    const spend = week.map((value) => 300 + ((value * 37) % 17) * 180);
    const target = spend.map((value, index) => 2500 + value * 1.4 + (index % 4) * 12);
    const cfg = {
      ...MMM_METH_CONFIG,
      steps: {},
      trendDirectionFirst: false,
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

  it("detects annual recurrence from full history instead of recent 12-week holdouts", () => {
    const n = 104;
    const week = Array.from({ length: n }, (_, index) => index + 1);
    const target = week.map((value) => 4000
      + 360 * Math.sin((2 * Math.PI * value) / 52.18)
      + 180 * Math.cos((4 * Math.PI * value) / 52.18));
    const cfg = {
      ...MMM_METH_CONFIG,
      steps: {},
      trendDirectionFirst: false,
      includeTrend: false,
      adstockGrid: [0],
      seasonalityMinHistory: 104,
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
    expect(selection.evidence.detected).toBe(true);
    expect(selection.evidence.observedWeeks).toBe(104);
    expect(selection.evidence.lagWeeks).toBe(52);
    expect(selection.evidence.bicImprovement).toBeGreaterThan(6);
    expect(selection.selected.id).toBe("annual-2");
    expect(selection.candidates.every((candidate) => Number.isFinite(candidate.bic))).toBe(true);
    expect(selection.candidates.every((candidate) => candidate.foldWmapes == null)).toBe(true);
    const run = mmmBayesianRun(panel, cfg, "Regs", false, { skipTransformUncertainty: true });
    expect(run.seasonalitySelection.selected.id).toBe("annual-2");
    expect(run.seasonalityPeriods).toEqual([52.18, 26.09]);
    const decomp = mmmBayesianWeeklyDecomp(run);
    const seasonality = decomp.driverStats.find((driver) => driver.name === "Seasonality");
    expect(seasonality.swing).toBeGreaterThan(100);
    expect(seasonality.min).toBeLessThan(0);
    expect(seasonality.max).toBeGreaterThan(0);
    // 중심화된 계절성은 연간 부호 평균이 0에 가까워도 주별 기여가 사라진 것이 아니다.
    expect(Math.abs(seasonality.avg)).toBeLessThan(seasonality.swing * 0.1);
  });

  it("does not let a baseline knot erase a detected annual recurrence", () => {
    const n = 104;
    const week = Array.from({ length: n }, (_, index) => index + 1);
    const target = week.map((value) => 5000
      + value * 8
      + (value > 58 ? (value - 58) * 4 : 0)
      + 720 * Math.sin((2 * Math.PI * value) / 52.18));
    const cfg = {
      ...MMM_METH_CONFIG,
      steps: {},
      includeTrend: true,
      baselineMinHistory: 78,
      seasonalityMinHistory: 104,
      // 이 검증은 강제 포함 정책이 아닌, 자동 감지기의 재현성만 확인한다.
      requireSeasonality: false,
      trendDirectionFirst: false,
      adstockGrid: [0],
    };
    const panel = { week, ch: {}, targets: { Regs: target }, channels: [], dummy: {}, steps: {} };
    const run = mmmBayesianRun(panel, cfg, "Regs", false, { skipTransformUncertainty: true });
    expect(run.seasonalitySelection.evidence.detected).toBe(true);
    expect(run.seasonalityPeriods.length).toBeGreaterThan(0);
    expect(run.seasonalitySelection.reason).toMatch(/^full-history-recurrence/);
  });

  it("detects a business-shaped annual pattern from 96+ weeks using grouped media controls", () => {
    const n = 100;
    const week = Array.from({ length: n }, (_, index) => index + 1);
    const perf = week.map((value) => 600 + ((value * 17) % 9) * 160);
    const brand = week.map((value) => 420 + ((value * 29) % 7) * 130);
    const target = week.map((value, index) => 4000
      + 520 * Math.sin((2 * Math.PI * value) / 52.18)
      + 300 * Math.cos((4 * Math.PI * value) / 52.18)
      + 180 * Math.sin((6 * Math.PI * value) / 52.18)
      + perf[index] * 0.8 + brand[index] * 0.4);
    const cfg = {
      ...MMM_METH_CONFIG,
      steps: {},
      seasonalityMinHistory: 96,
      // 이 검증은 강제 포함 정책이 아닌, 자동 감지기의 계절성 포착만 확인한다.
      requireSeasonality: false,
      adstockGrid: [0],
      bayesHalfSaturationQuantiles: [0.6],
      bayesHillSlopeGrid: [1],
      mediaPenaltyCandidates: [0.5],
    };
    const panel = {
      week,
      ch: { perf, brand },
      targets: { Regs: target },
      channels: [{ key: "perf", label: "Performance", kind: "perf" }, { key: "brand", label: "Brand", kind: "brand" }],
      dummy: {}, steps: {},
      external: { market: week.map((value) => 1000 + ((value * 23) % 17) * 21) },
      externalDefs: [{ key: "market", label: "Market" }],
    };
    const selection = mmmBayesianSeasonalitySelection(panel, cfg, "Regs", { skipTransformUncertainty: true });
    expect(selection.enabled).toBe(true);
    expect(selection.evidence.minHistory).toBe(96);
    expect(selection.evidence.detected).toBe(true);
    expect(selection.evidence.seasonalLagCorrelation).toBeGreaterThan(0.75);
    expect(selection.selected.id).toBe("annual-3");
    expect(selection.evidence.controlConsensus).toBe(true);
    expect(selection.candidates.every((candidate) => Number.isFinite(candidate.finalBic))).toBe(true);
    expect(selection.evidence.finalBicImprovement).toBeGreaterThan(0);
  });

  it("restores business seasonality when three forward folds materially beat no seasonality", () => {
    const none = { id: "none", periods: [] };
    const annual = { id: "annual-4", periods: [52.18, 26.09, 17.39, 13.04] };
    const evidence = new Map([
      ["none", { meanWmape: 2.507, folds: 3 }],
      ["annual-4", { meanWmape: 2.294, folds: 3 }],
    ]);
    const decision = mmmSeasonalityRollingRescueDecision(
      none,
      [annual],
      evidence,
      { minimumAbsolute: 0.1, minimumRelative: 0.05, minimumFolds: 3 },
      { shapeStable: true, controlStable: true },
    );
    expect(decision).toMatchObject({
      accepted: true,
      selectedId: "annual-4",
      folds: 3,
      reason: "rolling-outperformance-restores-seasonality",
    });
    expect(decision.relativeImprovement).toBeCloseTo((2.507 - 2.294) / 2.507);
  });

  it("does not manufacture business seasonality from trend and irregular noise", () => {
    const n = 100;
    const week = Array.from({ length: n }, (_, index) => index + 1);
    const perf = week.map((value) => 500 + ((value * 19) % 11) * 170);
    const brand = week.map((value) => 350 + ((value * 31) % 13) * 115);
    const target = week.map((value, index) => 4000 + value * 7 + perf[index] * 0.7 + brand[index] * 0.35 + (((value * 47) % 19) - 9) * 42);
    const cfg = {
      ...MMM_METH_CONFIG,
      steps: {},
      seasonalityMinHistory: 96,
      // 이 검증은 강제 포함 정책이 아닌, 자동 감지기의 거짓 양성 방지만 확인한다.
      requireSeasonality: false,
      adstockGrid: [0],
      bayesHalfSaturationQuantiles: [0.6],
      bayesHillSlopeGrid: [1],
      mediaPenaltyCandidates: [0.5],
    };
    const panel = {
      week,
      ch: { perf, brand },
      targets: { Regs: target },
      channels: [{ key: "perf", label: "Performance", kind: "perf" }, { key: "brand", label: "Brand", kind: "brand" }],
      dummy: {}, steps: {}, external: {},
    };
    const selection = mmmBayesianSeasonalitySelection(panel, cfg, "Regs", { skipTransformUncertainty: true });
    expect(selection.enabled).toBe(true);
    expect(selection.evidence.detected).toBe(false);
    expect(selection.selected.id).toBe("none");
  });

  it("keeps configured annual seasonality before two complete yearly cycles", () => {
    const n = 80;
    const week = Array.from({ length: n }, (_, index) => index + 1);
    const cfg = {
      ...MMM_METH_CONFIG,
      steps: {},
      seasonalityPeriods: [52.18],
      seasonalityMinHistory: 104,
    };
    const panel = {
      week,
      ch: {},
      targets: { Regs: week.map((value) => 4000 + 300 * Math.sin((2 * Math.PI * value) / 52.18)) },
      channels: [],
      dummy: {},
      steps: {},
    };
    const selection = mmmBayesianSeasonalitySelection(panel, cfg, "Regs", { skipTransformUncertainty: true });
    expect(selection.enabled).toBe(false);
    expect(selection.cfg.seasonalityPeriods).toEqual([52.18]);
    expect(selection.reason).toBe("insufficient-history-or-disabled");
  });

  it("retains the response demo's annual demand cycle when media spend is also seasonal", () => {
    const demo = buildDemoCsv("response");
    const keys = ["google_spend", "meta_spend", "tiktok_spend", "brand_spend"];
    const panel = {
      week: demo.raw.map((_, index) => index + 1),
      ch: Object.fromEntries(keys.map((key) => [key, demo.raw.map((row) => Number(row[key]))])),
      targets: { Regs: demo.raw.map((row) => Number(row.signups)) },
      channels: keys.map((key) => ({ key, label: key, kind: "perf" })),
      dummy: {},
      steps: {},
      external: {},
    };
    const selection = mmmBayesianSeasonalitySelection(panel, {
      ...MMM_METH_CONFIG,
      steps: {},
      baselineKnots: [],
      seasonalityMinHistory: 104,
    }, "Regs", { skipTransformUncertainty: true });
    expect(selection.enabled).toBe(true);
    expect(selection.evidence.detected).toBe(true);
    expect(selection.selected.id).not.toBe("none");
    expect(selection.cfg.seasonalityPeriods.length).toBeGreaterThan(0);
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
      trendDirectionFirst: false,
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
      ["ok", "cannibal", "inconclusive", "not_identified"].includes(cn.verdict_class) && vsum === 3,
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

    // T6c 유의 음순효과 하나만으로는 red 승격하지 않음(복수 증거 합의 필요)
    const cnNeg = mmmCannibalization(
      oscPanel,
      cfg,
      "Regs",
      { coef: -0.3, ci_lo: -0.5, ci_hi: -0.1, p: 0.001 },
      "x",
    );
    expect(
      cnNeg.net_incrementality.vote === "AGAINST" &&
        cnNeg.verdict_class !== "cannibal",
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

  it("generates trend bends from each panel instead of fixed calendar dates", () => {
    const week = Array.from({ length: 160 }, (_, index) => index + 1);
    const target = week.map((value) =>
      5000 - value * 2 - Math.max(0, value - 86) * 18 + Math.sin(value * 0.7) * 15,
    );
    const panel = { week, targets: { Regs: target } };
    const knots = mmmAutomaticTrendKnots(panel, "Regs", 1);
    expect(knots).toHaveLength(1);
    expect(knots[0]).toBeGreaterThanOrEqual(78);
    expect(knots[0]).toBeLessThanOrEqual(94);
    expect(mmmAutomaticTrendKnots(panel, "Regs", 1)).toEqual(knots);
    expect(mmmAutomaticTrendKnots({
      week: week.slice(0, 70),
      targets: { Regs: target.slice(0, 70) },
    }, "Regs", 1)).toEqual([]);
  });

  it("chooses a complete joint model by forward tolerance, BIC and allocation stability", () => {
    const candidates = [
      { id: "forecast-only", meanWmape: 2, bic: 120, mediaShareRange: 0.03, complexity: 1 },
      { id: "joint-structural", meanWmape: 2.4, bic: 100, mediaShareRange: 0.02, complexity: 4 },
      { id: "joint-stable-tie", meanWmape: 2.5, bic: 101, mediaShareRange: 0.01, complexity: 4 },
      { id: "too-weak-oos", meanWmape: 4.5, bic: 80, mediaShareRange: 0.001, complexity: 8 },
    ];
    const decision = mmmJointStructureDecision(candidates, {
      rollingTolerance: 2,
      bicTieTolerance: 2,
    });
    expect(decision.selected.id).toBe("joint-stable-tie");
    expect(decision.eligible.map((item) => item.id)).not.toContain("too-weak-oos");
    expect(decision.bestRolling.id).toBe("forecast-only");
    expect(decision.bestBic.id).toBe("joint-structural");
  });

  it("keeps seasonality and industry controls mandatory in the product MMM configuration", () => {
    expect(MMM_METH_CONFIG.requireSeasonality).toBe(true);
    expect(MMM_METH_CONFIG.requireIndustryControls).toBe(true);
    expect(MMM_METH_CONFIG.trendDirectionFirst).toBe(true);
    expect(MMM_METH_CONFIG.jointStructureSeasonalityIds).not.toContain("none");
    expect(MMM_METH_CONFIG.jointStructureSeasonalityIds).toEqual(["business-smooth-8"]);
  });

  it("fixes only trend directions before jointly allocating trend, business seasonality, industry and media", () => {
    const n = 120;
    const week = Array.from({ length: n }, (_, index) => index + 1);
    const industry = week.map((value) => 1000 - value * 1.4 + Math.sin(value / 11) * 25);
    const media = week.map((value) => 500 + ((value * 17) % 13) * 70);
    const target = week.map((value, index) =>
      5000
      + Math.max(0, value - 68) * -9
      + 360 * Math.sin((2 * Math.PI * value) / 52.18)
      + 0.8 * (industry[index] - 900)
      + 0.45 * media[index],
    );
    const panel = {
      week,
      targets: { Regs: target },
      external: { market: industry },
      externalDefs: [{ key: "market", label: "Market demand" }],
      ch: { media },
      channels: [{ key: "media", label: "Media", kind: "perf" }],
      dummy: {},
      steps: {},
    };
    const run = mmmBayesianRun(panel, {
      ...MMM_METH_CONFIG,
      steps: {},
      adstockGrid: [0, 0.4],
      bayesHalfSaturationQuantiles: [0.6],
      bayesHillSlopeGrid: [1],
      bayesMaxProfileCandidates: 2,
      bayesMaxTotalProfileFits: 2,
      mediaPenaltyCandidates: [1],
    }, "Regs", false, {
      enableBaselineSelection: false,
      enableMediaPenaltySelection: false,
    });
    const plan = mmmTrendDirectionPlan(panel, "Regs");
    expect(plan.enabled).toBe(true);
    expect(run?.trendDirectionPlan).toMatchObject({
      enabled: true,
      method: "low-frequency-direction-only-then-joint-allocation",
    });
    expect(run.trendDirectionPlan.segments.map((segment) => segment.direction))
      .toEqual(plan.segments.map((segment) => segment.direction));
    expect(run.names.some((name) => name.startsWith("season_rbf_"))).toBe(true);
    expect(run.names.some((name) => name.startsWith("industry_"))).toBe(true);
    expect(run.names.some((name) => /^(sin|cos)_/.test(name))).toBe(false);
    const trendDirectionNames = run.names.filter((name) => name.startsWith("trend_dir_"));
    const nonFlatDirections = plan.segments
      .filter((segment) => segment.direction !== "flat")
      .map((segment) => segment.direction);
    expect(trendDirectionNames.length).toBe(nonFlatDirections.length);
    expect(trendDirectionNames.every((name) =>
      run.posterior.beta[run.names.indexOf(name) + 1] >= -1e-10,
    )).toBe(true);
    expect(run.groupNames).toEqual(expect.arrayContaining(["Trend", "Seasonality", "Industry Trend", "Performance"]));
    expect(run.weeks.every((item) => Math.abs(
      item.fitted - (item.contrib.Trend + item.contrib.Seasonality + item.contrib["Industry Trend"] + item.contrib.Performance),
    ) < 0.02)).toBe(true);
  });
});
