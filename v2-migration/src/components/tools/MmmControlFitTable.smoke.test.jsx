// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { mmmControlFitRows } from "@/utils/mmmControlContract";
import { MMM_METH_CONFIG, mmmBayesianLikeRun } from "@/utils/mmmMath";
import MmmControlFitTable from "@/components/tools/MmmControlFitTable";

function productionControlRows() {
  const week = Array.from({ length: 80 }, (_, index) => index + 1);
  const paid = week.map((value) => 50 + (value % 11) * 7);
  const market = week.map((value) => 90 + (value % 13) * 3 + Math.sin(value / 5) * 4);
  const panel = {
    week,
    weekLabel: week.map((value) => `2025-W${String(value).padStart(2, "0")}`),
    dateLabel: week.map((value) => `2025-W${String(value).padStart(2, "0")}`),
    ch: { paid },
    channels: [{ key: "paid", label: "Paid", kind: "perf" }],
    external: { market, price: market.slice() },
    dummy: {},
    dummyDefs: [],
    steps: {},
    stepDefs: [],
    useDummies: false,
    targets: {
      Revenue: week.map((value, index) => 400 + paid[index] * 0.8 + market[index] * 1.2 + Math.sin(value / 3)),
    },
  externalDefs: [
      { key: "market", label: "Market demand" },
      { key: "price", label: "Price index" },
    { key: "weather", label: "Weather" },
  ],
  };
  const cfg = {
    ...MMM_METH_CONFIG,
    includeTrend: false,
    trendDirectionFirst: false,
    seasonalityPeriods: [],
    seasonalityCandidates: [{ id: "none", periods: [] }],
    jointStructureSeasonalityIds: ["none"],
    jointStructureTrendFamilies: [0],
    adstockGrid: [0],
    bayesHalfSaturationQuantiles: [0.6],
    bayesHillSlopeGrid: [1],
    bayesMaxProfileCandidates: 1,
    bayesMaxTotalProfileFits: 4,
    mediaPenaltyCandidates: [1],
    absorbed: new Set(),
  };
  const run = mmmBayesianLikeRun(panel, cfg, "Revenue", false, {
    skipTransformUncertainty: true,
    enableJointStructureSelection: false,
    enableBaselineSelection: false,
    enableMediaPenaltySelection: false,
    draws: 200,
  });
  return { panel, rows: mmmControlFitRows(panel, run), run };
}

describe("MmmControlFitTable", () => {
  it("renders computed included, dropped, and unused rows through the shared table", () => {
    const { rows, run } = productionControlRows();
    expect(run.droppedFeatures).toContain("industry_price");
    const { container } = render(<MmmControlFitTable rows={rows} locale="ko" />);

    expect(container.querySelector(".ds-data-table")).toBeTruthy();
    expect(screen.getByText("공동 적합에 포함")).toBeTruthy();
    expect(screen.getByText("독립 변화 부족으로 제외")).toBeTruthy();
    expect(screen.getByText("적합에 사용되지 않음")).toBeTruthy();
    expect(screen.getAllByText("기준 대비 로그 변화")).toHaveLength(2);
  });

  it("renders the same computed contract in English", () => {
    render(<MmmControlFitTable rows={productionControlRows().rows} locale="en" />);
    expect(screen.getByRole("region", { name: "Continuous-control model status" })).toBeTruthy();
    expect(screen.getByText("Included in joint fit")).toBeTruthy();
    expect(screen.getByText("Excluded: no independent variation")).toBeTruthy();
    expect(screen.getByText("Not used in fit")).toBeTruthy();
  });
});
