// @vitest-environment jsdom
//
// Render-smoke for Dashboard (5-2). Regression net for a render/mount-effect
// throw. Dashboard reads csvData + dashboardTab: with no data it shows the
// uploader; with data it mounts the filter bar, tabs, and the ACTIVE tab child
// (VizTab/ScorecardTab/…). We mount each of the 8 tabs on a valid efficiency CSV
// so a throw in any tab surfaces here. mapping = { originalHeader: standardKey }.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import Dashboard from "@/components/Dashboard";
import { buildDemoCsv } from "@/utils/demoData";

const EMPTY_CSV = { raw: [], headers: [], mapping: {}, fileName: "" };

function seedNoData() {
  useAppStore.setState({
    currentRouteId: "5-2",
    dashboardTab: "viz",
    csvGroups: { ...useAppStore.getState().csvGroups, efficiency: EMPTY_CSV },
    csvData: EMPTY_CSV,
    dashboardFilter: { dateStart: null, dateEnd: null, platforms: new Set(), countries: new Set(), channels: new Set(), sources: new Set() },
    dashWindowDays: 7,
    analyzedByGroup: { ...useAppStore.getState().analyzedByGroup, efficiency: null },
    decisionRecords: [],
  });
}

// Valid efficiency CSV: date + funnel metrics + revenue/retention so LTV/cohort/
// funnel tabs have inputs. Deterministic (NO Math.random — harness §8).
function seedWithData() {
  const headers = [
    "Date", "Country", "Platform", "Channel", "Spend",
    "Impressions", "Clicks", "Installs", "Actions",
    "Revenue_d0", "Revenue_d7", "Cohort_size", "Ret_d0", "Ret_d7",
  ];
  const mapping = {
    Date: "date", Country: "country", Platform: "platform", Channel: "channel", Spend: "cost",
    Impressions: "impressions", Clicks: "clicks", Installs: "installs", Actions: "actions",
    Revenue_d0: "revenue_d0", Revenue_d7: "revenue_d7",
    Cohort_size: "cohort_size", Ret_d0: "ret_d0", Ret_d7: "ret_d7",
  };
  const raw = [];
  for (let d = 1; d <= 14; d++) for (const ch of ["Google", "Meta"]) {
    const cost = ch === "Google" ? 100000 + d * 3000 : 80000 + d * 2500;
    const installs = Math.round(cost / (ch === "Google" ? 5000 : 4200));
    const actions = Math.round(installs * 0.6);
    raw.push({
      Date: `2026-01-${String(d).padStart(2, "0")}`,
      Country: "KR", Platform: "iOS", Channel: ch, Spend: cost,
      Impressions: installs * 200, Clicks: installs * 20, Installs: installs,
      Actions: actions,
      Revenue_d0: actions * 1200, Revenue_d7: actions * 2400,
      Cohort_size: installs, Ret_d0: installs, Ret_d7: Math.round(installs * 0.3),
    });
  }
  const slice = { raw, headers, mapping, fileName: "ops.csv" };
  useAppStore.setState({ currentRouteId: "5-2", csvGroups: { ...useAppStore.getState().csvGroups, efficiency: slice }, csvData: slice });
  // #4 analyze-gate: Dashboard now hides tabs until the group is analyzed.
  // Mark analyzed so smoke assertions reach the actual tab content.
  useAppStore.getState().setGroupAnalyzed("5-2");
}

const TABS = ["viz", "scorecard", "pacing", "anomaly", "ltv", "cohort", "funnel", "segment"];

describe("Dashboard render smoke", () => {
  beforeEach(() => {
    delete window.gtag;
    seedNoData();
  });

  it("no-data mounts and auto-loads demo (mapping grid, not dropzone)", () => {
    expect(() => render(<Dashboard />)).not.toThrow();
    expect(document.querySelector(".mapping-grid")).toBeTruthy();
    expect(document.querySelector(".csv-dropzone")).toBeFalsy();
    expect(document.querySelector("#dashboard-demo-source")).toBeTruthy();
    expect(document.querySelector(".decision-review")).toBeNull();
    expect(screen.queryByRole("button", { name: "검토 약속 만들기" })).toBeNull();
    expect(useAppStore.getState().decisionRecords).toHaveLength(0);
  });

  it("labels the single generic example honestly in KR/EN", () => {
    const demo = buildDemoCsv("efficiency", "ko");
    useAppStore.setState({
      currentRouteId: "5-2",
      csvGroups: { ...useAppStore.getState().csvGroups, efficiency: demo },
      csvData: demo,
    });
    useAppStore.getState().setGroupAnalyzed("5-2");
    const { unmount } = render(<Dashboard />);
    expect(screen.getByText("SAMPLE DATA")).toBeTruthy();
    expect(screen.getByText("지금 보는 수치는 예시입니다")).toBeTruthy();
    expect(screen.getByText("내 CSV로 바꾸기")).toBeTruthy();
    unmount();
    cleanup();

    const demoEn = buildDemoCsv("efficiency", "en");
    useAppStore.setState({
      currentRouteId: "5-2",
      csvGroups: { ...useAppStore.getState().csvGroups, efficiency: demoEn },
      csvData: demoEn,
    });
    useAppStore.getState().setGroupAnalyzed("5-2");
    render(<Dashboard locale="en" />);
    expect(screen.getByText("These numbers are an example")).toBeTruthy();
    expect(screen.getByText("Use my CSV")).toBeTruthy();
  });

  for (const tab of TABS) {
    it(`with-data mounts — ${tab} tab`, () => {
      seedWithData();
      useAppStore.setState({ dashboardTab: tab });
      expect(() => render(<Dashboard />)).not.toThrow();
      expect(document.querySelector(".dashboard-content")).toBeTruthy();
      expect(document.querySelector(".dashboard-tabs")?.closest(".page-sticky-bar")).toBeTruthy();
    });
  }

  it("puts the active data panel before collapsed analysis utilities", () => {
    seedWithData();
    const { container } = render(<Dashboard />);
    const dataPanel = container.querySelector("#dashboard-tabpanel");
    const utilities = container.querySelector(".dashboard-support-tools");
    expect(container.querySelector(".dashboard-next-actions__utility a")?.getAttribute("href")).toBe("#dashboard-tabpanel");
    expect(dataPanel).toBeTruthy();
    expect(utilities).toBeTruthy();
    expect(utilities.id).toBe("dashboard-support-tools");
    expect(dataPanel.compareDocumentPosition(utilities) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(utilities.hasAttribute("open")).toBe(false);
  });

  it("puts the conclusion before follow-up actions and supporting views", () => {
    seedWithData();
    const { container } = render(<Dashboard />);
    const conclusion = container.querySelector(".result-action-card");
    const actions = container.querySelector(".dashboard-next-actions");
    const supportingViews = container.querySelector(".dashboard-recommendations");
    expect(conclusion).toBeTruthy();
    expect(actions).toBeTruthy();
    expect(actions.hasAttribute("open")).toBe(false);
    expect(conclusion.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    if (supportingViews) {
      expect(actions.compareDocumentPosition(supportingViews) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it("uses one wide operator canvas without duplicate sticky KPIs or a static TOC", () => {
    seedWithData();
    const { container } = render(<Dashboard />);
    expect(container.querySelector(".dashboard-sticky-context__data")).toBeTruthy();
    expect(container.querySelector(".dashboard-top-stat")).toBeNull();
    expect(container.querySelector(".dashboard-shell__toc")).toBeNull();
    expect(container.querySelector(".dashboard-tabs__divider")).toBeNull();
    expect(container.querySelectorAll(".dashboard-tabs__items")).toHaveLength(3);
  });

  it("keeps analyzed mapping controls in a quiet disclosure", () => {
    seedWithData();
    const { container } = render(<Dashboard />);
    const disclosure = container.querySelector("#dashboard-data-setup.dashboard-data-disclosure");
    expect(disclosure).toBeTruthy();
    expect(disclosure?.classList.contains("block")).toBe(false);
    expect(disclosure?.hasAttribute("open")).toBe(false);
    expect(disclosure?.querySelector(".dashboard-data-disclosure__summary")).toBeTruthy();
  });

  it("prefills a conservative next review from the visible verdict", () => {
    seedWithData();
    render(<Dashboard />);
    expect(screen.getByLabelText("무엇을 바꿀까요?").value).not.toBe("");
    expect(screen.getByLabelText("검증 지표").value).not.toBe("");
  });

  it("offers one inline review promise without a duplicate save action", () => {
    seedWithData();
    const { container } = render(<Dashboard />);
    const reviews = container.querySelectorAll(".decision-review");
    const review = reviews[0];
    expect(reviews).toHaveLength(1);
    expect(review).toBeTruthy();
    expect(review.open).toBe(false);

    fireEvent.click(review.querySelector("summary"));

    expect(review.open).toBe(true);
    expect(useAppStore.getState().decisionRecords).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "결과 기록" })).toBeNull();
  });

  it("shows the dashboard-wide verdict only on the visualization tab", () => {
    seedWithData();
    useAppStore.setState({ dashboardTab: "seasonality" });
    const { container } = render(<Dashboard />);
    expect(container.querySelector(".result-action-card")).toBeNull();
    expect(container.querySelector(".seasonality-heading")).toBeTruthy();
  });

  it("tracks one ready completion even when analysis opens on a non-visualization tab", () => {
    window.gtag = vi.fn();
    seedWithData();
    useAppStore.setState({ dashboardTab: "scorecard" });
    const { container } = render(<Dashboard />);

    expect(container.querySelector(".result-action-card")).toBeNull();
    expect(window.gtag).toHaveBeenCalledWith("event", "analysis_completed", expect.objectContaining({
      tool_id: "5-2",
      source: "csv",
      analysis_type: "dashboard",
      result_state: "ready",
      locale: "ko",
    }));

    act(() => useAppStore.setState({
      dashboardFilter: { ...useAppStore.getState().dashboardFilter, channels: new Set(["Google"]) },
    }));
    expect(window.gtag.mock.calls.filter((call) => call[1] === "analysis_completed")).toHaveLength(2);

    act(() => useAppStore.setState({ dashboardTab: "viz" }));
    expect(window.gtag.mock.calls.filter((call) => call[1] === "analysis_completed")).toHaveLength(2);
  });

  it("with-data renders every tab in English without Korean UI copy", () => {
    for (const tab of TABS) {
      seedWithData();
      useAppStore.setState({ dashboardTab: tab });
      const { unmount } = render(<Dashboard locale="en" />);
      const text = document.body.textContent || "";
      const koreanCopy = Array.from(new Set(text.match(/[가-힣]+/g) || []));
      const contexts = koreanCopy.map((value) => {
        const index = text.indexOf(value);
        return text.slice(Math.max(0, index - 36), index + value.length + 48);
      });
      expect(koreanCopy, `${tab}: ${contexts.join(" | ")}`).toEqual([]);
      unmount();
      cleanup();
    }
  });
});
