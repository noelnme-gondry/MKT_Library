// @vitest-environment jsdom
//
// Render-smoke for ContentDashboard (9-7, content_dashboard group). Thin wrapper
// that renders <Dashboard domain="content" /> — same engine (dashboardAggregator /
// anomalyMath, golden-covered) as 5-2, content-domain labels (유입경로/방문/구독/
// 방문당 비용) and only 3 tabs (viz·scorecard·anomaly). Marketing-only tabs
// (pacing·ltv·cohort·funnel·segment) and revenue/purchase/retention cards are NOT
// rendered for content (§honesty — no fabricated 매출/ROAS). Asserts the wrapper
// mounts without throwing in no-data + with-data across all 3 content tabs, incl.
// the case where the shared dashboardTab is pre-set to an EXCLUDED tab (must reset
// to viz, not crash). Deterministic — NO Math.random (§8).
import { describe, it, expect, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import ContentDashboard from "@/components/tools/ContentDashboard";

const EMPTY_CSV = { raw: [], headers: [], mapping: {}, fileName: "" };

function seedNoData() {
  useAppStore.setState({
    currentRouteId: "9-7",
    dashboardTab: "viz",
    csvGroups: { ...useAppStore.getState().csvGroups, content_dashboard: EMPTY_CSV },
    csvData: EMPTY_CSV,
    decisionRecords: [],
  });
}

// Valid content CSV: date + traffic (visits→installs) + cost + clicks/impressions
// + subscribers (actions). NO revenue/pu/ret — content has none (honest empty).
// mapping = { originalHeader: standardKey }.
function seedWithData() {
  const headers = [
    "Date", "Source", "Device", "Category", "ContentID",
    "Cost", "Impressions", "Clicks", "Visits", "Subs",
  ];
  const mapping = {
    Date: "date", Source: "channel", Device: "platform",
    Category: "campaign_name", ContentID: "creative_id",
    Cost: "cost", Impressions: "impressions", Clicks: "clicks",
    Visits: "installs", Subs: "actions",
  };
  const raw = [];
  for (let d = 1; d <= 14; d++) for (const src of ["자연 검색", "소셜"]) {
    const cost = src === "자연 검색" ? 90000 + d * 2000 : 120000 + d * 2500;
    const visits = Math.round(cost / (src === "자연 검색" ? 60 : 110));
    const clicks = Math.round(visits * 1.5);
    raw.push({
      Date: `2026-01-${String(d).padStart(2, "0")}`,
      Source: src, Device: d % 2 === 0 ? "Mobile" : "Desktop",
      Category: "튜토리얼", ContentID: `post_${src}_${d}`,
      Cost: cost, Impressions: clicks * 25, Clicks: clicks,
      Visits: visits, Subs: Math.round(visits * 0.06),
    });
  }
  const slice = { raw, headers, mapping, fileName: "content_ops.csv" };
  useAppStore.setState({
    currentRouteId: "9-7",
    csvGroups: { ...useAppStore.getState().csvGroups, content_dashboard: slice },
    csvData: slice,
  });
  // #4 analyze-gate: mark analyzed so tab content renders.
  useAppStore.getState().setGroupAnalyzed("9-7");
}

const CONTENT_TABS = ["viz", "scorecard", "anomaly"];

describe("ContentDashboard render smoke", () => {
  beforeEach(() => seedNoData());

  it("no-data mounts and auto-loads content demo (mapping grid, not dropzone)", () => {
    expect(() => render(<ContentDashboard />)).not.toThrow();
    // Content-domain title present.
    expect(screen.getAllByText(/콘텐츠 운영 대시보드/).length).toBeGreaterThan(0);
  });

  for (const tab of CONTENT_TABS) {
    it(`with-data mounts — ${tab} tab`, () => {
      seedWithData();
      useAppStore.setState({ dashboardTab: tab });
      expect(() => render(<ContentDashboard />)).not.toThrow();
      expect(document.querySelector(".dashboard-content")).toBeTruthy();
    });
  }

  it("resets to viz when the shared dashboardTab is an excluded (marketing) tab", () => {
    seedWithData();
    // 5-2에서 넘어와 ltv로 설정돼 있어도 콘텐츠는 viz로 되돌리고 크래시 없이 렌더.
    useAppStore.setState({ dashboardTab: "ltv" });
    expect(() => render(<ContentDashboard />)).not.toThrow();
    expect(document.querySelector(".dashboard-content")).toBeTruthy();
  });

  it("stores a content-dashboard decision under the content tool id", () => {
    seedWithData();
    render(<ContentDashboard />);
    fireEvent.click(screen.getByText(/다음 검토 약속/));
    fireEvent.click(screen.getByRole("button", { name: "다음 검토로 저장" }));
    expect(useAppStore.getState().decisionRecords[0].toolId).toBe("9-7");
  });
});
