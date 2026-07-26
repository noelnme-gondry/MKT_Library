import { describe, expect, it } from "vitest";
import {
  MMM_PRISM_MODEL_CONFIG,
  MMM_METH_CONFIG,
  mmmAdstock,
  mmmBayesianRun,
  mmmClassicBuildGroupContributionPriors,
  mmmBayesianWeeklyDecomp,
} from "./mmmMathPr416";
import { sliceMmmChannelContributions } from "./mmmWeeklyPerformance";

describe("PR #416 MMM rollback contract", () => {
  it("keeps the generic Classic trend prior neutral while Prism stays explicit", () => {
    expect(MMM_METH_CONFIG.trendPriorMultiplier).toBe(1);
    expect(MMM_PRISM_MODEL_CONFIG.trendPriorMultiplier).toBe(1.1);
    expect(MMM_PRISM_MODEL_CONFIG.requiresExternalIndustry).toBe(true);
  });

  it("keeps the frozen engine and makes Decomp media equal the channel RR sum", () => {
    const n = 64;
    const week = Array.from({ length: n }, (_, index) => index + 1);
    const search = week.map((value) => 900 + ((value * 7) % 13) * 120);
    const social = week.map((value) => 500 + ((value * 11) % 17) * 80);
    const brandVideo = week.map((value) => 300 + ((value * 5) % 19) * 65);
    const target = week.map((value, index) => (
      6000 - value * 8
      + search[index] * 0.22
      + social[index] * 0.14
      + brandVideo[index] * 0.1
    ));
    const panel = {
      week,
      weekLabel: week.map(String),
      ch: { search, social, brandVideo },
      targets: { Regs: target },
      channels: [
        { key: "search", label: "Search", kind: "perf" },
        { key: "social", label: "Social", kind: "perf" },
        { key: "brandVideo", label: "Brand video", kind: "brand" },
      ],
      dummy: {},
      steps: {},
      external: {},
    };
    const cfg = {
      ...MMM_METH_CONFIG,
      seasonalityPeriods: [],
      seasonalityCandidates: [{ id: "none", periods: [] }],
      adstockGrid: [0, 0.4],
      bayesHalfSaturationQuantiles: [0.6],
      bayesHillSlopeGrid: [1],
      mediaPenaltyCandidates: [1],
      steps: {},
    };
    const run = mmmBayesianRun(panel, cfg, "Regs", false, {
      enableBaselineSelection: false,
      enableSeasonalitySelection: false,
      enableMediaPenaltySelection: false,
      skipTransformUncertainty: true,
    });
    expect(MMM_METH_CONFIG.version).toBe("1.6.0");
    expect(run?.engine).toBe("bayesian");
    expect(mmmBayesianWeeklyDecomp(run)?.weeks).toHaveLength(n);

    run.weeks.forEach((row, index) => {
      const performance = run.channelContributions.search.weeklyMean[index]
        + run.channelContributions.social.weeklyMean[index];
      const branding = run.channelContributions.brandVideo.weeklyMean[index];
      expect(row.contrib.Performance).toBeCloseTo(performance, 10);
      expect(row.contrib.Brand).toBeCloseTo(branding, 10);
    });

    const start = 12;
    const end = 52;
    const sliced = sliceMmmChannelContributions(run.channelContributions, start, end);
    const channelPerformance = sliced.search.totalMean + sliced.social.totalMean;
    const channelBrand = sliced.brandVideo.totalMean;
    const decompPerformance = run.weeks.slice(start, end)
      .reduce((sum, row) => sum + row.contrib.Performance, 0);
    const decompBrand = run.weeks.slice(start, end)
      .reduce((sum, row) => sum + row.contrib.Brand, 0);
    expect(channelPerformance).toBeCloseTo(decompPerformance, 8);
    expect(channelBrand).toBeCloseTo(decompBrand, 8);
  });

  it("builds the Classic Prism group priors from target shares, not channel guesses", () => {
    const n = 64;
    const week = Array.from({ length: n }, (_, index) => index + 1);
    const aggregatePanel = {
      week,
      weekLabel: week.map(String),
      ch: {
        performance_total: week.map((value) => 900 + (value % 7) * 100),
        branding_total: week.map((value) => 500 + (value % 5) * 80),
      },
      targets: { RR: week.map((value) => 7000 + value * 4) },
      channels: [
        { key: "performance_total", label: "Performance total", kind: "perf" },
        { key: "branding_total", label: "Branding total", kind: "brand" },
      ],
      dummy: {},
      steps: {},
      external: { dating_market_install_total: week.map((value) => 1000 + value * 2) },
    };
    const cfg = {
      ...MMM_METH_CONFIG,
      seasonalityPeriods: [52.18],
      seasonalityCandidates: [{ id: "annual-1", periods: [52.18] }],
      adstockGrid: [0],
      bayesHalfSaturationQuantiles: [0.6],
      bayesHillSlopeGrid: [1],
      mediaPenaltyCandidates: [1],
    };
    const baseline = mmmBayesianRun(aggregatePanel, cfg, "RR", false, {
      enableSeasonalitySelection: false,
      enableMediaPenaltySelection: false,
      skipTransformUncertainty: true,
    });
    const priors = mmmClassicBuildGroupContributionPriors(
      aggregatePanel,
      aggregatePanel.targets.RR,
      baseline,
      MMM_PRISM_MODEL_CONFIG,
    );
    const totalTarget = aggregatePanel.targets.RR.reduce((sum, value) => sum + value, 0);
    expect(priors.performance_total.source).toBe("business-contribution");
    expect(priors.branding_total.source).toBe("business-contribution");
    expect(priors.performance_total.contributionMean).toBeCloseTo(totalTarget * MMM_PRISM_MODEL_CONFIG.performanceContributionShare, 8);
    expect(priors.branding_total.contributionMean).toBeCloseTo(totalTarget * MMM_PRISM_MODEL_CONFIG.brandingContributionShare, 8);
  });
});
