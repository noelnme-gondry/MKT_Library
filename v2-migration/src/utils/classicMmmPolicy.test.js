import { describe, expect, it } from "vitest";
import {
  auditClassicNoPriorRun,
  classicNoPriorConfig,
  classicNoPriorFitOptions,
} from "./classicMmmPolicy";
import {
  MMM_METH_CONFIG,
  mmmBayesianRun,
} from "./mmmMathPr416";

describe("Classic MMM no-prior policy", () => {
  it("overrides every forced prior and regularization path", () => {
    const cfg = classicNoPriorConfig({
      mediaPenalty: 4,
      controlPenalty: 0.15,
      trendPriorMultiplier: 3,
      mediaPenaltyCandidates: [0, 1, 4],
    });
    const options = classicNoPriorFitOptions({
      mediaPriors: { meta: { mean: 99, precision: 99 } },
      groupContributionPriors: { performance: { mean: 99, precision: 99 } },
      controlPriors: { trend: { mean: -99, precision: 99 } },
      enableBusinessContributionPrior: true,
      enableMediaPenaltySelection: true,
    });

    expect(cfg).toMatchObject({
      mediaPenalty: 0,
      controlPenalty: 0,
      trendPriorMultiplier: 1,
      mediaPenaltyCandidates: [0],
    });
    expect(options).toMatchObject({
      mediaPriors: {},
      groupContributionPriors: {},
      controlPriors: {},
      disableManualPriors: true,
      enableBusinessContributionPrior: false,
      enableMediaPenaltySelection: false,
    });
  });

  it("fails closed when an engine run reports any applied prior", () => {
    expect(auditClassicNoPriorRun({
      businessContributionPrior: { enabled: false },
      appliedMediaPriors: {},
      posterior: { calibratedPriorCount: 0 },
      effectiveCfg: { mediaPenalty: 0, controlPenalty: 0, trendPriorMultiplier: 1 },
      mediaPenaltySelection: { enabled: false },
    })).toEqual({ passed: true, reasons: [] });

    expect(auditClassicNoPriorRun({
      businessContributionPrior: { enabled: true },
      appliedMediaPriors: { meta: {} },
      posterior: { calibratedPriorCount: 1 },
      effectiveCfg: { mediaPenalty: 1, controlPenalty: 0.15, trendPriorMultiplier: 3 },
      mediaPenaltySelection: { enabled: true },
    }).reasons).toEqual([
      "business-contribution-prior",
      "external-media-prior",
      "calibrated-prior",
      "media-penalty",
      "control-penalty",
      "trend-prior",
      "media-penalty-selection",
    ]);
  });

  it("keeps a real Classic engine fit free of forced priors and penalties", () => {
    const week = Array.from({ length: 64 }, (_, index) => index + 1);
    const search = week.map((value) => 900 + ((value * 7) % 13) * 120);
    const social = week.map((value) => 500 + ((value * 11) % 17) * 80);
    const panel = {
      week,
      weekLabel: week.map(String),
      ch: { search, social },
      targets: {
        Revenue: week.map((value, index) => (
          6000 - value * 4 + search[index] * 0.22 + social[index] * 0.14
        )),
      },
      channels: [
        { key: "search", label: "Search", kind: "perf" },
        { key: "social", label: "Social", kind: "perf" },
      ],
      dummy: {},
      steps: {},
      external: {},
    };
    const cfg = classicNoPriorConfig({
      ...MMM_METH_CONFIG,
      seasonalityPeriods: [],
      seasonalityCandidates: [{ id: "none", periods: [] }],
      adstockGrid: [0, 0.4],
      bayesHalfSaturationQuantiles: [0.6],
      bayesHillSlopeGrid: [1],
    });
    const run = mmmBayesianRun(
      panel,
      cfg,
      "Revenue",
      false,
      classicNoPriorFitOptions({
        enableBaselineSelection: false,
        enableSeasonalitySelection: false,
        skipTransformUncertainty: true,
      }),
    );

    expect(auditClassicNoPriorRun(run)).toEqual({ passed: true, reasons: [] });
    expect(run.businessContributionPrior).toMatchObject({ enabled: false, reason: "disabled" });
    expect(run.appliedMediaPriors).toEqual({});
    expect(run.posterior.calibratedPriorCount).toBe(0);
    expect(run.channelContributions.search.source).toBe("observational");
    expect(run.channelContributions.social.source).toBe("observational");
  });
});
