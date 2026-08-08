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

function clickWithoutNavigation(element) {
  element.addEventListener("click", (event) => event.preventDefault(), { once: true });
  fireEvent.click(element);
}

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
    expect(actions.map((action) => action.querySelector("strong")?.textContent)).toEqual(["내 CSV로 분석", "빠른 계산", "성과 원인 찾기"]);
    expect(actions[0].classList.contains("dc-action-route--primary")).toBe(true);
    expect(actions.slice(1).every((action) => !action.classList.contains("dc-action-route--primary"))).toBe(true);
    expect(document.querySelectorAll(".dc-action-route small")).toHaveLength(0);
    expect(document.querySelector("#dc-hero-title")?.textContent).toBe("성과 원인을 찾고,다음 하나를 정하세요.");
    expect(document.querySelector(".dc-hero__deck")?.textContent).toContain("무료 도구 모음");
    expect([...document.querySelectorAll(".dc-hero__trust li")].map((item) => item.textContent)).toEqual(["무료", "가입 없음", "브라우저에서만 처리"]);
    expect(document.querySelector('a.dc-action-route[href="/start"]')).toBeTruthy();
    expect(document.querySelector('a.dc-action-route[href="/calculator"]')).toBeTruthy();
    expect(document.querySelector('a.dc-action-route[href="/diagnose"]')).toBeTruthy();
    expect(document.querySelector(".dc-hero__utility-actions button")?.textContent).toContain("예시 데이터로 30초 체험");
    expect(document.querySelectorAll(".dc-loop-card")).toHaveLength(3);
    expect(document.querySelectorAll("a.dc-loop-card")).toHaveLength(3);
    expect(document.querySelector('a.dc-loop-card[href="/dashboard"]')).toBeTruthy();
    expect(document.querySelector('a.dc-loop-card[href="/weekly-review"]')).toBeTruthy();
    expect(document.body.textContent).toContain("다음 주 결과 검토");
    expect(document.querySelectorAll(".dc-question-card")).toHaveLength(4);
    expect(document.querySelectorAll("a.dc-question-card")).toHaveLength(4);
    expect([...document.querySelectorAll("a.dc-question-card")].map((link) => link.getAttribute("href"))).toEqual([
      "/dashboard",
      "/tools/budget-allocation",
      "/content/freshness",
      "/tools/brand-campaign-incrementality",
    ]);
    expect(document.querySelectorAll(".connected-tool-card")).toHaveLength(13);
    expect(document.querySelector('a[href="https://blog.naver.com/growthoptplaybook"]')).toBeTruthy();
  });
  it("with-data mounts", () => {
    seedWithData();
    expect(() => render(<LandingPage />)).not.toThrow();
    expect(document.querySelectorAll(".dc-library-card")).toHaveLength(2);
    expect(document.querySelector(".dc-resource-strip")).toBeTruthy();
  });
  it("tracks the explicitly labelled decision example and replaces the current dataset", () => {
    seedWithData();
    window.gtag = vi.fn();
    const { container } = render(<LandingPage />);
    fireEvent.click(container.querySelector(".dc-instrument__actions button"));
    expect(useAppStore.getState().csvGroups.efficiency.fileName).toMatch(/^demo_/);
    expect(window.gtag).toHaveBeenCalledWith("event", "example_run_started", {
      tool_id: "5-2",
      source: "landing",
      placement: "decision_instrument",
      locale: "ko",
    });
    delete window.gtag;
  });
  it("starts the clearly labeled hero example without requiring a CSV", () => {
    window.gtag = vi.fn();
    const { container } = render(<LandingPage />);
    fireEvent.click(container.querySelector(".dc-hero__utility-actions button"));
    expect(useAppStore.getState().csvGroups.efficiency.fileName).toMatch(/^demo_/);
    expect(window.gtag).toHaveBeenCalledWith("event", "example_run_started", {
      tool_id: "5-2",
      source: "landing",
      placement: "hero_example",
      locale: "ko",
    });
    delete window.gtag;
  });
  it("opens question-specific tools without replacing the user's dataset with a demo", () => {
    seedWithData();
    window.gtag = vi.fn();
    const { container } = render(<LandingPage />);
    for (const link of container.querySelectorAll("a.dc-question-card")) clickWithoutNavigation(link);
    expect(useAppStore.getState().csvGroups.efficiency.fileName).toBe("x.csv");
    expect(window.gtag).toHaveBeenCalledWith("event", "landing_tool_pick", {
      tool_id: "5-2",
      source: "landing",
      placement: "question_card",
      locale: "ko",
    });
    expect(window.gtag).not.toHaveBeenCalledWith("event", "example_run_started", expect.anything());
    delete window.gtag;
  });
  it("tracks each hero action without attaching CSV values", () => {
    window.gtag = vi.fn();
    const { container } = render(<LandingPage />);
    clickWithoutNavigation(container.querySelector('a.dc-action-route[href="/start"]'));
    clickWithoutNavigation(container.querySelector('a.dc-action-route[href="/calculator"]'));
    clickWithoutNavigation(container.querySelector('a.dc-action-route[href="/diagnose"]'));
    expect(window.gtag).toHaveBeenCalledWith("event", "landing_data_start_clicked", {
      source: "landing",
      placement: "hero",
      locale: "ko",
    });
    expect(window.gtag).toHaveBeenCalledWith("event", "calculator_entry_clicked", {
      source: "landing",
      placement: "hero",
      locale: "ko",
    });
    expect(window.gtag).toHaveBeenCalledWith("event", "diagnose_entry_clicked", {
      source: "landing",
      placement: "hero",
      locale: "ko",
    });
    delete window.gtag;
  });
  it("renders the same connected workflow in English", () => {
    const { container } = render(<LandingPage locale="en" />);
    expect([...container.querySelectorAll(".dc-action-route strong")].map((node) => node.textContent)).toEqual(["Analyze my CSV", "Quick calculations", "Find the cause"]);
    expect(container.querySelector("#dc-hero-title")?.textContent).toBe("Find the cause.Choose one next move.");
    expect(container.querySelectorAll(".connected-tool-card")).toHaveLength(13);
    expect(container.textContent).toContain("Move from one analysis to the next decision");
    expect(container.querySelector('a.dc-action-route[href="/en/start"]')).toBeTruthy();
    expect(container.querySelector('a.dc-action-route[href="/en/calculator"]')).toBeTruthy();
    expect(container.querySelector('a.dc-action-route[href="/en/diagnose"]')).toBeTruthy();
    expect(container.querySelector('a.dc-loop-card[href="/en/weekly-review"]')).toBeTruthy();
    expect(container.textContent).toContain("Review the actual next week");
    expect(container.querySelector('a[href="/en/tools/campaign-variance"]')).toBeTruthy();
    expect([...container.querySelectorAll("a.dc-question-card")].map((link) => link.getAttribute("href"))).toEqual([
      "/en/dashboard",
      "/en/tools/budget-allocation",
      "/en/content/freshness",
      "/en/tools/brand-campaign-incrementality",
    ]);
    expect(container.textContent).toContain("Try example data in 30 seconds");
  });
});
