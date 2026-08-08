// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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

describe("decision review coverage for diagnostic tools", () => {
  beforeEach(() => {
    const state = useAppStore.getState();
    useAppStore.setState({
      csvData: EMPTY_CSV,
      csvGroups: Object.fromEntries(Object.keys(state.csvGroups || {}).map((key) => [key, EMPTY_CSV])),
      analyzedByGroup: Object.fromEntries(Object.keys(state.analyzedByGroup || {}).map((key) => [key, null])),
      decisionRecords: [],
      demoDisabled: true,
    });
  });
  afterEach(cleanup);

  it.each([
    ["VIF", "5-25", "collinearity", () => <MulticollinearityChecker />],
    ["ASA", "5-26", "asa_keyword", () => <AsaKeywordFinder />],
  ])("adds a real-data decision review after %s analysis", (_name, routeId, group, renderTool) => {
    seedConfirmedUserData(routeId, group);
    const { container } = render(renderTool());
    expect(container.querySelector(`[data-decision-review-tool="${routeId}"]`)).toBeTruthy();
    expect(container.textContent).toContain("다음 검토 약속 만들기");
    if (routeId === "5-25") {
      expect(screen.getByRole("heading", { name: "채널별 VIF" })).toBeTruthy();
      expect(screen.getByRole("heading", { name: "가장 함께 움직인 채널쌍" })).toBeTruthy();
    }
  });

  it("adds a decision review after a real brand-incrementality estimate", async () => {
    seedConfirmedUserData("5-24", "brand_incrementality");
    const { container } = render(<BrandCampaignIncrementality />);
    fireEvent.click(screen.getByRole("button", { name: "증분 추정하기" }));
    await waitFor(() => expect(container.querySelector('[data-decision-review-tool="5-24"]')).toBeTruthy());
    expect(container.textContent).toContain("다음 검토 약속 만들기");
  });
});
