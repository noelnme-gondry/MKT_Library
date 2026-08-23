// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";

vi.mock("@/components/CsvUploader", () => ({
  default: ({ mappingReviewActionLabel, onMappingReviewConfirmed }) => (
    <button type="button" onClick={onMappingReviewConfirmed}>{mappingReviewActionLabel}</button>
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
  useAppStore.setState({
    currentRouteId: "home",
    csvData: EMPTY,
    csvGroups: { ...useAppStore.getState().csvGroups, efficiency: EMPTY },
    analyzedByGroup: { ...useAppStore.getState().analyzedByGroup, efficiency: null },
  });
  document.body.innerHTML = "";
});

describe("DochiResultWorkspace", () => {
  it("does not invent a result when opened without a CSV", () => {
    render(<DochiResultWorkspace />);
    expect(screen.getByRole("heading", { name: "먼저 도치에게 CSV를 맡겨 주세요" })).toBeTruthy();
  });

  it("keeps mapping on the dedicated page, then opens original tool views after confirmation", async () => {
    vi.useFakeTimers();
    useAppStore.setState({
      currentRouteId: "dochi-result",
      csvData: DATA,
      csvGroups: { ...useAppStore.getState().csvGroups, efficiency: DATA },
    });
    render(<DochiResultWorkspace />);

    expect(screen.getByRole("heading", { name: "컬럼을 확인해 주세요" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "확인하고 결과 가져오기" }));
    expect(document.querySelector(".dochi-journey.is-running")).toBeTruthy();
    act(() => vi.advanceTimersByTime(1850));
    await act(async () => { await Promise.resolve(); });

    expect(screen.getByRole("heading", { name: "같은 데이터로 바로 보는 분석 결과" })).toBeTruthy();
    expect(screen.getByText("원본 대시보드")).toBeTruthy();
    expect(useAppStore.getState().isGroupAnalyzed("5-2")).toBe(true);
  });
});
