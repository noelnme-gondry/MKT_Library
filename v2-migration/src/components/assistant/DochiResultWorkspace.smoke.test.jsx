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
  it.each(["ko", "en"])("hands the mapped campaign CSV to weekly review without re-upload (%s)", locale => {
    const data = { ...DATA, raw: DATA.raw.map(row => ({ ...row, Campaign: "Test" })), headers: [...DATA.headers, "Campaign"], mapping: { ...DATA.mapping, Campaign: "campaign_name" }, currency: "KRW" };
    useAppStore.setState({ currentRouteId: "dochi-result", csvData: data, csvGroups: { ...useAppStore.getState().csvGroups, efficiency: data }, dochiAnalysisSession: { sourceData: data, analyses: [] } });
    render(<DochiResultWorkspace locale={locale} />);
    const button = screen.getByRole("button", { name: locale === "en" ? "Build weekly review" : "주간 리뷰 만들기" });
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    expect(push).toHaveBeenCalledWith(locale === "en" ? "/en/weekly-review" : "/weekly-review");
    useAppStore.getState().setCurrentRouteId("weekly-review");
    expect(useAppStore.getState().csvData.raw).toEqual(data.raw);
    expect(useAppStore.getState().isGroupAnalyzed("5-2")).toBe(true);
  });
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

    expect(screen.getByRole("heading", { name: "분석 결과" })).toBeTruthy();
    expect(document.querySelector(".dochi-result-workspace__header.is-results")).toBeTruthy();
    expect(screen.getByText("모든 효율 분석에 같이 적용")).toBeTruthy();
    expect(screen.getByText("판정할 날짜 부족")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "도치가 찾은 분석 지도" })).toBeNull();
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

    expect(screen.getByRole("heading", { name: "분석 결과" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "컬럼을 확인해 주세요" })).toBeNull();
  });

  it("shows the automatic signup-basis fallback when installs are mapped but all zero", () => {
    const signupData = {
      ...DATA,
      raw: DATA.raw.map((row) => ({ ...row, Installs: "0", Actions: "12" })),
    };
    useAppStore.setState({
      currentRouteId: "dochi-result",
      csvData: signupData,
      csvGroups: { ...useAppStore.getState().csvGroups, efficiency: signupData },
      dochiAnalysisSession: { sourceData: signupData, analyses: [{ toolId: "5-2", status: "ready" }] },
    });
    render(<DochiResultWorkspace />);

    expect(screen.getByRole("button", { name: "설치" }).disabled).toBe(true);
    expect(screen.getByRole("button", { name: "가입" }).classList.contains("active")).toBe(true);
    expect(screen.getByText("양수 값이 없어 가입 기준을 자동 적용했습니다")).toBeTruthy();
  });
});
