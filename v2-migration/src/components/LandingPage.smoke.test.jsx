// @vitest-environment jsdom
//
// Render-smoke for LandingPage. Regression net for a render/mount-effect throw.
// LandingPage is the public Decision Console home. It reads no CSV rows, but we
// seed no-data + with-data states to guarantee the public shell mounts either way.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import LandingPage from "@/components/LandingPage";
import { PUBLISHED_TOOL_IDS } from "@/lib/toolIndex";

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
    decisionRecords: [],
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
  beforeEach(() => { window.sessionStorage.clear(); seedNoData(); });
  it("no-data mounts", () => {
    expect(() => render(<LandingPage />)).not.toThrow();
    expect(document.querySelector(".dc-hero")).toBeTruthy();
    // 히어로 우측의 예시 판단 카드(가짜 수치 + 장식 차트)는 제거됨 — 되살리지 말 것.
    expect(document.querySelector(".dc-instrument")).toBeNull();
    expect(document.querySelector(".dc-mini-chart")).toBeNull();
    const actions = [...document.querySelectorAll(".dc-action-route")];
    expect(actions).toHaveLength(2);
    expect(actions.map((action) => action.querySelector("strong")?.textContent)).toEqual(["질문에서 시작하기", "CSV로 가능한 분석 한 번에"]);
    expect(actions[0].getAttribute("href")).toBe("/diagnose");
    expect(actions[1].getAttribute("href")).toBe("#dochi-upload");
    expect(document.querySelectorAll(".dc-action-route small")).toHaveLength(0);
    expect(document.querySelector("#dc-hero-title")?.textContent).toBe("성과는 왜 바뀌었고,다음엔 뭘 해야 할까?");
    expect(document.querySelector(".dc-hero__deck")?.textContent).toContain("실무 가이드로 기준을 잡고");
    // 구 trustBadges + privacy 두 줄이 같은 내용을 반복하던 것을 한 줄로 통합.
    expect(document.querySelectorAll(".dc-hero__trust")).toHaveLength(0);
    expect(document.querySelector(".dc-hero__assurance")?.textContent).toBe("분석 무료 · 보고서 다운로드는 이용권 구매 후 · 원본은 브라우저에서만 처리");
    expect(document.querySelector('a.dc-action-route[href="#dochi-upload"]')).toBeTruthy();
    expect(document.querySelector('a.dc-text-link[href="/calculator"]')).toBeTruthy();
    expect(document.querySelector('a.dc-text-link[href="/diagnose"]')).toBeTruthy();
    expect(document.querySelector(".home-result-preview button")?.textContent).toContain("샘플로 체험하기");
    expect(document.querySelector('.dc-loop a[href="/weekly-review"]')).toBeTruthy();
    expect(document.querySelectorAll(".home-tool-finder__purposes button")).toHaveLength(7);
    expect(document.querySelectorAll(".dc-questions .tool-index__link")).toHaveLength(0);
    fireEvent.click(document.querySelector(".home-tool-finder > button"));
    expect(document.querySelectorAll(".dc-questions .tool-index__link")).toHaveLength(PUBLISHED_TOOL_IDS.length);
    // 연결 워크플로 섹션은 인덱스와 같은 갈래·같은 도구를 카드로 또 그려서 제거했다.
    expect(document.querySelector(".connected-tool-card")).toBeNull();
    // 소셜 채널을 사이드바에서 뺀 뒤로 랜딩의 자료·채널 줄이 유일한 도달 경로다
    // — 여기서 사라지면 채널이 사이트에서 고아가 된다(§12.29 인바운드 링크).
    for (const host of ["youtube.com", "instagram.com", "facebook.com", "blog.naver.com"]) {
      expect(document.querySelector(`.dc-resource-strip a[href*="${host}"]`)).toBeTruthy();
    }
  });
  it("puts the question cards ahead of the weekly-loop explainer", () => {
    render(<LandingPage />);
    const questions = document.querySelector(".dc-questions");
    const loop = document.querySelector(".dc-loop");
    // 목적 선택이 개념 설명보다 먼저 와야 첫 화면에서 바로 도구를 찾는다.
    expect(questions.compareDocumentPosition(loop) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
  it("with-data mounts", () => {
    seedWithData();
    expect(() => render(<LandingPage />)).not.toThrow();
    expect(document.querySelectorAll(".dc-library-card")).toHaveLength(2);
    expect(document.querySelector(".dc-resource-strip")).toBeTruthy();
  });
  it("shows a local-only continue panel for saved decisions", () => {
    const today = new Date().toISOString().slice(0, 10);
    useAppStore.setState({ decisionRecords: [{
      id: "decision-home",
      toolId: "5-3",
      action: "검색 예산을 10% 줄이고 7일 뒤 CPA를 본다",
      conclusion: "한계 효율이 낮습니다",
      reviewDate: today,
      status: "pending",
    }] });
    window.gtag = vi.fn();
    const { container } = render(<LandingPage><div data-testid="intake-slot" /></LandingPage>);
    const intake = container.querySelector('[data-testid="intake-slot"]');
    expect(container.querySelector(".dc-hero").compareDocumentPosition(intake) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(intake.compareDocumentPosition(container.querySelector(".dc-questions")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.querySelector(".dc-return").compareDocumentPosition(container.querySelector(".dc-hero")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.querySelector('.dc-return a[href="/projects"]')).toBeTruthy();
    expect(container.querySelector(".dc-return__status strong")?.textContent).toBe("1");
    expect(container.textContent).toContain("검색 예산을 10% 줄이고");
    const reopen = container.querySelector('a[href="/tools/budget-allocation"]');
    clickWithoutNavigation(reopen);
    expect(window.gtag).toHaveBeenCalledWith("event", "landing_continue_tool_clicked", {
      tool_id: "5-3",
      source: "landing",
      placement: "continue_panel",
      locale: "ko",
    });
    delete window.gtag;
  });
  it("starts the clearly labeled hero example without requiring a CSV", () => {
    window.gtag = vi.fn();
    const { container } = render(<LandingPage />);
    fireEvent.click(container.querySelector(".home-result-preview button"));
    expect(useAppStore.getState().csvGroups.efficiency.fileName).toMatch(/^demo_/);
    // Navigation mounts the result route, which selects the shared CSV slice.
    useAppStore.getState().setCurrentRouteId("dochi-result");
    expect(useAppStore.getState().csvData.fileName).toMatch(/^demo_/);
    expect(useAppStore.getState().isGroupAnalyzed("dochi-result")).toBe(false);
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
    fireEvent.click(container.querySelector(".home-tool-finder > button"));
    for (const link of container.querySelectorAll(".dc-questions .tool-index__link")) clickWithoutNavigation(link);
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
    clickWithoutNavigation(container.querySelector('a.dc-action-route[href="#dochi-upload"]'));
    clickWithoutNavigation(container.querySelector('a.dc-text-link[href="/calculator"]'));
    clickWithoutNavigation(container.querySelector('a.dc-text-link[href="/diagnose"]'));
    expect(window.gtag).toHaveBeenCalledWith("event", "landing_data_start_clicked", {
      journey_entry: "home",
      source: "landing",
      placement: "hero",
      locale: "ko",
    });
    expect(window.gtag).toHaveBeenCalledWith("event", "calculator_entry_clicked", {
      journey_entry: "home",
      source: "landing",
      placement: "hero",
      locale: "ko",
    });
    expect(window.gtag).toHaveBeenCalledWith("event", "diagnose_entry_clicked", {
      journey_entry: "home",
      source: "landing",
      placement: "hero",
      locale: "ko",
    });
    delete window.gtag;
  });
  // 첫 분석과 반복 검토를 구분하되 가장 강한 시작 버튼은 하나로 유지한다.
  it("keeps exactly one primary action in the hero", () => {
    for (const locale of ["ko", "en"]) {
      const { container, unmount } = render(<LandingPage locale={locale} />);
      const hero = container.querySelector(".dc-hero__actions");
      const prefix = locale === "en" ? "/en" : "";
      expect(container.querySelector(`.dc-hero a[href="${prefix}/blog"]`)).toBeTruthy();
      expect(container.querySelector(`.dc-hero a[href="${prefix}/guide"]`)).toBeTruthy();
      expect(hero, `${locale}: 히어로 행동 영역이 없다`).toBeTruthy();
      const routes = hero.querySelectorAll(".dc-action-route");
      const primary = hero.querySelectorAll(".dc-action-route--primary");
      expect(primary.length, `${locale}: primary는 정확히 하나여야 한다`).toBe(1);
      expect(routes.length, `${locale}: CSV와 질문의 진입점`).toBe(2);
      // 보조 진입점(예시 보기·데이터 가이드)은 버튼이 아니라 텍스트 링크로 남는다.
      expect(container.querySelectorAll(".dc-hero__utility-actions .dc-text-link").length).toBeGreaterThan(0);
      expect(container.querySelectorAll(".dc-hero__utility-actions .dc-action-route").length).toBe(0);
      unmount();
    }
  });
  it("renders the same index and hero in English", () => {
    const { container } = render(<LandingPage locale="en" />);
    expect([...container.querySelectorAll(".dc-action-route strong")].map((node) => node.textContent)).toEqual(["Start with a question", "Find analyses for my CSV"]);
    expect(container.querySelector("#dc-hero-title")?.textContent).toBe("Why did it change?What should you do next?");
    expect(container.querySelector('a.dc-action-route[href="#dochi-upload"]')).toBeTruthy();
    expect(container.querySelector('a.dc-text-link[href="/en/calculator"]')).toBeTruthy();
    expect(container.querySelector('a.dc-text-link[href="/en/diagnose"]')).toBeTruthy();
    expect(container.querySelector('.dc-loop a[href="/en/weekly-review"]')).toBeTruthy();
    expect(container.textContent).toContain("This week’s analysis. Next week’s decisions.");
    // EN도 같은 인덱스를 쓴다 — 링크가 전부 /en 접두를 갖는지만 본다.
    fireEvent.click(container.querySelector(".home-tool-finder > button"));
    const enLinks = [...container.querySelectorAll(".dc-questions .tool-index__link")];
    expect(enLinks).toHaveLength(PUBLISHED_TOOL_IDS.length);
    expect(enLinks.every((link) => link.getAttribute("href").startsWith("/en/"))).toBe(true);
    expect(container.textContent).toContain("Explore a sample");
  });

  it("도구 목록이 첫 화면 슬롯에 온다 — 아래로 밀리면 없는 것과 같다", () => {
    render(<LandingPage />);
    const questions = document.querySelector(".dc-questions");
    const loop = document.querySelector(".dc-loop");
    // 히어로 바로 다음 블록이어야 하고, 루프 설명보다 앞이어야 한다.
    expect(questions.querySelectorAll(".home-tool-finder__purposes button")).toHaveLength(7);
    expect(questions.compareDocumentPosition(loop) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // 별도 카탈로그 섹션은 흡수됐다 — 같은 목록을 두 번 그리지 않는다.
    expect(document.querySelector(".dc-catalog")).toBeNull();
  });
  it.each(["ko", "en"])("opens intake on demand and covers all tools through purposes (%s)", (locale) => {
    const { container } = render(<LandingPage locale={locale}><section id="dochi-upload" tabIndex={-1}><input aria-label="file" /></section></LandingPage>);
    const intake = container.querySelector(".dc-intake");
    expect(intake.open).toBe(false);
    clickWithoutNavigation(container.querySelector('.dc-action-route--primary'));
    expect(intake.open).toBe(true);
    const found = new Set();
    for (const button of container.querySelectorAll(".home-tool-finder__purposes button")) {
      fireEvent.click(button);
      expect(button.getAttribute("aria-expanded")).toBe("true");
      const links = container.querySelectorAll(".home-tool-finder__results a");
      expect(links.length).toBeGreaterThan(0);
      for (const link of links) {
        expect(found.has(link.getAttribute("href"))).toBe(false);
        found.add(link.getAttribute("href"));
      }
    }
    expect(found.size).toBe(PUBLISHED_TOOL_IDS.length);
    fireEvent.click(container.querySelector(".home-tool-finder > button"));
    expect(new Set([...container.querySelectorAll(".home-tool-finder__results a")].map(a => a.getAttribute("href")))).toEqual(found);
  });

  it.each(["ko", "en"])("keeps question entry reachable without replacing uploaded data (%s)", (locale) => {
    seedWithData();
    const source = useAppStore.getState().csvData;
    const { container } = render(<LandingPage locale={locale} />);
    const questionLink = container.querySelector(".dc-action-route--question");
    expect(questionLink.closest(".dc-hero__actions")).toBeTruthy();
    clickWithoutNavigation(questionLink);
    expect(questionLink.getAttribute("href")).toBe(`${locale === "en" ? "/en" : ""}/diagnose`);
    expect(useAppStore.getState().csvData).toBe(source);
    expect(container.querySelector(`a[href="${locale === "en" ? "/en" : ""}/subscription"]`)).toBeTruthy();
  });

});
