// @vitest-environment jsdom
//
// Render-smoke for LandingPage. Regression net for a render/mount-effect throw.
// LandingPage is the public Decision Console home. It reads no CSV rows, but we
// seed no-data + with-data states to guarantee the public shell mounts either way.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import LandingPage from "@/components/LandingPage";

const EMPTY_CSV = { raw: [], headers: [], mapping: {}, fileName: "" };

function seedNoData() {
  useAppStore.setState({
    currentRouteId: "home",
    csvGroups: { ...useAppStore.getState().csvGroups, efficiency: EMPTY_CSV },
    csvData: EMPTY_CSV,
  });
}

function seedWithData() {
  const headers = ["Date", "Country", "Platform", "Channel", "Spend", "Installs"];
  const mapping = { Date: "date", Country: "country", Platform: "platform", Channel: "channel", Spend: "cost", Installs: "installs" };
  const raw = [];
  for (let d = 1; d <= 10; d++) for (const ch of ["Google", "Meta"]) {
    const cost = ch === "Google" ? 100000 + d * 3000 : 80000 + d * 2500;
    raw.push({ Date: `2026-01-${String(d).padStart(2, "0")}`, Country: "KR", Platform: "iOS", Channel: ch, Spend: cost, Installs: Math.round(cost / (ch === "Google" ? 5000 : 4200)) });
  }
  const slice = { raw, headers, mapping, fileName: "x.csv" };
  useAppStore.setState({ currentRouteId: "home", csvGroups: { ...useAppStore.getState().csvGroups, efficiency: slice }, csvData: slice });
}

describe("LandingPage render smoke", () => {
  beforeEach(() => seedNoData());
  it("no-data mounts", () => {
    expect(() => render(<LandingPage />)).not.toThrow();
    expect(document.querySelector(".dc-hero")).toBeTruthy();
    expect(document.querySelector(".dc-instrument")).toBeTruthy();
    const actions = [...document.querySelectorAll(".dc-action-route")];
    expect(actions).toHaveLength(3);
    expect(actions.map((action) => action.querySelector("strong")?.textContent)).toEqual(["내 데이터 분석", "지표 계산", "문제 진단"]);
    expect(document.querySelectorAll(".dc-action-route small")).toHaveLength(0);
    expect(document.querySelector("#dc-hero-title")?.textContent).toBe("성과를 보고,다음 행동을 정하세요.");
    expect(document.querySelector(".dc-hero__copy > p")?.textContent).toBe("분석·계산·진단 중 필요한 작업을 바로 시작하세요.");
    expect(document.querySelector('a.dc-action-route[href="/start"]')).toBeTruthy();
    expect(document.querySelector('a.dc-action-route[href="/calculator"]')).toBeTruthy();
    expect(document.querySelector('a.dc-action-route[href="/diagnose"]')).toBeTruthy();
    expect(document.querySelectorAll(".dc-loop-card")).toHaveLength(3);
    expect(document.querySelectorAll("a.dc-loop-card")).toHaveLength(3);
    expect(document.querySelector('a.dc-loop-card[href="/dashboard"]')).toBeTruthy();
    expect(document.querySelector('a.dc-loop-card[href="/weekly-review"]')).toBeTruthy();
    expect(document.body.textContent).toContain("다음 주 결과 검토");
    expect(document.body.textContent).toContain("예시 데이터로 둘러보기");
    expect(document.querySelectorAll(".dc-question-card")).toHaveLength(3);
    expect(document.querySelectorAll(".connected-tool-card")).toHaveLength(10);
    expect(document.querySelector('a[href="https://blog.naver.com/growthoptplaybook"]')).toBeTruthy();
  });
  it("with-data mounts", () => {
    seedWithData();
    expect(() => render(<LandingPage />)).not.toThrow();
    expect(document.querySelectorAll(".dc-library-card")).toHaveLength(2);
    expect(document.querySelector(".dc-resource-strip")).toBeTruthy();
  });
  it("tracks a landing sample and replaces any existing dataset with the explicit example", () => {
    seedWithData();
    window.gtag = vi.fn();
    const { container } = render(<LandingPage />);
    fireEvent.click(container.querySelector(".dc-hero__utility-actions button"));
    expect(useAppStore.getState().csvGroups.efficiency.fileName).toMatch(/^demo_/);
    expect(window.gtag).toHaveBeenCalledWith("event", "example_run_started", {
      tool_id: "5-2",
      source: "landing",
      placement: "hero",
      locale: "ko",
    });
    delete window.gtag;
  });
  it("renders the same connected workflow in English", () => {
    const { container } = render(<LandingPage locale="en" />);
    expect([...container.querySelectorAll(".dc-action-route strong")].map((node) => node.textContent)).toEqual(["Analyze my data", "Calculate metrics", "Diagnose a problem"]);
    expect(container.querySelector("#dc-hero-title")?.textContent).toBe("Read performance.Choose the next move.");
    expect(container.querySelectorAll(".connected-tool-card")).toHaveLength(10);
    expect(container.textContent).toContain("Move from one analysis to the next decision");
    expect(container.querySelector('a.dc-action-route[href="/en/start"]')).toBeTruthy();
    expect(container.querySelector('a.dc-action-route[href="/en/calculator"]')).toBeTruthy();
    expect(container.querySelector('a.dc-action-route[href="/en/diagnose"]')).toBeTruthy();
    expect(container.querySelector('a.dc-loop-card[href="/en/weekly-review"]')).toBeTruthy();
    expect(container.textContent).toContain("Review the actual next week");
    expect(container.querySelector('a[href="/en/tools/campaign-variance"]')).toBeTruthy();
    expect(container.textContent).toContain("Explore example data");
  });
});
