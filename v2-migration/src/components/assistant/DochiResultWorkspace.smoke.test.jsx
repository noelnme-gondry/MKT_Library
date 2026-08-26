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
import DochiResultWorkspace from "@/components/assistant/DochiResultWorkspace";

const EMPTY = { raw: [], headers: [], mapping: {}, fileName: "" };
const DATA = {
  raw: [{ Date: "2026-08-01", Channel: "Search", Spend: "100", Installs: "10", Actions: "2" }],
  headers: ["Date", "Channel", "Spend", "Installs", "Actions"],
  mapping: { Date: "date", Channel: "channel", Spend: "cost", Installs: "installs", Actions: "actions" },
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
    denomBasis: "installs",
    displayCurrency: "KRW",
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

    expect(screen.getByRole("heading", { name: "도치 결과함" })).toBeTruthy();
    expect(screen.queryByText("원본 대시보드")).toBeNull();
    expect(useAppStore.getState().isGroupAnalyzed("5-2")).toBe(true);
    expect(useAppStore.getState().dochiAnalysisSession).toBeTruthy();
  });

  it("returns to the remembered summary instead of restarting mapping after a detailed-tool visit", () => {
    useAppStore.setState({
      currentRouteId: "dochi-result",
      csvData: DATA,
      csvGroups: { ...useAppStore.getState().csvGroups, efficiency: DATA },
      dochiAnalysisSession: { sourceData: DATA, analyses: [{ toolId: "5-2", status: "ready" }] },
    });
    render(<DochiResultWorkspace />);

    expect(screen.getByRole("heading", { name: "도치 결과함" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "컬럼을 확인해 주세요" })).toBeNull();
  });
});
