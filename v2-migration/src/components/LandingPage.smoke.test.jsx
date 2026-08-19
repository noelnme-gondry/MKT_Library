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
import { TOOL_JOURNEY } from "@/lib/toolConnections";

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
  beforeEach(() => seedNoData());
  it("no-data mounts", () => {
    expect(() => render(<LandingPage />)).not.toThrow();
    expect(document.querySelector(".dc-hero")).toBeTruthy();
    // 히어로 우측의 예시 판단 카드(가짜 수치 + 장식 차트)는 제거됨 — 되살리지 말 것.
    expect(document.querySelector(".dc-instrument")).toBeNull();
    expect(document.querySelector(".dc-mini-chart")).toBeNull();
    const actions = [...document.querySelectorAll(".dc-action-route")];
    expect(actions).toHaveLength(3);
    expect(actions.map((action) => action.querySelector("strong")?.textContent)).toEqual(["내 CSV로 분석", "빠른 계산", "성과 원인 찾기"]);
    expect(actions[0].classList.contains("dc-action-route--primary")).toBe(true);
    expect(actions.slice(1).every((action) => !action.classList.contains("dc-action-route--primary"))).toBe(true);
    expect(document.querySelectorAll(".dc-action-route small")).toHaveLength(0);
    expect(document.querySelector("#dc-hero-title")?.textContent).toBe("성과 원인을 찾고,다음 하나를 정하세요.");
    expect(document.querySelector(".dc-hero__deck")?.textContent).toContain("브라우저 안에서 바로 분석");
    // 구 trustBadges + privacy 두 줄이 같은 내용을 반복하던 것을 한 줄로 통합.
    expect(document.querySelectorAll(".dc-hero__trust")).toHaveLength(0);
    expect(document.querySelector(".dc-hero__assurance")?.textContent).toBe("무료 · 가입 없음 · 원본 데이터는 브라우저에서만 처리");
    expect(document.querySelector('a.dc-action-route[href="/start"]')).toBeTruthy();
    expect(document.querySelector('a.dc-action-route[href="/calculator"]')).toBeTruthy();
    expect(document.querySelector('a.dc-action-route[href="/diagnose"]')).toBeTruthy();
    expect(document.querySelector(".dc-hero__utility-actions button")?.textContent).toContain("예시 데이터로 30초 체험");
    expect(document.querySelectorAll(".dc-loop-card")).toHaveLength(3);
    expect(document.querySelectorAll("a.dc-loop-card")).toHaveLength(3);
    expect(document.querySelector('a.dc-loop-card[href="/dashboard"]')).toBeTruthy();
    expect(document.querySelector('a.dc-loop-card[href="/weekly-review"]')).toBeTruthy();
    expect(document.body.textContent).toContain("다음 주 결과 검토");
    // 손으로 고른 질문 카드 4장 → 발행 도구 전체 인덱스. 4개만 보이던 것이
    // 첫 화면에서 전부 보인다.
    expect(document.querySelectorAll(".dc-question-card")).toHaveLength(0);
    // 갈래별 접기는 뺐다 — 하나 펼 때마다 아래가 밀려 위치가 매번 달라졌다.
    // 갈래는 전부 펴진 채로 있고, 링크도 전부 DOM에 있다(개수는 레지스트리에서 파생).
    expect(document.querySelectorAll(".dc-questions .tool-index__stage")).toHaveLength(TOOL_JOURNEY.length);
    expect(document.querySelector(".dc-questions details")).toBeNull();
    expect(document.querySelectorAll(".dc-questions .tool-index__link")).toHaveLength(PUBLISHED_TOOL_IDS.length);
    // 연결 워크플로 섹션은 인덱스와 같은 갈래·같은 도구를 카드로 또 그려서 제거했다.
    expect(document.querySelector(".connected-tool-card")).toBeNull();
    expect(document.querySelector('a[href="https://blog.naver.com/growthoptplaybook"]')).toBeTruthy();
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
    const { container } = render(<LandingPage />);
    expect(container.querySelector(".dc-return")).toBeTruthy();
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
  // 첫 화면에서 사용자가 내려야 하는 결정은 하나다(product-ssot §5.1·§5.3). 지금은
  // 목적 CTA 3개 중 하나만 채운 배경·큰 글자를 갖고 나머지 둘은 외곽선이다.
  // 금지되는 것은 "CTA가 3개"가 아니라 **셋이 동급으로 보이는 것**이다 — 두 번째
  // --primary가 붙거나 CTA가 계속 늘면 위계가 사라지므로 여기서 막는다.
  it("keeps exactly one primary action in the hero", () => {
    for (const locale of ["ko", "en"]) {
      const { container, unmount } = render(<LandingPage locale={locale} />);
      const hero = container.querySelector(".dc-hero__actions");
      expect(hero, `${locale}: 히어로 행동 영역이 없다`).toBeTruthy();
      const routes = hero.querySelectorAll(".dc-action-route");
      const primary = hero.querySelectorAll(".dc-action-route--primary");
      expect(primary.length, `${locale}: primary는 정확히 하나여야 한다`).toBe(1);
      expect(routes.length, `${locale}: 목적 CTA가 늘었다 — 선택 밀도를 다시 볼 것`).toBeLessThanOrEqual(3);
      // 보조 진입점(예시 보기·데이터 가이드)은 버튼이 아니라 텍스트 링크로 남는다.
      expect(container.querySelectorAll(".dc-hero__utility-actions .dc-text-link").length).toBeGreaterThan(0);
      expect(container.querySelectorAll(".dc-hero__utility-actions .dc-action-route").length).toBe(0);
      unmount();
    }
  });
  it("renders the same index and hero in English", () => {
    const { container } = render(<LandingPage locale="en" />);
    expect([...container.querySelectorAll(".dc-action-route strong")].map((node) => node.textContent)).toEqual(["Analyze my CSV", "Quick calculations", "Find the cause"]);
    expect(container.querySelector("#dc-hero-title")?.textContent).toBe("Find the cause.Choose one next move.");
    expect(container.querySelector('a.dc-action-route[href="/en/start"]')).toBeTruthy();
    expect(container.querySelector('a.dc-action-route[href="/en/calculator"]')).toBeTruthy();
    expect(container.querySelector('a.dc-action-route[href="/en/diagnose"]')).toBeTruthy();
    expect(container.querySelector('a.dc-loop-card[href="/en/weekly-review"]')).toBeTruthy();
    expect(container.textContent).toContain("Review the actual next week");
    // EN도 같은 인덱스를 쓴다 — 링크가 전부 /en 접두를 갖는지만 본다.
    const enLinks = [...container.querySelectorAll(".dc-questions .tool-index__link")];
    expect(enLinks).toHaveLength(PUBLISHED_TOOL_IDS.length);
    expect(enLinks.every((link) => link.getAttribute("href").startsWith("/en/"))).toBe(true);
    expect(container.textContent).toContain("Try example data in 30 seconds");
  });

  it("도구 목록이 첫 화면 슬롯에 온다 — 아래로 밀리면 없는 것과 같다", () => {
    render(<LandingPage />);
    const questions = document.querySelector(".dc-questions");
    const loop = document.querySelector(".dc-loop");
    // 히어로 바로 다음 블록이어야 하고, 루프 설명보다 앞이어야 한다.
    expect(questions.querySelectorAll(".tool-index__link")).toHaveLength(PUBLISHED_TOOL_IDS.length);
    expect(questions.compareDocumentPosition(loop) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // 별도 카탈로그 섹션은 흡수됐다 — 같은 목록을 두 번 그리지 않는다.
    expect(document.querySelector(".dc-catalog")).toBeNull();
  });
});
