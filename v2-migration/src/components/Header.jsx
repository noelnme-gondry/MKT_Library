"use client";
import { useEffect, useRef, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppStore, findMeta, displayGroupNumber, displayItemNumber, isNumberedDocItem } from "@/store/useDataStore";
import { resolvePathToId } from "@/lib/routeMap";
import { readSidebarSnapshot, setSidebarCollapsed, sidebarServerSnapshot, subscribeSidebar, syncSidebarForPath } from "@/lib/sidebarCollapse";
import { trGroupTitle, trItemTitle } from "@/lib/enNavCopy";
import { setLocalePref } from "@/lib/localePref";
import { englishSwitchHref } from "@/lib/localizedHref";
import { getDecisionReviewBucket } from "@/lib/decisionReview";
import BrandMark from "@/components/BrandMark";
// 같은 목적지의 이름이 헤더·사이드바·푸터에 각각 적혀 있어 서로 어긋났다 — SSOT에서 받는다.
import { workspaceNavItem } from "@/lib/workspaceNav";
import ProjectSettingsMenu from "@/components/ProjectSettingsMenu";

const HEADER_COPY = {
  ko: {
    breadcrumbAria: "페이지 경로",
    sidebarExpand: "메뉴 펼치기",
    sidebarCollapse: "메뉴 접기",
    overview: "Overview",
    csvChangeTitle: "현재 CSV를 지우고 다시 업로드 (이 CSV를 공유하는 모든 도구에 적용)",
    csvChangeBtn: "CSV 변경",
    themeAria: "테마 전환",
    themeTitle: "테마 전환 (라이트/다크)",
    quickNav: "빠른 이동",
    allTools: "전체 도구",
    localeSwitch: "English",
    localeSwitchTitle: "영어 페이지로 (번역된 페이지만 지원)",
    print: "인쇄 / PDF",
    printTitle: "현재 분석 결과를 인쇄하거나 PDF로 저장",
    decisionInboxAria: (count, name) => `${name}${count ? `, 지금 검토할 결정 ${count}건` : ""}`,
    dataContext: "현재 데이터",
    utilities: "기타 설정",
    storage: "이 기기에 저장된 것",
    analystMode: "분석가 모드",
    analystModeOn: "분석가 모드 켜짐",
    analystModeOff: "분석가 모드 꺼짐",
  },
  en: {
    breadcrumbAria: "Breadcrumb",
    sidebarExpand: "Show navigation",
    sidebarCollapse: "Hide navigation",
    overview: "Overview",
    csvChangeTitle: "Clear current CSV and re-upload (applies to every tool sharing this data)",
    csvChangeBtn: "Change CSV",
    themeAria: "Toggle theme",
    themeTitle: "Toggle theme (light/dark)",
    quickNav: "Quick nav",
    allTools: "All tools",
    localeSwitch: "한국어",
    localeSwitchTitle: "Switch to the Korean page",
    print: "Print / PDF",
    printTitle: "Print this analysis or save it as a PDF",
    decisionInboxAria: (count, name) => `${name}${count ? `, ${count} decision${count === 1 ? "" : "s"} due now` : ""}`,
    dataContext: "Current data",
    utilities: "More settings",
    storage: "Stored on this device",
    analystMode: "Analyst mode",
    analystModeOn: "Analyst mode on",
    analystModeOff: "Analyst mode off",
  },
};

export default function Header({ locale = "ko" }) {
  const T = HEADER_COPY[locale] || HEADER_COPY.ko;
  const isDarkMode = useAppStore((state) => state.isDarkMode);
  const toggleTheme = useAppStore((state) => state.toggleTheme);
  const isCmdkOpen = useAppStore((state) => state.isCmdkOpen);
  const setCmdkOpen = useAppStore((state) => state.setCmdkOpen);
  const analystMode = useAppStore((state) => state.analystMode);
  const setAnalystMode = useAppStore((state) => state.setAnalystMode);
  // 현재 활성 그룹(효율/소재/실험/응답/aha)의 csvData — 전역 헤더에서 파일명 노출 +
  // 어느 도구에서든 동일하게 초기화 가능하게(§ 그룹 스코프 csvData 미러).
  const csvData = useAppStore((state) => state.csvData);
  const clearCsvGroup = useAppStore((state) => state.clearCsvGroup);
  const decisionRecords = useAppStore((state) => state.decisionRecords);
  const dueDecisionCount = decisionRecords.reduce((count, record) => {
    const status = getDecisionReviewBucket(record);
    return count + (status === "overdue" || status === "today" ? 1 : 0);
  }, 0);
  const hasCsv = !!(csvData && csvData.raw && csvData.raw.length > 0);
  const resetCsv = () => clearCsvGroup();
  // Breadcrumb sourced from the URL (SSOT) → correct on deep-link + back/forward.
  const pathname = usePathname();
  const currentRouteId = resolvePathToId(pathname) ?? "home";
  const isAnalysisRoute = currentRouteId.startsWith("5-") || currentRouteId.startsWith("9-");
  // 블로그는 routeMap 밖(fs 기반)이라 id 해석이 "home"으로 떨어짐 → 경로로 직접 감지해
  // 브레드크럼("블로그")·언어전환(/blog↔/en/blog)을 도구와 동일한 공용 Header에서 처리.
  const cleanPath = (pathname || "/").replace(/^\/en(?=\/|$)/, "") || "/";
  const isBlog = cleanPath === "/blog" || cleanPath.startsWith("/blog/");
  const blogHref = locale === "en" ? "/en/blog" : "/blog";
  // 독립 SEO 리소스도 routeMap 밖. KR/EN 리터럴 라우트를 함께 제공한다.
  const isTemplates = cleanPath === "/templates";
  const isCalculator = cleanPath === "/calculator" || cleanPath.startsWith("/calculator/");
  const isDiagnose = cleanPath === "/diagnose";
  const isWeeklyReport = cleanPath === "/weekly-report";
  const isWeeklyReview = cleanPath === "/weekly-review";
  // 용어사전도 동일 패턴(§glossary) — 이제 EN 있음(content/glossary-en), 블로그처럼
  // /glossary↔/en/glossary 전환.
  const isGlossary = cleanPath === "/glossary" || cleanPath.startsWith("/glossary/");
  const glossaryHref = locale === "en" ? "/en/glossary" : "/glossary";
  // KR<->EN 페이지 전환 — 현재 페이지 기준(홈 아니어도 항상 이 경로 유지). EN→KR은
  // 늘 있음(KR이 항상 완성본). KR→EN은 번역된 페이지일 때만, 없으면 /en 홈 폴백.
  const switchHref = locale === "en" ? cleanPath : englishSwitchHref(pathname);
  const switchLocale = locale === "en" ? "ko" : "en";
  const hasRestoredTheme = useRef(false);
  const utilityMenuRef = useRef(null);
  const closeUtilityMenu = () => utilityMenuRef.current?.removeAttribute("open");

  useEffect(() => {
    const closeOnOutsidePointer = (event) => {
      const menu = utilityMenuRef.current;
      if (menu?.open && !menu.contains(event.target)) menu.removeAttribute("open");
    };
    const closeOnEscape = (event) => {
      const menu = utilityMenuRef.current;
      if (event.key !== "Escape" || !menu?.open) return;
      menu.removeAttribute("open");
      menu.querySelector(":scope > summary")?.focus();
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  // 부팅 인라인 스크립트가 첫 페인트 전에 이미 클래스를 붙여 뒀다 — 렌더는 그것을 읽기만 한다.
  const sidebarCollapsed = useSyncExternalStore(subscribeSidebar, readSidebarSnapshot, sidebarServerSnapshot);
  // 소프트 내비게이션에서는 부팅 스크립트가 다시 돌지 않는다. 저장된 선택이 없을
  // 때만 라우트 기본값을 다시 적용한다(선택이 있으면 그 선택이 항상 이긴다).
  useEffect(() => { syncSidebarForPath(pathname); }, [pathname]);

  // The first inline body script already applies the stored class before paint.
  // Synchronize Zustand once, then keep DOM/storage/canvas charts aligned.
  useEffect(() => {
    // 저장값이 없으면 OS 설정을 따른다 — 부팅 인라인 스크립트와 같은 규칙이어야
    // 마운트 직후 테마가 뒤집히지 않는다.
    const stored = localStorage.getItem("mkt-library-theme");
    const shouldBeDark = stored
      ? stored === "dark"
      : Boolean(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.body.classList.toggle("light-mode", !shouldBeDark);
    if (useAppStore.getState().isDarkMode !== shouldBeDark) toggleTheme();
    hasRestoredTheme.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!hasRestoredTheme.current) return;
    const currentDark = useAppStore.getState().isDarkMode;
    document.body.classList.toggle("light-mode", !currentDark);
    localStorage.setItem("mkt-library-theme", currentDark ? "dark" : "light");
    // 차트가 실제로 떠 있을 때만 chart.js를 내려받는다. 블로그·용어사전 같은 콘텐츠
    // 페이지는 canvas가 없는데도 테마 동기화 때문에 매 진입마다 차트 번들을 받고 있었다.
    if (!document.querySelector("canvas")) return;
    Promise.all([import("chart.js/auto"), import("@/utils/chartUtils")]).then(([chartModule, themeModule]) => {
      themeModule.refreshMountedChartThemes(chartModule.default);
    });
  }, [isDarkMode]);

  // 브레드크럼: 홈이면 "Library / Overview", 도구/문서 페이지면 3단계
  // (Library / {그룹번호 · 그룹명} / {항목번호 · 항목명}) — 원본 setBreadcrumb 동일.
  const meta = currentRouteId === "home" ? null : findMeta(currentRouteId);

  return (
    <header className="topbar operator-header" role="banner">
      <div className="topbar-context">
        <button
          type="button"
          className="btn ghost header-sidebar-toggle"
          aria-expanded={!sidebarCollapsed}
          aria-controls="sidebar"
          aria-label={sidebarCollapsed ? T.sidebarExpand : T.sidebarCollapse}
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        >
          <span aria-hidden="true">◧</span>
        </button>
        <nav className="breadcrumb" aria-label={T.breadcrumbAria}>
          <Link href={locale === "en" ? "/en" : "/"} className="crumb-link brand-crumb" aria-label="Growth Opt Playbook">
            <BrandMark size={26} label="Growth Opt Playbook" />
            <span className="brand-crumb__label">Growth Opt Playbook</span>
          </Link>
          {cleanPath === "/" && <><span className="sep">/</span><strong className="current">{workspaceNavItem("home", locale).name}</strong></>}
          {isBlog && <><span className="sep">/</span><Link href={blogHref} className="current current--section">{locale === "en" ? "Blog" : "블로그"}</Link></>}
          {isTemplates && <><span className="sep">/</span><span className="current current--section">{locale === "en" ? "Templates" : "템플릿"}</span></>}
          {isCalculator && <><span className="sep">/</span><Link href={locale === "en" ? "/en/calculator" : "/calculator"} className="current current--section">{locale === "en" ? "Metric calculators" : "지표 계산기"}</Link></>}
          {isDiagnose && <><span className="sep">/</span><span className="current current--section">{locale === "en" ? "Diagnosis" : "문제 진단"}</span></>}
          {(isWeeklyReport || isWeeklyReview) && (
            <><span className="sep">/</span><span className="current current--section">
              {isWeeklyReport
                ? (locale === "en" ? "Weekly report" : "주간 보고서")
                : (locale === "en" ? "Weekly review" : "주간 검토")}
            </span></>
          )}
          {isGlossary && <><span className="sep">/</span><Link href={glossaryHref} className="current current--section">{locale === "en" ? "Glossary" : "용어사전"}</Link></>}
          {!isBlog && !isTemplates && !isCalculator && !isDiagnose && !isWeeklyReport && !isWeeklyReview && !isGlossary && meta && (
            <>
              <span className="sep">/</span>
              <span className="current current--section" title={trGroupTitle(meta.group.id, locale, meta.group.title)}>
                {isNumberedDocItem(meta.id) && <>{displayGroupNumber(meta.group.id, locale)} · </>}
                {trGroupTitle(meta.group.id, locale, meta.group.title)}
              </span>
              <span className="sep">/</span>
              <span className="current current--page">
                {isNumberedDocItem(meta.id) && <>{displayItemNumber(meta.id, locale)} · </>}
                {trItemTitle(meta.id, locale, meta.title)}
              </span>
            </>
          )}
        </nav>
        {hasCsv && (
          <div className="header-data-context header-csv" aria-label={`${T.dataContext}: ${csvData.fileName || "data.csv"}`}>
            <span className="header-data-context__label">{T.dataContext}</span>
            <span className="chip header-data-context__file" title={csvData.fileName || "data.csv"}>
              <span className="dot" aria-hidden="true"></span>{csvData.fileName || "data.csv"}
            </span>
          </div>
        )}
      </div>

      <div className="topbar-actions">
        <div className="topbar-actions__primary">
          <Link
            href={locale === "en" ? "/en/weekly-review" : "/weekly-review"}
            className="btn ghost header-decision-inbox"
            aria-label={T.decisionInboxAria(dueDecisionCount, workspaceNavItem("review", locale).name)}
            aria-current={isWeeklyReview ? "page" : undefined}
          >
            <span className="header-decision-inbox__icon" aria-hidden="true">◷</span>
            <span className="header-decision-inbox__label">{workspaceNavItem("review", locale).name}</span>
            {dueDecisionCount > 0 && <em>{dueDecisionCount}</em>}
          </Link>
          <button
            className="btn ghost header-cmdk"
            type="button"
            aria-label={T.allTools}
            aria-haspopup="dialog"
            aria-controls="cmdk"
            aria-expanded={isCmdkOpen}
            onClick={() => setCmdkOpen(true)}
          >
            <svg className="header-cmdk__search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <span className="header-cmdk__menu-icon" aria-hidden="true">☰</span>
            <span className="header-cmdk__label header-cmdk__label--desktop">{T.quickNav}</span>
            <span className="header-cmdk__label header-cmdk__label--mobile">{T.allTools}</span>
            <span className="kbd">⌘K</span>
          </button>
          <details ref={utilityMenuRef} className="header-utility-menu">
            <summary className="btn ghost header-utility-menu__trigger" aria-label={T.utilities}>
              <span className="header-utility-menu__dots" aria-hidden="true">•••</span>
              <span className="header-utility-menu__label">{T.utilities}</span>
            </summary>
            <div className="header-utility-menu__panel">
              <ProjectSettingsMenu locale={locale} />
              <Link href={locale === "en" ? "/en/storage" : "/storage"} className="btn ghost" onClick={closeUtilityMenu}>{T.storage}</Link>
              <button className="btn ghost header-analyst-mode-menu" type="button" aria-pressed={analystMode} onClick={() => { setAnalystMode(!analystMode); closeUtilityMenu(); }}>
                {analystMode ? "✓ " : ""}{T.analystMode}
              </button>
              {hasCsv && (
                <button className="btn ghost header-csv-change" type="button" title={T.csvChangeTitle} onClick={async () => { await resetCsv(); closeUtilityMenu(); }}>
                  {T.csvChangeBtn}
                </button>
              )}
              {isAnalysisRoute && (
                <button className="btn ghost header-print" type="button" title={T.printTitle} onClick={() => { window.print(); closeUtilityMenu(); }}>
                  {T.print}
                </button>
              )}
              <Link href={switchHref} className="btn ghost header-locale" title={T.localeSwitchTitle} onClick={() => { setLocalePref(switchLocale); closeUtilityMenu(); }}>
                {T.localeSwitch}
              </Link>
              <button className="btn ghost header-theme" id="theme-toggle" type="button" aria-label={T.themeAria} title={T.themeTitle} onClick={() => { toggleTheme(); closeUtilityMenu(); }}>
                {isDarkMode ? (
                  <svg className="sun-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                  </svg>
                ) : (
                  <svg className="moon-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
                )}
                <span>{T.themeTitle}</span>
              </button>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
