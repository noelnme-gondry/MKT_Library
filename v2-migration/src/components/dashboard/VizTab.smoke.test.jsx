// @vitest-environment jsdom
//
// Render-smoke for VizTab (5-2 운영 대시보드 · 시각화 탭). Golden tests
// (src/utils/*.test.js) cover the pure aggregation math; this asserts the tab
// MOUNTS + runs its Chart effect without throwing in the no-data and with-data
// states. Mocks (chart.js/auto, next/navigation) + ResizeObserver/matchMedia/
// canvas live in vitest.smoke.setup.js (auto-loaded by the smoke project).
import { describe, it, expect, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import VizTab from "@/components/dashboard/VizTab";

const EMPTY_CSV = { raw: [], headers: [], mapping: {}, fileName: "" };

// Minimal VALID efficiency CSV for the dashboard: date/country/platform/channel
// dims + the metric columns the viz charts read (cost/installs/clicks/impressions
// + cohort revenue). mapping = { originalHeader: standardKey } (getMappedRows).
function seedWithData() {
  const headers = ["Date", "Country", "Platform", "Channel", "Spend", "Installs", "Clicks", "Impr", "RevD7"];
  const mapping = {
    Date: "date", Country: "country", Platform: "platform", Channel: "channel",
    Spend: "cost", Installs: "installs", Clicks: "clicks", Impr: "impressions", RevD7: "revenue_d7",
  };
  const raw = [];
  for (let d = 1; d <= 10; d++) {
    const date = `2026-01-${String(d).padStart(2, "0")}`;
    for (const ch of ["Google", "Meta"]) {
      // deterministic — NO Math.random (harness §8)
      const cost = ch === "Google" ? 100000 + d * 3000 : 80000 + d * 2500;
      const installs = Math.round(cost / (ch === "Google" ? 5000 : 4200));
      raw.push({
        Date: date, Country: "KR", Platform: "iOS", Channel: ch,
        Spend: cost, Installs: installs, Clicks: installs * 8, Impr: installs * 120, RevD7: installs * 900,
      });
    }
  }
  const slice = { raw, headers, mapping, fileName: "viz.csv" };
  useAppStore.setState({
    currentRouteId: "5-2",
    csvGroups: { ...useAppStore.getState().csvGroups, efficiency: slice },
    csvData: slice,
  });
}

function seedNoData() {
  useAppStore.setState({
    currentRouteId: "5-2",
    csvGroups: { ...useAppStore.getState().csvGroups, efficiency: EMPTY_CSV },
    csvData: EMPTY_CSV,
    customCharts: {},
  });
}

describe("VizTab render smoke", () => {
  beforeEach(() => seedNoData());

  it("mounts without throwing in the no-data state", () => {
    expect(() => render(<VizTab />)).not.toThrow();
    // Sanity: the tab shell rendered.
    expect(document.getElementById("tab-viz")).toBeTruthy();
  });

  it("mounts without throwing with a valid seeded CSV", () => {
    seedWithData();
    expect(() => render(<VizTab />)).not.toThrow();
    expect(document.getElementById("tab-viz")).toBeTruthy();
  });

  it("connects a KPI card to the single explorer chart without inventing retention data", () => {
    seedWithData();
    const { container } = render(<VizTab />);
    const workbench = container.querySelector(".dashboard-viz-workbench");
    expect(workbench).toBeTruthy();
    expect(workbench?.querySelector("#s-kpi")).toBeTruthy();
    expect(workbench?.querySelector("#s-charts")).toBeTruthy();
    expect(workbench?.querySelector(".ix")).toBeNull();
    expect(screen.getByText("리텐션 데이터 필요")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /CPI/i }));
    expect(screen.getByText("CPI 추이")).toBeTruthy();
    expect(screen.getByText("PVM으로 원인 보기")).toBeTruthy();
    expect(screen.getByRole("img", { name: "CPI 추이 차트" })).toBeTruthy();
  });

  it("keeps cohort calculation context in an on-demand help icon", () => {
    seedWithData();
    const { container } = render(<VizTab />);
    expect(container.querySelector("#s-cohort")?.classList.contains("dashboard-cohort-control")).toBe(true);
    expect(container.querySelector("#s-cohort")?.classList.contains("block")).toBe(false);
    const help = container.querySelector(".cohort-help");
    expect(help?.getAttribute("title")).toContain("매출/결제/잔존율");
    expect(screen.queryByText(/단일 지표\(CPI\/CTR\/CVR/)).toBeNull();
  });

  it("keeps the dashboard visualization surface free of Korean UI copy in English", () => {
    seedWithData();
    render(<VizTab locale="en" />);
    const koreanCopy = Array.from(new Set(document.body.textContent.match(/[가-힣]+/g) || []));
    expect(koreanCopy, koreanCopy.join(", ")).toEqual([]);
    expect(screen.getByText("Total Cost trend")).toBeTruthy();
  });

  it("keeps the ready-made charts and renders a custom scorecard", () => {
    seedWithData();
    useAppStore.setState({
      customCharts: {
        "5-2:viz-charts": [{ id: "score-1", name: "현재 비용", type: "scorecard", dim: "", metric: "cost" }],
      },
    });
    render(<VizTab />);
    expect(screen.getByText("일별 비용·설치 추이")).toBeTruthy();
    expect(screen.getByText("현재 비용")).toBeTruthy();
    expect(screen.getByText("현재 필터 기준 전체값")).toBeTruthy();
  });

  // #11 이벤트 마커 — store.eventMarkers 시딩이 시계열 차트(makeEventMarkerPlugin)
  // 재생성 경로를 죽이지 않는지(destroy+recreate+draw 전부 무해) 확인.
  it("mounts without throwing when an event marker is seeded", () => {
    seedWithData();
    useAppStore.setState({
      eventMarkers: [{ id: "m1", date: "2026-01-05", label: "테스트 마커" }],
    });
    expect(() => render(<VizTab />)).not.toThrow();
    expect(document.getElementById("tab-viz")).toBeTruthy();
  });
});
