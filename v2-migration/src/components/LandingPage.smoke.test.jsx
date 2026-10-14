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
import { buildOperationsDemo } from "@/lib/operations/operationsDemo";
import { dashboardPeriods } from "@/lib/analysis-results/dashboardPeriods";
import { getMappedRows } from "@/utils/dashboardAggregator";
import { prepareOperationsBrief, planOperationsBudget } from "@/lib/operations/operationsBrief";
import { fmtCurrency, fmtNum } from "@/utils/format";

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
    expect(actions).toHaveLength(3);
    expect(actions.map((action) => action.querySelector("strong")?.textContent)).toEqual(["내 데이터로 운영하기", "데모 보기", "필요한 데이터 양식 확인"]);
    expect(actions[0].getAttribute("href")).toBe("/tools/operations-planner");
    expect(actions[1].getAttribute("href")).toBe("/tools/operations-planner?example=1");
    expect(actions[2].getAttribute("href")).toBe("/data-guide");
    expect(document.querySelectorAll(".dc-action-route small")).toHaveLength(0);
    expect(document.querySelector("#dc-hero-title")?.textContent).toBe("성과는 왜 바뀌었고, 다음엔 뭘 해야 할까?");
    expect(document.querySelector(".dc-hero__deck")?.textContent).toBe("최근 효율과 새 소재를 보고, 다음 예산을 정하세요.");
    expect(document.querySelectorAll(".dc-hero__deck p")).toHaveLength(1);
    for (const action of actions) {
      const hint = document.getElementById(action.getAttribute("aria-describedby"));
      expect(hint.textContent.length).toBeGreaterThan(10);
      expect(action.contains(hint)).toBe(true);
      expect(hint.classList.contains("sr-only")).toBe(true);
    }
    // 구 trustBadges + privacy 두 줄이 같은 내용을 반복하던 것을 한 줄로 통합.
    expect(document.querySelectorAll(".dc-hero__trust")).toHaveLength(0);
    expect(document.querySelector(".dc-hero__assurance")?.textContent).toContain("가입 없이 무료 분석");
    expect(document.querySelector(".home-service-terms")?.textContent).toContain("7일 체험에는 포함되지 않습니다.");
    expect(document.querySelector('a.dc-action-route[href="/tools/operations-planner"]')).toBeTruthy();
    expect(document.querySelector('a.dc-text-link[href="/calculator"]')).toBeTruthy();
    expect(document.querySelector('a.dc-text-link[href="/diagnose"]')).toBeTruthy();
    // 세 진입 아래의 결과 미리보기에서 같은 버튼을 또 반복하지 않는다.
    expect(document.querySelector('.home-result-preview a[href]')).toBeNull();
    expect(document.querySelectorAll('.home-result-preview [role="tab"]')).toHaveLength(3);
    expect(document.querySelector(".dc-action-route--sample")?.textContent).toContain("데모 보기");
    expect(document.querySelectorAll('.dc-hero a[href="/diagnose"]')).toHaveLength(0);
    expect(document.querySelector('.dc-loop a[href="/weekly-review"]')).toBeTruthy();
    expect(document.querySelectorAll(".home-tool-directory > section")).toHaveLength(TOOL_JOURNEY.length);
    expect(document.querySelectorAll(".home-tool-directory a")).toHaveLength(PUBLISHED_TOOL_IDS.length);
    expect(document.querySelectorAll(".home-tool-finder__results a")).toHaveLength(0);
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
  it.each(["ko", "en"])("shows all source campaign comparisons and selects their actual daily observations (%s)", locale => {
    render(<LandingPage locale={locale} />);
    const rows = buildOperationsDemo(locale).raw;
    const campaignRows = [...document.querySelectorAll(".operations-sample-campaigns > div")];
    expect(campaignRows).toHaveLength(4);
    const sums = values => values.reduce((total, row) => ({ cost: total.cost + row.Cost, installs: total.installs + row.Installs }), { cost: 0, installs: 0 });
    for (const node of campaignRows) {
      const name = node.querySelector("dt").textContent;
      const values = rows.filter(row => row["Campaign name"] === name);
      const before = sums(values.filter(row => row.Date >= "2026-09-23" && row.Date <= "2026-09-29"));
      const after = sums(values.filter(row => row.Date >= "2026-09-30"));
      const priorCpi = before.cost / before.installs, currentCpi = after.cost / after.installs;
      expect(node.querySelector(".operations-sample-campaigns__comparison").textContent).toContain(`${fmtCurrency(priorCpi, { currency: "KRW", precise: true })} → ${fmtCurrency(currentCpi, { currency: "KRW", precise: true })}`);
      expect(node.querySelector("[data-tone]").dataset.tone).toBe(currentCpi > priorCpi ? "bad" : "good");
      fireEvent.click(node.querySelector("button"));
      expect(document.querySelector(".home-trend-heading > strong").textContent).toBe(name);
      expect(document.querySelector(".home-preview-story__selection h4").textContent).toBe(name);
      expect(document.querySelector(".home-preview-story__selection").textContent).toContain(fmtCurrency(currentCpi, { currency: "KRW", precise: true }));
    }
    expect(document.querySelector(".operations-sample-chart__legend").textContent).toContain("09.30–10.06");
  });
  it.each(["ko", "en"])("keeps daily inspection in the chart without another control row (%s)", locale => {
    const { queryByRole, container } = render(<LandingPage locale={locale} />);
    expect(queryByRole("slider")).toBeNull();
    expect(queryByRole("combobox", { name: locale === "en" ? "Inspect a date" : "날짜별 값 확인" })).toBeNull();
    expect(container.querySelector(".home-operations-trend input, .home-operations-trend select, .home-operations-trend output")).toBeNull();
  });
  it("with-data mounts", () => {
    seedWithData();
    expect(() => render(<LandingPage />)).not.toThrow();
    expect(document.querySelectorAll(".dc-library-card")).toHaveLength(2);
    expect(document.querySelector(".dc-resource-strip")).toBeTruthy();
  });
  it.each(["ko", "en"])("binds the home budget and creative observations to the actual demo analysis (%s)", locale => {
    seedWithData();
    const userData = useAppStore.getState().csvData;
    const { getByRole } = render(<LandingPage locale={locale} />);
    const data = buildOperationsDemo(locale);
    const periods = dashboardPeriods(data, {}, 7);
    const brief = prepareOperationsBrief({ rows: getMappedRows(data), periods, metric: "installs", mappedFields: Object.values(data.mapping) });
    const plan = planOperationsBudget(brief, { changeLimit: 0.2, currency: "KRW" });
    expect(plan.ok).toBe(true);
    fireEvent.click(getByRole("button", { name: locale === "en" ? "Explore a plan for the same budget" : "같은 예산으로 조정안 보기", exact: true }));
    expect(document.activeElement).toBe(getByRole("tab", { name: locale === "en" ? "Budget" : "예산", exact: true }));
    expect(getByRole("tab", { name: locale === "en" ? "Budget" : "예산", exact: true }).getAttribute("aria-selected")).toBe("true");
    const money = value => fmtCurrency(value, { currency: "KRW", precise: true });
    const metrics = [...document.querySelectorAll(".operations-sample-budget__metrics dd")];
    const recent = data.raw.filter(row => row.Date >= periods.current.start && row.Date <= periods.current.end);
    expect(metrics[0].textContent).toBe(money(recent.reduce((total, row) => total + row.Cost, 0) / 7));
    expect(metrics[1].textContent).toContain(`${fmtNum(plan.baselineResults, 1)} → ${fmtNum(plan.expectedResults, 1)}`);
    expect(document.querySelectorAll(".operations-sample-budget__moves > div")).toHaveLength(4);
    const axis = Math.ceil(Math.max(...plan.items.map(item => Math.abs(item.budget - item.current))) / 10000) * 10000;
    for (const item of plan.items) {
      const name = brief.campaigns.find(row => row.id === item.id).name;
      const node = [...document.querySelectorAll(".operations-sample-budget__moves > div")].find(row => row.querySelector("dt").textContent === name);
      const delta = item.budget - item.current, bar = node.querySelector(".home-budget-delta i");
      expect(node.querySelector("dd").textContent).toBe(`${delta > 0 ? "+" : "−"}${money(Math.abs(delta))}`);
      expect(parseFloat(bar.style.width) / 50 * axis).toBeCloseTo(Math.abs(delta), 8);
      expect(parseFloat(bar.style.left) + (delta < 0 ? parseFloat(bar.style.width) : 0)).toBeCloseTo(50, 10);
    }
    const firstDates = new Map();
    for (const row of data.raw) if (!firstDates.has(row["Creative ID"])) firstDates.set(row["Creative ID"], row.Date);
    const newNames = [...firstDates].filter(([, date]) => date >= periods.current.start).map(([name]) => name);
    expect(newNames).toHaveLength(2);
    fireEvent.click(getByRole("tab", { name: locale === "en" ? "Creatives" : "소재", exact: true }));
    const tableRows = [...document.querySelectorAll(".operations-sample-preview__creatives tbody tr")];
    expect(tableRows).toHaveLength(newNames.length);
    for (const name of newNames) {
      const node = tableRows.find(row => row.textContent.includes(name));
      const rows = recent.filter(row => row["Creative ID"] === name);
      expect(node.textContent).toContain(rows[0]["Campaign name"]);
      const cost = rows.reduce((sum, row) => sum + row.Cost, 0);
      const installs = rows.reduce((sum, row) => sum + row.Installs, 0);
      expect(node.textContent).toContain(money(cost / installs));
      expect(node.textContent).toContain(fmtNum(installs, 0));
      expect(node.textContent).toContain(firstDates.get(name).slice(5).replace("-", "."));
    }
    expect(useAppStore.getState().csvData).toBe(userData);
  });
  it.each(["ko", "en"])("switches preview views with owned tabs, keyboard focus and one visible panel (%s)", locale => {
    const { getAllByRole } = render(<LandingPage locale={locale} />);
    const tabs = getAllByRole("tab");
    expect(tabs).toHaveLength(3);
    const selected = index => {
      tabs.forEach((tab, i) => {
        const panel = document.getElementById(tab.getAttribute("aria-controls"));
        expect(panel.getAttribute("role")).toBe("tabpanel");
        expect(panel.getAttribute("aria-labelledby")).toBe(tab.id);
        expect(panel.hidden).toBe(i !== index);
        expect(tab.tabIndex).toBe(i === index ? 0 : -1);
        expect(tab.getAttribute("aria-selected")).toBe(String(i === index));
        expect(tab.parentElement.getAttribute("role")).toBe("tablist");
      });
    };
    selected(0);
    tabs[0].focus();
    fireEvent.keyDown(tabs[0], { key: "ArrowRight" });
    selected(1);
    expect(document.activeElement).toBe(tabs[1]);
    fireEvent.keyDown(tabs[1], { key: "End" });
    selected(2);
    fireEvent.keyDown(tabs[2], { key: "Home" });
    selected(0);
    fireEvent.keyDown(tabs[0], { key: "ArrowLeft" });
    selected(2);
    expect(document.activeElement).toBe(tabs[2]);
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
    expect(container.querySelector(".dc-intake")).toBeNull();
    expect(container.querySelector(".dc-return").compareDocumentPosition(container.querySelector(".dc-hero")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.querySelector('.dc-return a[href="/projects"]')).toBeTruthy();
    expect(container.querySelector(".dc-return__status strong")?.textContent).toBe("1");
    expect(container.textContent).toContain("검색 예산을 10% 줄이고");
    const reopen = container.querySelector('a[href="/tools/budget-allocation"]');
    clickWithoutNavigation(reopen);
    expect(window.gtag).toHaveBeenCalledWith("event", "landing_continue_tool_clicked", {
      tool_id: "5-3",
      interaction_source: "landing",
      placement: "continue_panel",
      locale: "ko",
    });
    delete window.gtag;
  });
  it("starts the clearly labeled hero example without requiring a CSV", () => {
    window.gtag = vi.fn();
    const { container } = render(<LandingPage />);
    const link = container.querySelector(".dc-action-route--sample");
    expect(link.getAttribute("href")).toBe("/tools/operations-planner?example=1");
    clickWithoutNavigation(link);
    // 홈은 사용자 데이터를 바꾸지 않는다. 예시 진입은 대상 도구에서 처리한다.
    expect(useAppStore.getState().csvGroups.efficiency.fileName).toBe("");
    expect(window.gtag).toHaveBeenCalledWith("event", "example_run_started", {
      tool_id: "5-31",
      interaction_source: "landing",
      placement: "hero_example",
      locale: "ko",
    });
    delete window.gtag;
  });
  it("opens question-specific tools without replacing the user's dataset with a demo", () => {
    seedWithData();
    window.gtag = vi.fn();
    const { container } = render(<LandingPage />);
    for (const link of container.querySelectorAll(".home-tool-directory a")) clickWithoutNavigation(link);
    expect(useAppStore.getState().csvGroups.efficiency.fileName).toBe("x.csv");
    expect(window.gtag).toHaveBeenCalledWith("event", "landing_tool_pick", {
      tool_id: "5-2",
      interaction_source: "landing",
      placement: "question_card",
      locale: "ko",
    });
    expect(window.gtag).not.toHaveBeenCalledWith("event", "example_run_started", expect.anything());
    delete window.gtag;
  });
  it("tracks each hero action without attaching CSV values", () => {
    window.gtag = vi.fn();
    const { container } = render(<LandingPage />);
    clickWithoutNavigation(container.querySelector('a.dc-action-route[href="/tools/operations-planner"]'));
    clickWithoutNavigation(container.querySelector('a.dc-text-link[href="/calculator"]'));
    clickWithoutNavigation(container.querySelector('a.dc-text-link[href="/diagnose"]'));
    expect(window.gtag).toHaveBeenCalledWith("event", "landing_data_start_clicked", {
      journey_entry: "home",
      interaction_source: "landing",
      placement: "hero",
      locale: "ko",
    });
    expect(window.gtag).toHaveBeenCalledWith("event", "calculator_entry_clicked", {
      journey_entry: "home",
      interaction_source: "landing",
      placement: "hero",
      locale: "ko",
    });
    expect(window.gtag).toHaveBeenCalledWith("event", "diagnose_entry_clicked", {
      journey_entry: "home",
      interaction_source: "landing",
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
      expect(container.querySelector(`a[href="${prefix}/blog"]`)).toBeTruthy();
      expect(container.querySelector(`a[href="${prefix}/guide"]`)).toBeTruthy();
      expect(hero, `${locale}: 히어로 행동 영역이 없다`).toBeTruthy();
      const routes = hero.querySelectorAll(".dc-action-route");
      const primary = hero.querySelectorAll(".dc-action-route--primary");
      expect(primary.length, `${locale}: primary는 정확히 하나여야 한다`).toBe(1);
      expect(primary[0].getAttribute("href")).toBe(`${prefix}/tools/operations-planner`);
      expect(routes.length, `${locale}: 내 데이터·데모·데이터 안내 진입점`).toBe(3);
      // 질문(진단)은 첫 화면이 아니라 아래 질문 목록에서 한 번만 연다(F2 — 같은 곳으로 가는 링크 중복 제거).
      expect(container.querySelectorAll(".dc-hero__utility-actions")).toHaveLength(0);
      expect(container.querySelectorAll(`.dc-tool-shortcuts a[href="${prefix}/diagnose"]`)).toHaveLength(1);
      unmount();
    }
  });
  it("renders the same index and hero in English", () => {
    const { container } = render(<LandingPage locale="en" />);
    expect([...container.querySelectorAll(".dc-action-route strong")].map((node) => node.textContent)).toEqual(["Plan operations with my data", "View demo", "Check data requirements"]);
    expect(container.querySelector("#dc-hero-title")?.textContent).toBe("Why did performance change? What should you do next?");
    expect(container.querySelector('a.dc-action-route[href="/en/tools/operations-planner"]')).toBeTruthy();
    expect(container.querySelector('a.dc-text-link[href="/en/calculator"]')).toBeTruthy();
    expect(container.querySelector('a.dc-text-link[href="/en/diagnose"]')).toBeTruthy();
    expect(container.querySelector('.dc-loop a[href="/en/weekly-review"]')).toBeTruthy();
    expect(container.textContent).toContain("Decisions and follow-up reviews");
    expect(container.querySelector(".home-service-terms").textContent).toContain("They are not included in the 7-day trial.");
    // EN도 같은 인덱스를 쓴다 — 링크가 전부 /en 접두를 갖는지만 본다.
    const enLinks = [...container.querySelectorAll(".home-tool-directory a")];
    expect(enLinks).toHaveLength(PUBLISHED_TOOL_IDS.length);
    expect(enLinks.every((link) => link.getAttribute("href").startsWith("/en/"))).toBe(true);
    expect(container.textContent).toContain("View demo");
  });

  it("도구 목록이 첫 화면 슬롯에 온다 — 아래로 밀리면 없는 것과 같다", () => {
    render(<LandingPage />);
    const questions = document.querySelector(".dc-questions");
    const loop = document.querySelector(".dc-loop");
    // 히어로 바로 다음 블록이어야 하고, 루프 설명보다 앞이어야 한다.
    expect(questions.querySelectorAll(".home-tool-directory > section")).toHaveLength(TOOL_JOURNEY.length);
    expect(document.querySelector(".dc-hero").nextElementSibling).toBe(questions);
    expect(questions.compareDocumentPosition(loop) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // 별도 카탈로그 섹션은 흡수됐다 — 같은 목록을 두 번 그리지 않는다.
    expect(document.querySelector(".dc-catalog")).toBeNull();
  });
  it.each(["ko", "en"])("uses the shared data entry and covers all tools through purposes (%s)", (locale) => {
    const { container } = render(<LandingPage locale={locale} />);
    expect(container.querySelector(".dc-intake")).toBeNull();
    clickWithoutNavigation(container.querySelector('.dc-action-route--primary'));
    expect(container.querySelector(".dc-intake")).toBeNull();
    expect(container.querySelector('.dc-action-route--primary').getAttribute("href")).toBe(locale === "en" ? "/en/tools/operations-planner" : "/tools/operations-planner");
    const found = new Set();
    for (const section of container.querySelectorAll(".home-tool-directory > section")) {
      const links = section.querySelectorAll("a");
      expect(links.length).toBeGreaterThan(0);
      for (const link of links) {
        expect(found.has(link.getAttribute("href"))).toBe(false);
        found.add(link.getAttribute("href"));
      }
    }
    expect(found.size).toBe(PUBLISHED_TOOL_IDS.length);
    expect(container.querySelector(".home-tool-directory").hidden).toBe(false);
    expect(container.querySelectorAll(".home-tool-finder__results a")).toHaveLength(0);
  });

  it.each(["ko", "en"])("keeps question entry reachable without replacing uploaded data (%s)", (locale) => {
    seedWithData();
    const source = useAppStore.getState().csvData;
    const { container } = render(<LandingPage locale={locale} />);
    const questionLink = container.querySelector(`.dc-tool-shortcuts a[href="${locale === "en" ? "/en" : ""}/diagnose"]`);
    expect(questionLink).toBeTruthy();
    clickWithoutNavigation(questionLink);
    expect(questionLink.getAttribute("href")).toBe(`${locale === "en" ? "/en" : ""}/diagnose`);
    expect(useAppStore.getState().csvData).toBe(source);
    expect(container.querySelector(`a[href="${locale === "en" ? "/en" : ""}/subscription"]`)).toBeTruthy();
  });

});
