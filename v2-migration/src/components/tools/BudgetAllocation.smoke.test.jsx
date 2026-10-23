// @vitest-environment jsdom
//
// Render-smoke for BudgetAllocation (5-3). Regression net for the
// CampaignPvm-class crashes: a route component that throws during render or a
// mount effect. Golden tests (src/utils/*.test.js) cover the pure math; this
// asserts the component MOUNTS without throwing in both the no-data and
// with-data states. Copy this pattern verbatim for the other tool components.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, act, fireEvent, screen } from "@testing-library/react";
import { ALLOC_MATH } from "@/utils/allocationMath";
import { useAppStore } from "@/store/useDataStore";
import BudgetAllocation from "@/components/tools/BudgetAllocation";
import { buildSampleJourney } from "@/lib/sampleJourney";
import { openResultDetails } from "@/test/resultDetails";

// 근거 구역("자세히 보기")은 기본 닫힘 — 사람이 하듯 열고 본다.
const renderOpen = (ui) => { const view = render(ui); openResultDetails(); return view; };

// Empty CSV slice = the "no data yet, show uploader" state.
const EMPTY_CSV = { raw: [], headers: [], mapping: {}, fileName: "" };

// A minimal but VALID efficiency CSV for 5-3: original headers → standard keys.
// mapping is { originalHeader: standardKey } (see utils/dashboardAggregator getMappedRows).
// BudgetAllocation needs cost + a result metric (installs) grouped by channel/country
// across >=1 date, for >=2 channels so the allocator has something to split.
function seedWithData() {
  const headers = ["Date", "Country", "Platform", "Channel", "Spend", "Installs"];
  const mapping = {
    Date: "date",
    Country: "country",
    Platform: "platform",
    Channel: "channel",
    Spend: "cost",
    Installs: "installs",
  };
  const raw = [];
  const channels = ["Google", "Meta"];
  for (let d = 1; d <= 10; d++) {
    const date = `2026-01-${String(d).padStart(2, "0")}`;
    for (const ch of channels) {
      const cost = ch === "Google" ? 100000 + d * 3000 : 80000 + d * 2500;
      // deterministic diminishing-returns-ish result (NO Math.random — §8)
      const installs = Math.round(cost / (ch === "Google" ? 5000 : 4200));
      raw.push({ Date: date, Country: "KR", Platform: "iOS", Channel: ch, Spend: cost, Installs: installs });
    }
  }
  useAppStore.setState({
    currentRouteId: "5-3",
    csvGroups: { ...useAppStore.getState().csvGroups, efficiency: { raw, headers, mapping, fileName: "alloc.csv" } },
    csvData: { raw, headers, mapping, fileName: "alloc.csv" },
  });
  useAppStore.getState().setGroupAnalyzed("5-3");
}

function seedNoData() {
  useAppStore.setState({
    currentRouteId: "5-3",
    csvGroups: { ...useAppStore.getState().csvGroups, efficiency: EMPTY_CSV },
    csvData: EMPTY_CSV,
  });
}

describe("BudgetAllocation render smoke", () => {
  beforeEach(() => {
    // Reset the mirror + active group before each case so state can't leak.
    seedNoData();
  });
  it("waits for explicit analysis before fitting uploaded budget data", () => {
    seedWithData();
    useAppStore.setState({ analyzedByGroup: {} });
    const fit = vi.spyOn(ALLOC_MATH, "fitBest");
    renderOpen(<BudgetAllocation />);
    expect(fit).not.toHaveBeenCalled();
    act(() => useAppStore.getState().setGroupAnalyzed("5-3"));
    expect(fit).toHaveBeenCalled();
    expect(document.querySelector(".result-action-card")).toBeTruthy();
    const count = fit.mock.calls.length;
    const csv = useAppStore.getState().csvData;
    act(() => useAppStore.getState().setCsvData({ ...csv, raw: csv.raw.slice(1) }));
    expect(document.querySelector(".result-action-card")).toBeNull();
    expect(fit).toHaveBeenCalledTimes(count);
    fit.mockRestore();
  });

  it("mounts without throwing in the no-data state", () => {
    expect(() => renderOpen(<BudgetAllocation />)).not.toThrow();
    // Sanity: something rendered into the DOM.
    expect(document.body.querySelector("*")).toBeTruthy();
  });

  it("mounts without throwing with a valid seeded CSV", () => {
    seedWithData();
    expect(() => renderOpen(<BudgetAllocation />)).not.toThrow();
    expect(document.body.textContent.length).toBeGreaterThan(0);
  });

  it("connects planner settings, weekly normalization and grouping to the real result path", () => {
    seedWithData();
    const original = useAppStore.getState().csvData;
    const raw = original.raw.map((row, index) => {
      const weekStart = new Date(Date.UTC(2025, 10, 3 + Math.floor(index / 2) * 7)).toISOString().slice(0, 10);
      const rest = { ...row };
      delete rest.Date;
      return { ...rest, week_start: weekStart, snapshot_date: "2026-02-01" };
    });
    const mapping = { ...original.mapping };
    delete mapping.Date;
    act(() => {
      useAppStore.getState().setCurrentRouteId("5-3");
      useAppStore.getState().setCsvData({ raw, headers: Object.keys(raw[0]), mapping: { ...mapping, week_start: "date", snapshot_date: "snapshot_date" }, fileName: "weekly.csv" });
      useAppStore.getState().setGroupAnalyzed("5-3");
    });
    expect(useAppStore.getState().isGroupAnalyzed("5-3")).toBe(true);
    renderOpen(<BudgetAllocation />);
    fireEvent.click(screen.getByRole("button", { name: "자료·곡선 설정" }));
    fireEvent.change(screen.getByLabelText("자료 단위"), { target: { value: "weekly" } });
    fireEvent.change(screen.getByLabelText("추출 기준일"), { target: { value: "2026-02-01" } });
    fireEvent.change(screen.getByLabelText("분배 단위", { selector: "select" }), { target: { value: "channel" } });
    expect(screen.getByLabelText("자료 단위").value).toBe("weekly");
    expect(screen.getByLabelText("분배 단위", { selector: "select" }).value).toBe("channel");
    fireEvent.click(screen.getByRole("button", { name: "닫기", exact: true }));
    fireEvent.click(screen.getByRole("button", { name: "조건 바꾸기" }));
    expect(document.querySelector(".allocation-observation-note").textContent).toContain("주간 합계를 7일로");
    fireEvent.click(screen.getByRole("button", { name: "닫기", exact: true }));
    fireEvent.click(screen.getByRole("tab", { name: "예산 비교", exact: true }));
    expect(screen.getAllByRole("table", { name: "예산 실행안 비교" })).toHaveLength(1);
    expect(document.querySelector(".result-action-card")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "자료·곡선 설정" }));
    fireEvent.change(screen.getByLabelText("자료 단위"), { target: { value: "auto" } });
    fireEvent.change(screen.getByLabelText("분배 단위", { selector: "select" }), { target: { value: "os" } });
    fireEvent.change(screen.getByLabelText("추출 기준일"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "닫기", exact: true }));
  });

  it("places the conclusion before the scatter plot (결과-먼저 착지)", () => {
    seedWithData();
    renderOpen(<BudgetAllocation />);
    // 결론 뒤의 곡선 탭에서 관측 근거를 확인한다.

    const resultCard = document.querySelector(".result-action-card");
    const scatter = document.getElementById("s-scatter");
    expect(resultCard).toBeTruthy();
    expect(scatter).toBeTruthy();
    expect(resultCard.compareDocumentPosition(scatter) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
  });

  it("switches result views without refitting or changing the allocation", () => {
    seedWithData();
    const fit = vi.spyOn(ALLOC_MATH, "fitBest");
    const { container } = renderOpen(<BudgetAllocation />);
    const figure = container.querySelector(".result-shift");
    const original = figure.textContent;
    const count = fit.mock.calls.length;
    expect(count).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("radio", { name: "전체 배분표", exact: true }));
    expect(document.getElementById("s-table").closest("[hidden]")).toBeNull();
    expect(figure.closest("[hidden]")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "확인", exact: true }));
    expect(container.querySelector(".planner-status").closest('[role="tabpanel"]').hidden).toBe(false);
    expect(container.querySelector(".alloc-total-card")).toBeNull();
    expect(container.querySelector(".prism-result-grid")).toBeNull();
    expect(figure.textContent).toBe(original);
    expect(fit).toHaveBeenCalledTimes(count);
    fit.mockRestore();
  });

  it("switches between the next-step plan and the target allocation on the same planner", () => {
    const csv = buildSampleJourney("ko");
    useAppStore.setState({
      currentRouteId: "5-3",
      csvGroups: { ...useAppStore.getState().csvGroups, efficiency: csv },
      csvData: csv,
    });
    useAppStore.getState().setGroupAnalyzed("5-3");
    renderOpen(<BudgetAllocation />);
    // 실행 방식은 "조건 바꾸기" 창에서 고르고, 바깥 요약 한 줄이 지금 방식을 말한다.
    expect(document.querySelector(".alloc-condition__summary").textContent).toContain("이번 실행안");
    fireEvent.click(screen.getByRole("button", { name: "조건 바꾸기" }));
    const buttons = [...document.querySelectorAll(".alloc-mode-toggle button")];
    expect(buttons.map((button) => button.textContent)).toEqual(["이번 실행안", "목표 배분"]);
    expect(buttons[0].getAttribute("aria-pressed")).toBe("true");
    expect(document.body.textContent).toContain("하루 증액 20%·감액 30% 안에서만");
    act(() => buttons[1].click());
    expect(buttons[1].getAttribute("aria-pressed")).toBe("true");
    expect(document.body.textContent).toContain("단계적으로 다가가세요");
    // 결과 작업대와 같은 핵심 그림(지금 하루 예산 ↔ 바꾼 안)이 결론 카드 바로 뒤에 온다.
    const figure = document.querySelector(".tool-core-figure .result-shift");
    expect(figure, "도구 화면에 핵심 그림이 없다").toBeTruthy();
    expect(figure.querySelectorAll("li").length).toBeGreaterThan(1);
    expect(document.querySelector(".result-action-card").compareDocumentPosition(figure) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
  });
});
