// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import AsaKeywordFinder from "@/components/tools/AsaKeywordFinder";
import BrandCampaignIncrementality from "@/components/tools/BrandCampaignIncrementality";
import MulticollinearityChecker from "@/components/tools/MulticollinearityChecker";
import { TOOL_GROUP, computeAnalyzeSig, useAppStore } from "@/store/useDataStore";
import { buildDemoCsv } from "@/utils/demoData";

const EMPTY_CSV = { raw: [], headers: [], mapping: {}, fileName: "", mappedRows: [] };

function seedConfirmedUserData(routeId, group) {
  const demo = buildDemoCsv(group);
  const csvData = { ...demo, fileName: `uploaded_${group}.csv` };
  const state = useAppStore.getState();
  const dataGroup = TOOL_GROUP[routeId];
  useAppStore.setState({
    currentRouteId: routeId,
    activeDataGroup: dataGroup,
    csvData,
    csvGroups: { ...state.csvGroups, [dataGroup]: csvData },
    analyzedByGroup: { ...state.analyzedByGroup, [dataGroup]: computeAnalyzeSig(csvData) },
    decisionRecords: [],
    demoDisabled: true,
  });
}

function seedVifPanel(costFor) {
  const mappedRows = Array.from({ length: 8 }, (_, day) => ["A", "B"].map((channel, channelIndex) => ({
    date: `2026-08-${String(day + 1).padStart(2, "0")}`,
    channel,
    cost: costFor(day, channelIndex),
  }))).flat();
  const csvData = {
    raw: mappedRows,
    headers: ["date", "channel", "cost"],
    mapping: { date: "date", channel: "channel", cost: "cost" },
    fileName: "uploaded_vif.csv",
    mappedRows,
  };
  const state = useAppStore.getState();
  const dataGroup = TOOL_GROUP["5-25"];
  useAppStore.setState({
    currentRouteId: "5-25",
    activeDataGroup: dataGroup,
    csvData,
    csvGroups: { ...state.csvGroups, [dataGroup]: csvData },
    analyzedByGroup: { ...state.analyzedByGroup, [dataGroup]: computeAnalyzeSig(csvData) },
    decisionRecords: [],
    demoDisabled: true,
  });
}

describe("decision review coverage for diagnostic tools", () => {
  beforeEach(() => {
    window.gtag = vi.fn();
    const state = useAppStore.getState();
    useAppStore.setState({
      csvData: EMPTY_CSV,
      csvGroups: Object.fromEntries(Object.keys(state.csvGroups || {}).map((key) => [key, EMPTY_CSV])),
      analyzedByGroup: Object.fromEntries(Object.keys(state.analyzedByGroup || {}).map((key) => [key, null])),
      decisionRecords: [],
      demoDisabled: true,
    });
  });
  afterEach(() => {
    cleanup();
    delete window.gtag;
  });

  it.each([
    ["VIF", "5-25", "collinearity", () => <MulticollinearityChecker />],
    ["ASA", "5-26", "asa_keyword", () => <AsaKeywordFinder />],
  ])("adds a real-data decision review after %s analysis", (_name, routeId, group, renderTool) => {
    seedConfirmedUserData(routeId, group);
    const { container } = render(renderTool());
    expect(container.querySelector(`[data-decision-review-tool="${routeId}"]`)).toBeTruthy();
    expect(container.textContent).toContain("다음 검토 약속 만들기");
    expect(window.gtag).toHaveBeenCalledWith("event", "analysis_completed", expect.objectContaining({
      tool_id: routeId,
      analysis_type: routeId === "5-25" ? "multicollinearity" : "asa_keyword",
      placement: "result_action_card",
    }));
    if (routeId === "5-25") {
      expect(container.querySelector("#vif-setup")).toBeTruthy();
      expect(container.querySelector("#vif-result")).toBeTruthy();
      expect(screen.getByRole("heading", { name: "채널별 VIF" })).toBeTruthy();
      expect(screen.getByRole("heading", { name: "가장 함께 움직인 채널쌍" })).toBeTruthy();
    } else {
      expect(container.querySelector("#asa-setup")).toBeTruthy();
      expect(container.querySelector("#asa-summary")).toBeTruthy();
    }
  });

  it("adds a decision review after a real brand-incrementality estimate", async () => {
    seedConfirmedUserData("5-24", "brand_incrementality");
    const { container } = render(<BrandCampaignIncrementality />);
    fireEvent.click(screen.getByRole("button", { name: "증분 추정하기" }));
    await waitFor(() => expect(container.querySelector('[data-decision-review-tool="5-24"]')).toBeTruthy());
    expect(container.textContent).toContain("다음 검토 약속 만들기");
    expect(window.gtag).toHaveBeenCalledWith("event", "analysis_completed", expect.objectContaining({
      tool_id: "5-24",
      analysis_type: "brand_incrementality",
      placement: "result_action_card",
    }));
  });

  it("does not save a VIF decision when fewer than two spend columns vary", () => {
    seedVifPanel(() => 100);
    const { container } = render(<MulticollinearityChecker />);
    expect(container.textContent).toContain("계산 불가 · 변동 채널 2개 필요");
    expect(container.querySelector('[data-decision-review-tool="5-25"]')).toBeNull();
  });

  it("shows infinity instead of a false zero for perfect collinearity", () => {
    seedVifPanel((day, channelIndex) => (day + 1) * 100 * (channelIndex + 1));
    const { container } = render(<MulticollinearityChecker />);
    expect(container.textContent).toContain("최대 VIF ∞");
    expect(container.textContent).not.toContain("최대 VIF 0.00");
    expect(container.querySelector('[data-decision-review-tool="5-25"]')).toBeTruthy();
  });
});
