// @vitest-environment jsdom
//
// Render-smoke for Sidebar. Regression net for a render/mount-effect throw.
// Sidebar derives its active id from usePathname() (mocked to "/") and reads the
// static IA/PHASES tables — it does NOT read csvData. "/" intentionally renders
// the compact Decision Workspace nav; inner pages retain the full IA nav.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import Sidebar from "@/components/Sidebar";
import { workspaceNavItem } from "@/lib/workspaceNav";

let pathname = "/";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

const EMPTY_CSV = { raw: [], headers: [], mapping: {}, fileName: "" };

function seedNoData() {
  useAppStore.setState({
    currentRouteId: "home",
    csvGroups: { ...useAppStore.getState().csvGroups, efficiency: EMPTY_CSV },
    csvData: EMPTY_CSV,
    decisionRecords: [],
    isCmdkOpen: false,
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
  useAppStore.setState({ currentRouteId: "5-2", csvGroups: { ...useAppStore.getState().csvGroups, efficiency: slice }, csvData: slice });
}

describe("Sidebar render smoke", () => {
  beforeEach(() => {
    pathname = "/";
    seedNoData();
  });
  it("no-data mounts", () => {
    expect(() => render(<Sidebar />)).not.toThrow();
    expect(document.querySelector(".home-sidebar-nav")).toBeTruthy();
    expect(document.querySelectorAll(".home-sidebar-nav__item")).toHaveLength(5);
    // 홈 사이드바가 워크스페이스 네 줄만 그려서 정작 홈에서 "무슨 분석이
    // 가능한지"를 볼 길이 없었다. 전체 목록으로 가는 줄이 반드시 있어야 한다.
    expect(document.querySelector(".home-sidebar-nav__item--all")).toBeTruthy();
    expect(document.querySelector('.home-sidebar-nav__item[href="/start"]')?.getAttribute("aria-label")).toContain(workspaceNavItem("start").desc);
    expect(document.querySelector('.home-sidebar-nav__item[href="/diagnose"]')?.getAttribute("aria-label")).toContain(workspaceNavItem("diagnose").desc);
    expect(document.body.textContent).toContain(workspaceNavItem("start").desc);
    expect(document.querySelector('a[href="/weekly-review"]')).toBeTruthy();
    expect(document.querySelectorAll(".sidebar-library-link")).toHaveLength(5);
    expect(document.querySelector('.sidebar-library-link[href="/calculator"]')).toBeTruthy();
    expect(document.querySelector('.sidebar-library-link[href="/compare"]')).toBeTruthy();
    expect(document.querySelector('.sidebar-channel-blog[href="/blog"]')).toBeTruthy();
    expect(document.body.textContent).toContain("마케팅 지표 계산기");
    expect(document.body.textContent).not.toContain("무CSV 계산기");
    expect(document.querySelectorAll(".sidebar-social .ss-btn")).toHaveLength(4);
    expect(document.querySelector('a[href="https://blog.naver.com/growthoptplaybook"]')).toBeTruthy();
    expect(document.querySelector('.home-sidebar-nav__item[aria-current="page"]')).toBeTruthy();
    expect(document.querySelector(".sidebar-library-disclosure")?.hasAttribute("open")).toBe(false);
  });
  it("with-data mounts", () => {
    pathname = "/dashboard";
    seedWithData();
    expect(() => render(<Sidebar />)).not.toThrow();
    expect(document.querySelector("aside.sidebar")).toBeTruthy();
    expect(document.querySelector('.nav-item[data-route="5-2"][aria-current="page"]')).toBeTruthy();
    const search = document.querySelector(".sidebar-search");
    expect(search?.getAttribute("aria-controls")).toBe("cmdk");
    expect(search?.getAttribute("aria-expanded")).toBe("false");
    expect(document.querySelectorAll(".sidebar-primary-nav__item")).toHaveLength(4);
    expect(document.querySelector(".sidebar-library-disclosure")?.hasAttribute("open")).toBe(false);
  });
  // 분석 섹션은 TOOL_JOURNEY 스테이지를 그리므로 IA 그룹 기준 항목 번호를 붙이면
  // 헤더(01~05)와 앞자리가 어긋나고 가이드 번호와도 겹친다. 도구 칩엔 번호 없음,
  // 가이드 문서(01~04)는 번호 유지 — 둘 다 회귀로 잠근다.
  it("numbers guide documents but not analysis tools", () => {
    pathname = "/dashboard";
    seedWithData();
    const { container } = render(<Sidebar />);

    const toolChips = [...container.querySelectorAll(".sidebar-workflow-stage .nav-item .ix")];
    expect(toolChips).toHaveLength(0);
    expect(container.querySelector(".sidebar-workflow-prep")?.textContent).toBe("데이터 준비");

    const guideGroup = container.querySelector('.nav-group[data-group="01"]');
    expect(guideGroup?.querySelector(".nav-group-index")?.textContent).toBe("1");
    expect(guideGroup?.querySelector('.nav-item[data-route="1-1"] .ix')?.textContent).toBe("1-1");
  });

  it("keeps resource and external-link parity in English", () => {
    pathname = "/en";
    const { container } = render(<Sidebar locale="en" />);
    expect(container.textContent).toContain("Operating Guide");
    expect(container.textContent).toContain("Naver Blog");
    expect(container.textContent).toContain(workspaceNavItem("review", "en").name);
    expect(container.textContent).toContain("Marketing metric calculators");
    expect(container.querySelector('a[href="/en/guide"]')).toBeTruthy();
  });
  it("uses the full workspace navigation on library routes instead of treating them as home", () => {
    pathname = "/blog";
    const { container } = render(<Sidebar />);
    expect(container.querySelector(".home-sidebar-nav")).toBeNull();
    expect(container.querySelector(".sidebar-primary-nav")).toBeTruthy();
    expect(container.querySelector(".sidebar-library-disclosure")?.hasAttribute("open")).toBe(true);
  });
  it("surfaces decisions due now in the recurring workspace flow", () => {
    useAppStore.setState({
      decisionRecords: [{ id: "decision_1", toolId: "5-2", action: "CPA 검토", reviewDate: "2020-01-01", actual: "", learning: "" }],
    });
    const { container } = render(<Sidebar />);
    const review = container.querySelector('a[href="/weekly-review"]');
    expect(review?.getAttribute("aria-label")).toBe(`${workspaceNavItem("review").name}, 지금 검토할 결정 1건`);
    expect(review?.textContent).toContain("1");
  });
});

describe("응답 패널 다섯 분석 노출", () => {
  it("사이드바에 다섯 분석이 각각 항목으로 나온다", () => {
    // 예전에는 5-18 한 줄뿐이라 들어가야만 안에 분석이 다섯이란 걸 알 수 있었다.
    // 홈은 사이드바가 다른 변형(워크스페이스 4줄)을 그리므로 도구 경로에서 본다.
    pathname = "/dashboard";
    const { container } = render(<Sidebar />);
    const hrefs = [...container.querySelectorAll(".nav-item")].map((link) => link.getAttribute("href"));
    for (const slug of ["/tools/marketing-trend", "/tools/paid-organic-trend", "/tools/cannibalization-diagnosis", "/tools/mmm-contribution", "/tools/marketing-forecast"]) {
      expect(hrefs, slug).toContain(slug);
    }
    // 하위 화면 전용 서브내비는 필요 없어졌다 — 항목이 곧 분석이다.
    expect(container.querySelector(".nav-subnav")).toBeNull();
    pathname = "/";
  });
});
