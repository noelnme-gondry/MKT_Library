// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

vi.mock("@/components/CsvUploader", () => ({
  default: ({ mappingReviewActionLabel, mappingReviewStage, onMappingReviewConfirmed, onMappingReviewNeedsSemanticFallback }) => (
    <button
      type="button"
      onClick={mappingReviewStage === "legacy" ? onMappingReviewNeedsSemanticFallback : onMappingReviewConfirmed}
    >
      {mappingReviewActionLabel}
    </button>
  ),
}));
vi.mock("@/components/Dashboard", () => ({ default: () => <div>원본 대시보드</div> }));
vi.mock("@/components/tools/CampaignPvm", () => ({ default: () => <div>원본 성과 변동</div> }));
vi.mock("@/components/tools/MarketingEfficiency", () => ({ default: () => <div>원본 포화도</div> }));
vi.mock("@/components/tools/BudgetAllocation", () => ({ default: () => <div>원본 예산 배분</div> }));

import DochiResultWorkspace from "@/components/assistant/DochiResultWorkspace";

const EMPTY = { raw: [], headers: [], mapping: {}, fileName: "" };
const DATA = {
  raw: [{ Date: "2026-08-01", Channel: "Search", Spend: "100", Installs: "10" }],
  headers: ["Date", "Channel", "Spend", "Installs"],
  mapping: { Date: "date", Channel: "channel", Spend: "cost", Installs: "installs" },
  fileName: "campaign.csv",
};

afterEach(() => {
  vi.useRealTimers();
  push.mockReset();
  useAppStore.setState({
    currentRouteId: "home",
    csvData: EMPTY,
    csvGroups: { ...useAppStore.getState().csvGroups, efficiency: EMPTY },
    analyzedByGroup: { ...useAppStore.getState().analyzedByGroup, efficiency: null },
    dochiAnalysisSession: null,
  });
  document.body.innerHTML = "";
});

describe("DochiResultWorkspace", () => {
  it("does not invent a result when opened without a CSV", () => {
    render(<DochiResultWorkspace />);
    expect(screen.getByRole("heading", { name: "먼저 도치에게 CSV를 맡겨 주세요" })).toBeTruthy();
  });

  it("keeps one CSV mapping UI while using semantic mapping only as an internal fallback", async () => {
    vi.useFakeTimers();
    useAppStore.setState({
      currentRouteId: "dochi-result",
      csvData: DATA,
      csvGroups: { ...useAppStore.getState().csvGroups, efficiency: DATA },
    });
    render(<DochiResultWorkspace />);

    expect(screen.getByRole("heading", { name: "컬럼을 확인해 주세요" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "확인하고 결과 가져오기" }));
    expect(screen.getByRole("button", { name: "확인하고 결과 가져오기" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "확인하고 결과 가져오기" }));
    expect(document.querySelector(".dochi-journey.is-running")).toBeTruthy();
    expect(document.querySelector(".dochi-journey__mascot .dochi-sprite.is-delivery")).toBeTruthy();
    expect(document.querySelectorAll(".dochi-journey__books i")).toHaveLength(3);
    expect(document.querySelector(".dochi-journey__data-card")).toBeTruthy();
    expect(document.querySelector(".dochi-journey__chart-card")).toBeTruthy();
    expect(screen.getByText("아하!")).toBeTruthy();
    expect(document.querySelector(".dochi-journey__runner")).toBeNull();
    act(() => vi.advanceTimersByTime(1100));
    await act(async () => { await Promise.resolve(); });

    expect(screen.getByRole("heading", { name: "같은 데이터로 바로 보는 분석 결과" })).toBeTruthy();
    expect(screen.getByText("원본 대시보드")).toBeTruthy();
    const openToolButtons = screen.getAllByRole("button", { name: "해당 분석으로 가기" });
    expect(openToolButtons).toHaveLength(4);
    expect(useAppStore.getState().isGroupAnalyzed("5-2")).toBe(true);
    expect(useAppStore.getState().dochiAnalysisSession.analyses.some((analysis) => analysis.toolId === "5-2")).toBe(true);
    fireEvent.click(openToolButtons[0]);
    expect(push).toHaveBeenCalledWith("/dashboard");
    expect(useAppStore.getState().csvGroups.efficiency).toBe(DATA);
  });

  it("returns to the remembered summary instead of restarting mapping after a detailed-tool visit", () => {
    useAppStore.setState({
      currentRouteId: "dochi-result",
      csvData: DATA,
      csvGroups: { ...useAppStore.getState().csvGroups, efficiency: DATA },
      dochiAnalysisSession: { sourceData: DATA, analyses: [{ toolId: "5-2", status: "ready" }] },
    });
    render(<DochiResultWorkspace />);

    expect(screen.getByRole("heading", { name: "같은 데이터로 바로 보는 분석 결과" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "컬럼을 확인해 주세요" })).toBeNull();
  });
});
