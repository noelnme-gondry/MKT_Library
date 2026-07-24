import { describe, expect, it } from "vitest";
import {
  MMM_METH_CONFIG,
  mmmBuildAggregateMediaPanel,
  mmmClassicRun,
  mmmClassicTrendFlexSelection,
  mmmBayesianLikeRun,
  mmmPosteriorCovariance,
  mmmTruncatedNormalMoments,
  mmmMultivarTruncatedSample,
  mmmAggregateCrossCheck,
  mmmAggregateAdoptionGate,
  mmmBlackoutCrossFitEvidence,
  mmmDetectBlackoutWindows,
  mmmTrendDirectionPlan,
} from "./mmmMath";

function dualModelPanel(length = 80) {
  const week = Array.from({ length }, (_, index) => index + 1);
  const perfA = week.map((value) => 80 + (value % 9) * 7);
  const perfB = week.map((value) => 45 + (value % 5) * 11);
  const brandA = week.map((value) => value % 4 === 0 ? 180 : 25);
  const brandB = week.map((value) => value % 7 === 0 ? 140 : 15);
  const rr = week.map((value, index) =>
    1200
    - value * 1.5
    + 0.8 * perfA[index]
    + 0.5 * perfB[index]
    + 0.25 * brandA[index]
    + 0.2 * brandB[index]
    + Math.sin(value / 8) * 15,
  );
  return {
    week,
    weekLabel: week.map((value) => `2024-W${String(value).padStart(2, "0")}`),
    dateLabel: week.map((value) => `2024-W${String(value).padStart(2, "0")}`),
    ch: { perfA, perfB, brandA, brandB },
    channels: [
      { key: "perfA", label: "Performance A", kind: "perf" },
      { key: "perfB", label: "Performance B", kind: "perf" },
      { key: "brandA", label: "Brand A", kind: "brand" },
      { key: "brandB", label: "Brand B", kind: "brand" },
    ],
    external: {},
    externalDefs: [],
    dummy: {},
    dummyDefs: [],
    steps: {},
    stepDefs: [],
    useDummies: false,
    targets: { Regs: rr },
  };
}

function slicePanel(panel, end) {
  return {
    ...panel,
    week: panel.week.slice(0, end),
    weekLabel: panel.weekLabel.slice(0, end),
    dateLabel: panel.dateLabel.slice(0, end),
    ch: Object.fromEntries(Object.entries(panel.ch).map(([key, values]) => [key, values.slice(0, end)])),
    external: Object.fromEntries(Object.entries(panel.external).map(([key, values]) => [key, values.slice(0, end)])),
    dummy: Object.fromEntries(Object.entries(panel.dummy).map(([key, values]) => [key, values.slice(0, end)])),
    steps: Object.fromEntries(Object.entries(panel.steps).map(([key, values]) => [key, values.slice(0, end)])),
    targets: Object.fromEntries(Object.entries(panel.targets).map(([key, values]) => [key, values.slice(0, end)])),
  };
}

describe("dual MMM engines", () => {
  it("aggregates raw channel costs before media transformation", () => {
    const panel = dualModelPanel(8);
    const aggregate = mmmBuildAggregateMediaPanel(panel);
    expect(aggregate.channels.map((channel) => channel.key)).toEqual([
      "__performance_total",
      "__branding_total",
    ]);
    expect(aggregate.ch.__performance_total).toEqual(
      panel.week.map((_, index) => panel.ch.perfA[index] + panel.ch.perfB[index]),
    );
    expect(aggregate.ch.__branding_total).toEqual(
      panel.week.map((_, index) => panel.ch.brandA[index] + panel.ch.brandB[index]),
    );
  });

  it("computes known lower-truncated normal moments", () => {
    const moments = mmmTruncatedNormalMoments(0, 1);
    expect(moments.mean).toBeCloseTo(Math.sqrt(2 / Math.PI), 6);
    expect(moments.variance).toBeCloseTo(1 - 2 / Math.PI, 6);
    expect(moments.q05).toBeGreaterThan(0);
    expect(moments.q95).toBeGreaterThan(moments.mean);
  });

  it("restores full covariance to raw feature units", () => {
    const result = mmmPosteriorCovariance({
      sigma2: 4,
      beta: [10, 2, 3],
      unconstrainedBeta: [10, 2, 3],
      XtXinv: [
        [1, 0, 0],
        [0, 0.25, -0.1],
        [0, -0.1, 1],
      ],
    }, [2, 4], [5, 7]);
    expect(result.sigmaRaw[0][0]).toBeCloseTo(0.25, 10);
    expect(result.sigmaRaw[0][1]).toBeCloseTo(-0.05, 10);
    expect(result.sigmaRaw[1][1]).toBeCloseTo(0.25, 10);
    expect(result.sigmaRaw[0][1]).toBe(result.sigmaRaw[1][0]);
  });

  it("uses deterministic seeded orthant projection", () => {
    const args = [[0, 0], [[1, -0.4], [-0.4, 1]], [0, 1], 4242, 100];
    const first = mmmMultivarTruncatedSample(...args);
    const second = mmmMultivarTruncatedSample(...args);
    expect(first).toEqual(second);
    expect(first.every((draw) => draw.every((value) => value >= 0))).toBe(true);
  });

  it("classifies aggregate cross-check deterministically", () => {
    expect(mmmAggregateCrossCheck(100, 110, 0.15).verdict).toBe("consistent");
    expect(mmmAggregateCrossCheck(100, 140, 0.15).verdict).toBe("abstain-group-definition-sensitive");
  });

  it("uses paired one-standard-error aggregate adoption gate", () => {
    expect(mmmAggregateAdoptionGate([10, 11, 9], [10.2, 10.8, 9.1]).verdict).toBe("AGGREGATE ACCEPT");
    expect(mmmAggregateAdoptionGate([14, 15, 13], [10, 11, 10]).verdict).toBe("STRUCTURAL LOSS");
    expect(mmmAggregateAdoptionGate([10], [9]).verdict).toBe("ABSTAIN");
  });

  it("profiles and freezes 52/78/104-week trend flexibility with raw paid-cost nuisance", () => {
    const panel = dualModelPanel(208);
    const config = {
      ...MMM_METH_CONFIG,
      trendDirectionFirst: false,
      seasonalityPeriods: [],
      seasonalityCandidates: [{ id: "none", periods: [] }],
      jointStructureSeasonalityIds: ["none"],
      jointStructureMinTrain: 104,
      jointStructureHorizon: 12,
      jointStructureMaxFolds: 3,
      absorbed: new Set(),
    };
    const selection = mmmClassicTrendFlexSelection(panel, config, "Regs");
    expect(selection.enabled).toBe(true);
    expect(selection.candidates).toHaveLength(9);
    expect(mmmClassicTrendFlexSelection(panel, config, "Regs")).toEqual(selection);
    expect([52, 78, 104]).toContain(selection.trendFlexFrozen.smoothingWindowWeeks);
    expect([0, 1, 2]).toContain(selection.trendFlexFrozen.knotCount);
    expect(selection.trendFlexFrozen.nuisance).toEqual(expect.objectContaining({
      name: "paid_cost_total_nuisance",
      adstocked: false,
      hillTransformed: false,
      freezeOnly: true,
      includedInFinalFit: false,
    }));
    expect(Object.isFrozen(selection.trendFlexFrozen)).toBe(true);
    expect(Object.isFrozen(selection.trendFlexFrozen.nuisance)).toBe(true);
    expect(() => {
      selection.trendFlexFrozen.knotCount = 99;
    }).toThrow(TypeError);
    const firstCandidate = selection.candidates[0];
    const firstFold = firstCandidate.foldPlans[0];
    const independentPlan = mmmTrendDirectionPlan(
      slicePanel(panel, firstFold.cut),
      "Regs",
      {
        smoothingWindowWeeks: firstCandidate.smoothingWindowWeeks,
        knotCount: firstCandidate.knotCount,
      },
    );
    expect(firstFold.knotLocations).toEqual(independentPlan.knots);
    expect(firstFold.segmentDirections).toEqual(independentPlan.segments.map((segment) => segment.direction));
    expect(independentPlan.smoothing.approximateWindowWeeks).toBe(firstCandidate.smoothingWindowWeeks);
    const shiftedCostPanel = {
      ...panel,
      ch: Object.fromEntries(Object.entries(panel.ch).map(([key, values]) => [
        key,
        values.map((_, index) => values[(index + 17) % values.length]),
      ])),
    };
    const shiftedCostSelection = mmmClassicTrendFlexSelection(shiftedCostPanel, config, "Regs");
    expect(shiftedCostSelection.selected.foldWmapes).not.toEqual(selection.selected.foldWmapes);
    const classic = mmmClassicRun(panel, config, "Regs", true, {
      skipTransformUncertainty: true,
      enableMediaPenaltySelection: false,
    });
    expect(classic.trendFlexFrozen).toEqual(selection.trendFlexFrozen);
    expect(classic.aggregateRollingBacktest.foldWmapes).toHaveLength(3);
    expect(classic.names).not.toContain("paid_cost_total_nuisance");
    expect(classic.trendDirectionPlan.smoothing.requestedWindowWeeks)
      .toBe(classic.trendFlexFrozen.smoothingWindowWeeks);
    const bayesianLike = mmmBayesianLikeRun(panel, config, "Regs", true, {
      skipTransformUncertainty: true,
      enableMediaPenaltySelection: false,
      draws: 200,
    });
    expect(bayesianLike.rollingBacktest.cuts).toEqual(classic.aggregateRollingBacktest.cuts);
    expect(mmmAggregateAdoptionGate(
      classic.aggregateRollingBacktest.foldWmapes,
      bayesianLike.rollingBacktest.foldWmapes,
    ).foldCount).toBe(3);
  }, 30000);

  it("builds and keeps both model results separately", () => {
    const panel = dualModelPanel();
    const config = {
      ...MMM_METH_CONFIG,
      trendDirectionFirst: false,
      seasonalityPeriods: [],
      seasonalityCandidates: [{ id: "none", periods: [] }],
      jointStructureSeasonalityIds: ["none"],
      jointStructureTrendFamilies: [0],
      adstockGrid: [0, 0.4],
      bayesHalfSaturationQuantiles: [0.6],
      bayesHillSlopeGrid: [1],
      bayesMaxProfileCandidates: 2,
      bayesMaxTotalProfileFits: 8,
      mediaPenaltyCandidates: [1],
      absorbed: new Set(),
    };
    const classic = mmmClassicRun(panel, config, "Regs", false, {
      skipTransformUncertainty: true,
      enableMediaPenaltySelection: false,
    });
    const bayesianLike = mmmBayesianLikeRun(panel, config, "Regs", false, {
      skipTransformUncertainty: true,
      enableJointStructureSelection: false,
      enableBaselineSelection: false,
      enableMediaPenaltySelection: false,
      draws: 500,
    });
    expect(classic.modelVariant).toBe("classic");
    expect(classic.channelMeta).toHaveLength(2);
    expect(classic.names.filter((name) => name.startsWith("media_"))).toHaveLength(2);
    expect(classic.names).not.toContain("paid_cost_total_nuisance");
    expect(classic.effectiveCfg.mediaPenalty).toBe(0);
    expect(bayesianLike.modelVariant).toBe("bayesian-like");
    expect(bayesianLike.effectiveCfg.mediaPenalty).toBe(0);
    expect(bayesianLike.posteriorApproximation.enabled).toBe(true);
    expect(bayesianLike.channelMeta).toHaveLength(4);
    bayesianLike.weeks.forEach((week) => {
      const sum = week.baseline + bayesianLike.groupNames.reduce(
        (total, group) => total + (Number(week.contrib[group]) || 0),
        0,
      );
      expect(week.fitted).toBeCloseTo(sum, 8);
      expect(week.actual).toBeCloseTo(week.fitted + week.residual, 8);
    });
  }, 30000);

  it("detects an eligible paid-media blackout and restart deterministically", () => {
    const panel = dualModelPanel(120);
    Object.keys(panel.ch).forEach((key) => {
      panel.ch[key] = panel.ch[key].map((value, index) =>
        index >= 90 && index < 94 ? 0 : value,
      );
    });
    const windows = mmmDetectBlackoutWindows(panel, {
      minPreWeeks: 78,
      minOffWeeks: 3,
      postWeeks: 3,
    });
    expect(windows).toHaveLength(1);
    expect(windows[0]).toEqual(expect.objectContaining({
      start: 90,
      end: 94,
      restart: 94,
      offWeeks: 4,
      postWeeks: 3,
    }));
    expect(mmmDetectBlackoutWindows(panel, {
      minPreWeeks: 78,
      minOffWeeks: 3,
      postWeeks: 3,
    })).toEqual(windows);
  });

  it("uses held-out blackout outcomes only after the positive-effect gate passes", () => {
    const panel = dualModelPanel(120);
    Object.keys(panel.ch).forEach((key) => {
      panel.ch[key] = panel.ch[key].map((value, index) =>
        index >= 90 && index < 94 ? 0 : value,
      );
    });
    panel.targets.Regs = panel.targets.Regs.map((value, index) =>
      index >= 94 && index < 97 ? value + 3000 : value,
    );
    const config = {
      ...MMM_METH_CONFIG,
      trendDirectionFirst: false,
      seasonalityPeriods: [],
      seasonalityCandidates: [{ id: "none", periods: [] }],
      jointStructureSeasonalityIds: ["none"],
      jointStructureMinTrain: 104,
      adstockGrid: [0],
      bayesHalfSaturationQuantiles: [0.6],
      bayesHillSlopeGrid: [1],
      mediaPenalty: 0,
      mediaPenaltyCandidates: [0],
      absorbed: new Set(),
    };
    const evidence = mmmBlackoutCrossFitEvidence(panel, config, "Regs");
    expect(evidence.applied).toBe(true);
    expect(evidence.prior).toEqual(expect.objectContaining({
      source: "cross-fitted-blackout",
      excludedFromLikelihood: true,
    }));
    expect(evidence.application.excludedRange).toEqual([90, 97]);
    expect(evidence.application.fitRowMask.slice(90, 97)).toEqual(Array(7).fill(false));
    expect(evidence.estimate.positiveProbability).toBeGreaterThanOrEqual(0.8);
  }, 30000);
});
