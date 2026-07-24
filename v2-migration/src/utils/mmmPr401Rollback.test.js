import { describe, expect, it } from "vitest";
import {
  MMM_METH_CONFIG,
  mmmBayesianRun,
  mmmBayesianWeeklyDecomp,
} from "./mmmMathPr401.js";

function fixture() {
  const n = 80;
  const week = Array.from({ length: n }, (_, index) => index + 1);
  const performance = week.map((value) => 120 + (value % 9) * 13);
  const brand = week.map((value) => 70 + (value % 6) * 17);
  return {
    week,
    weekLabel: week.map((value) => `week-${value}`),
    dateLabel: week.map((value) => `week-${value}`),
    ch: { performance, brand },
    channels: [
      { key: "performance", label: "Performance", kind: "perf" },
      { key: "brand", label: "Brand", kind: "brand" },
    ],
    targets: {
      RR: week.map((value, index) =>
        1800 - value * 2
        + performance[index] * 0.8
        + brand[index] * 0.45
        + Math.sin((2 * Math.PI * index) / 52) * 50,
      ),
    },
    dummy: {},
    steps: {},
    useDummies: false,
    external: {},
    externalDefs: [],
  };
}

describe("PR #401 frozen MMM engine", () => {
  it("retains the historical engine contract and decomposition identity", () => {
    expect(MMM_METH_CONFIG.version).toBe("1.2.0");
    expect(MMM_METH_CONFIG.mediaPenalty).toBe(4);
    expect(MMM_METH_CONFIG.seasonalityCandidates.map((candidate) => candidate.id))
      .toEqual(["none", "annual-1", "annual-2", "annual-3", "annual-4"]);

    const panel = fixture();
    const run = mmmBayesianRun(panel, MMM_METH_CONFIG, "RR", false, {
      skipTransformUncertainty: true,
      enableBaselineSelection: true,
    });
    const decomp = mmmBayesianWeeklyDecomp(run);

    expect(run).toBeTruthy();
    expect(run.trendFlexFrozen).toBeUndefined();
    expect(run.jointStructureSelection).toBeUndefined();
    expect(decomp.weeks).toHaveLength(panel.week.length);
    decomp.weeks.forEach((week) => {
      const contribution = decomp.groupNames.reduce(
        (sum, group) => sum + (Number(week.contrib[group]) || 0),
        0,
      );
      expect(week.fitted).toBeCloseTo(contribution, 1);
      expect(week.actual).toBeCloseTo(week.fitted + week.residual, 1);
    });
  });
});
