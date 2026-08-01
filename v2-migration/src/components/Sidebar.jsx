"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppStore, IA, SECTIONS, displayGroupNumberShort, displayItemNumberShort, findMeta } from "@/store/useDataStore";
import { idToSlug, resolvePathToId, hasEnVersion } from "@/lib/routeMap";
import { trGroupTitle, trItemTitle, trSectionLabel } from "@/lib/enNavCopy";
import { TOOL_JOURNEY, localizedTool } from "@/lib/toolConnections";
import { getDecisionReviewBucket } from "@/lib/decisionReview";
import BrandMark from "@/components/BrandMark";

const SIDEBAR_COPY = {
  ko: {
    searchPlaceholder: "가이드·파라미터·코드 검색…",
    blog: "블로그",
    guide: "운영 가이드",
    calculators: "무CSV 계산기",
    diagnose: "성과 문제 진단",
    templates: "템플릿·체크리스트",
    glossary: "용어사전",
    youtube: "유튜브",
    instagram: "인스타",
    facebook: "페북",
    naverBlog: "네이버 블로그",
    resourceLabel: "LIBRARY",
    workspaceLabel: "DECISION WORKSPACE",
    allTools: "전체 도구",
    today: "오늘의 질문",
    review: "결정 검토함",
    reviewAria: (count) => `결정 검토함${count ? `, 지금 검토할 결정 ${count}건` : ""}`,
    workflow: "연결된 분석 흐름",
    dataGuide: "데이터 준비",
    insights: "실무 인사이트",
    localOnly: "업로드한 데이터는 이 브라우저 안에서만 처리됩니다.",
  },
  en: {
    searchPlaceholder: "Search guides, params, code…",
    blog: "Blog",
    guide: "Operating Guide",
    calculators: "No-CSV Calculators",
    diagnose: "Diagnose Performance",
    templates: "Templates",
    glossary: "Glossary",
    resourceLabel: "LIBRARY",
    youtube: "YouTube",
    instagram: "Instagram",
    facebook: "Facebook",
    naverBlog: "Naver Blog",
    workspaceLabel: "DECISION WORKSPACE",
    allTools: "All tools",
    today: "Today’s question",
    review: "Decision inbox",
    reviewAria: (count) => `Decision inbox${count ? `, ${count} decision${count === 1 ? "" : "s"} due now` : ""}`,
    workflow: "Connected workflow",
    dataGuide: "Prepare data",
    insights: "Practical insights",
    localOnly: "Uploaded data is processed only in this browser.",
  },
};

export default function Sidebar({ locale = "ko" }) {
  const T = SIDEBAR_COPY[locale] || SIDEBAR_COPY.ko;
  // 번역된 항목만 /en 유지, 나머지는 KR 페이지로(반쪽 번역 노출 방지 — §plan).
  const navHref = (id) =>
    locale === "en" && hasEnVersion(id) ? `/en${idToSlug[id] || ""}` : idToSlug[id] || "/";
  // Active id is derived from the URL (SSOT) so highlight is correct even before
  // the page-level store-sync effect runs (avoids a first-paint race).
  const pathname = usePathname();
  const currentRouteId = resolvePathToId(pathname) ?? "home";
  const cleanPath = (pathname || "/").replace(/^\/en(?=\/|$)/, "") || "/";
  const isHome = cleanPath === "/";
  const isWeeklyReview = cleanPath === "/weekly-review";
  const isLibraryRoute = /^\/(blog|guide|calculator|diagnose|templates|glossary)(\/|$)/.test(cleanPath);
  const isCmdkOpen = useAppStore((state) => state.isCmdkOpen);
  const setCmdkOpen = useAppStore((state) => state.setCmdkOpen);
  const decisionRecords = useAppStore((state) => state.decisionRecords);
  const dueDecisionCount = decisionRecords.reduce((count, record) => {
    const bucket = getDecisionReviewBucket(record);
    return count + (bucket === "overdue" || bucket === "today" ? 1 : 0);
  }, 0);

  // Keep track of collapsed states
  // By default, expand if an item is active, otherwise collapsed
  // But we need to manage local toggle state.
  // Actually, let's derive it from active route initially, and allow local toggle.
  const [collapsedSections, setCollapsedSections] = useState({});
  const [collapsedGroups, setCollapsedGroups] = useState({});

  // 첫 클릭 무반응 버그(§7): prev[id]가 아직 undefined일 때 !prev[id]로 토글하면
  // "화면에 파생상태로 보이던 값"과 무관하게 무조건 true(닫힘)로 저장돼, 이미
  // 파생상태로 열려 있던 섹션/그룹은 첫 클릭에 아무 변화가 없고 두 번째 클릭에야
  // 실제로 뒤집힘. 클릭 시점의 "현재 표시된" 값을 받아 그 반대를 명시적으로 저장.
  const toggleSection = (sectionId, currentlyCollapsed) => {
    setCollapsedSections((prev) => ({ ...prev, [sectionId]: !currentlyCollapsed }));
  };

  const toggleGroup = (groupId, currentlyCollapsed) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupId]: !currentlyCollapsed }));
  };

  return (
    <aside className="sidebar" id="sidebar">
      <Link
        href={locale === "en" ? "/en" : "/"}
        className="brand"
        id="brand"
        style={{ cursor: "pointer", textDecoration: "none", color: "inherit" }}
      >
        <BrandMark label="Growth Opt Playbook" />
        <div>
          <div className="brand-name">Growth Opt</div>
          <div className="brand-sub">Playbook</div>
        </div>
      </Link>

      {isHome ? (
        <div className="home-sidebar-workspace">
          <div className="home-sidebar-workspace__label">{T.workspaceLabel}</div>
          <nav className="home-sidebar-nav" aria-label={T.workspaceLabel}>
            <Link href={locale === "en" ? "/en" : "/"} className="home-sidebar-nav__item active" aria-current="page">
              <span aria-hidden="true">◎</span><strong>{T.today}</strong><small aria-hidden="true">NOW</small>
            </Link>
            <Link
              href={locale === "en" ? "/en/weekly-review" : "/weekly-review"}
              className="home-sidebar-nav__item home-sidebar-nav__item--review"
              aria-label={T.reviewAria(dueDecisionCount)}
              data-due={dueDecisionCount > 0 ? "true" : undefined}
            >
              <span aria-hidden="true">◷</span><strong>{T.review}</strong><small aria-hidden="true">{dueDecisionCount || "WEEK"}</small>
            </Link>
            <a href="#workflow" className="home-sidebar-nav__item">
              <span aria-hidden="true">↳</span><strong>{T.workflow}</strong><small aria-hidden="true">FLOW</small>
            </a>
            <Link href={locale === "en" ? "/en/guide/csv-data-prep" : "/guide/csv-data-prep"} className="home-sidebar-nav__item">
              <span aria-hidden="true">▤</span><strong>{T.dataGuide}</strong><small aria-hidden="true">CSV</small>
            </Link>
            <Link href={locale === "en" ? "/en/blog" : "/blog"} className="home-sidebar-nav__item">
              <span aria-hidden="true">⌁</span><strong>{T.insights}</strong><small aria-hidden="true">READ</small>
            </Link>
          </nav>
        </div>
      ) : (
        <>
      <nav className="sidebar-primary-nav" aria-label={T.workspaceLabel}>
        <Link href={locale === "en" ? "/en" : "/"} className="sidebar-primary-nav__item">
          <span aria-hidden="true">◎</span><strong>{T.today}</strong><small aria-hidden="true">NOW</small>
        </Link>
        <Link
          href={locale === "en" ? "/en/weekly-review" : "/weekly-review"}
          className={`sidebar-primary-nav__item sidebar-primary-nav__item--review${isWeeklyReview ? " active" : ""}`}
          aria-label={T.reviewAria(dueDecisionCount)}
          aria-current={isWeeklyReview ? "page" : undefined}
          data-due={dueDecisionCount > 0 ? "true" : undefined}
        >
          <span aria-hidden="true">◷</span><strong>{T.review}</strong>
          <small aria-hidden="true">{dueDecisionCount || "WEEK"}</small>
        </Link>
      </nav>
      <div className="inner-workspace-label">
        <span>{T.workspaceLabel}</span>
        <b>{T.allTools}</b>
      </div>
      <button type="button" className="sidebar-search" onClick={() => setCmdkOpen(true)} aria-label={T.searchPlaceholder} aria-haspopup="dialog" aria-controls="cmdk" aria-expanded={isCmdkOpen}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <span>{T.searchPlaceholder}</span>
        <kbd>⌘K</kbd>
      </button>

      <nav id="nav" data-rendered="1">
        {/* §UX 개선: "분석"(실제 도구)이 메인 제품이라 렌더 순서상 먼저 보여주고
            시각적으로도 강조(phase-tag--primary). SECTIONS 데이터 자체의 순서는
            안 건드림(번호 계산이 section.groups.indexOf 기반이라 순서 무관하지만,
            다른 소비처(LandingPage 등)에 예기치 않은 영향 안 주려고 렌더링에서만 정렬). */}
        {[...SECTIONS].sort((a, b) => (a.id === "analysis" ? -1 : b.id === "analysis" ? 1 : 0)).map((section) => {
          const isPrimarySection = section.id === "analysis";
          const sectionGroups = IA.filter((g) => section.groups.includes(g.id));
          const workflowToolIds = TOOL_JOURNEY.flatMap((stage) => stage.tools);
          const sectionHasActive = isPrimarySection
            ? workflowToolIds.includes(currentRouteId) || currentRouteId === "8-1"
            : sectionGroups.some((g) => g.items.some((it) => it.id === currentRouteId));

          // If it hasn't been explicitly toggled, use the derived state. 분석
          // 섹션은 메인 제품이라 홈에서도 기본 펼침(다른 섹션은 기존 로직 유지).
          const isSectionCollapsed = collapsedSections[section.id] !== undefined
            ? collapsedSections[section.id]
            : isPrimarySection ? false : !sectionHasActive;

          return (
            <section
              key={section.id}
              className={`phase-section ${isPrimarySection ? "phase-section--primary" : ""} ${isSectionCollapsed ? "collapsed" : ""}`}
              data-section={section.id}
            >
              <button
                className="phase-header"
                type="button"
                onClick={() => toggleSection(section.id, isSectionCollapsed)}
                aria-expanded={!isSectionCollapsed}
              >
                <span className="phase-header-left">
                  <span className={`phase-tag ${isPrimarySection ? "phase-tag--primary" : ""}`}>{trSectionLabel(section.id, locale, section.label)}</span>
                </span>
                <svg className="phase-chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>

              <div className="phase-body">
                {isPrimarySection ? (
                  <>
                    <Link href={navHref("8-1")} className={`sidebar-workflow-prep ${currentRouteId === "8-1" ? "active" : ""}`} aria-current={currentRouteId === "8-1" ? "page" : undefined}>
                      <span>{T.dataGuide}</span>
                      <b>{displayItemNumberShort("8-1")}</b>
                    </Link>
                    {TOOL_JOURNEY.map((stage, stageIndex) => {
                      const hasActive = stage.tools.includes(currentRouteId);
                      const stageKey = `journey-${stage.id}`;
                      const isGroupCollapsed = collapsedGroups[stageKey] !== undefined
                        ? collapsedGroups[stageKey]
                        : !hasActive;
                      return (
                        <div key={stage.id} className={`nav-group sidebar-workflow-stage ${isGroupCollapsed ? "collapsed" : ""}`} data-stage={stage.id}>
                          <button
                            type="button"
                            className="nav-group-header"
                            onClick={() => toggleGroup(stageKey, isGroupCollapsed)}
                            aria-expanded={!isGroupCollapsed}
                          >
                            <span className="nav-group-title">
                              <span className="nav-group-index">{String(stageIndex + 1).padStart(2, "0")}</span>
                              <span>{stage.title[locale === "en" ? "en" : "ko"]}</span>
                            </span>
                            <svg className="chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                          </button>
                          <div className="nav-items">
                            {stage.tools.map((toolId) => {
                              const tool = localizedTool(toolId, locale);
                              const meta = findMeta(toolId);
                              const title = meta ? trItemTitle(toolId, locale, meta.title) : tool.title;
                              return (
                                <Link
                                  key={toolId}
                                  href={navHref(toolId)}
                                  className={`nav-item ${toolId === currentRouteId ? "active" : ""}`}
                                  data-route={toolId}
                                  aria-current={toolId === currentRouteId ? "page" : undefined}
                                >
                                  <span className="ix tnum">{displayItemNumberShort(toolId)}</span>
                                  <span>{title}</span>
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </>
                ) : sectionGroups.map((group) => {
                  const hasActive = group.items.some((it) => it.id === currentRouteId);
                  const isGroupCollapsed = collapsedGroups[group.id] !== undefined
                    ? collapsedGroups[group.id]
                    : !hasActive;

                  return (
                    <div key={group.id} className={`nav-group ${isGroupCollapsed ? "collapsed" : ""}`} data-group={group.id}>
                      <button
                        type="button"
                        className="nav-group-header"
                        onClick={() => toggleGroup(group.id, isGroupCollapsed)}
                        aria-expanded={!isGroupCollapsed}
                      >
                        <span className="nav-group-title">
                          <span className="nav-group-index">{displayGroupNumberShort(group.id)}</span>
                          <span>{trGroupTitle(group.id, locale, group.title)}</span>
                        </span>
                        <svg className="chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                      </button>
                      <div className="nav-items">
                        {group.items.filter((it) => !it.hidden).map((it) => (
                          <Link
                            key={it.id}
                            href={navHref(it.id)}
                            className={`nav-item ${it.id === currentRouteId ? "active" : ""}`}
                            data-route={it.id}
                            aria-current={it.id === currentRouteId ? "page" : undefined}
                          >
                            <span className="ix tnum">{displayItemNumberShort(it.id)}</span>
                            <span>{trItemTitle(it.id, locale, it.title)}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </nav>
        </>
      )}

      {/* 라이브러리는 분석 흐름보다 한 단계 낮은 보조 문맥이다. 홈·리소스
          페이지에서는 펼치고, 도구 작업 중에는 접어 현재 판단 흐름을 우선한다. */}
      <details className="sidebar-library-disclosure" open={isHome || isLibraryRoute}>
        <summary className="sidebar-resource-label">
          <span>{T.resourceLabel}</span>
          <span className="sidebar-library-disclosure__count" aria-hidden="true">06</span>
        </summary>
        <section className="sidebar-library" data-section="resources">
        <Link
          href={locale === "en" ? "/en/blog" : "/blog"}
          className="sidebar-library-link"
          aria-current={(pathname || "").includes("/blog") ? "page" : undefined}
        >
          <span><strong>{T.blog}</strong><small>INSIGHTS</small></span><b>↗</b>
        </Link>
        <Link
          href={locale === "en" ? "/en/guide" : "/guide"}
          className="sidebar-library-link"
          aria-current={(pathname || "").includes("/guide") ? "page" : undefined}
        >
          <span><strong>{T.guide}</strong><small>SOP</small></span><b>↗</b>
        </Link>
        <Link
          href={locale === "en" ? "/en/calculator" : "/calculator"}
          className="sidebar-library-link"
          aria-current={(pathname || "").includes("/calculator") ? "page" : undefined}
        >
          <span><strong>{T.calculators}</strong><small>QUICK MATH</small></span><b>↗</b>
        </Link>
        <Link
          href={locale === "en" ? "/en/diagnose" : "/diagnose"}
          className="sidebar-library-link"
          aria-current={(pathname || "").includes("/diagnose") ? "page" : undefined}
        >
          <span><strong>{T.diagnose}</strong><small>ROUTER</small></span><b>↗</b>
        </Link>
        <Link
          href={locale === "en" ? "/en/templates" : "/templates"}
          className="sidebar-library-link"
          aria-current={(pathname || "").includes("/templates") ? "page" : undefined}
        >
          <span><strong>{T.templates}</strong><small>FILES</small></span><b>↗</b>
        </Link>
        <Link
          href={locale === "en" ? "/en/glossary" : "/glossary"}
          className="sidebar-library-link"
          aria-current={(pathname || "").includes("/glossary") ? "page" : undefined}
        >
          <span><strong>{T.glossary}</strong><small>TERMS</small></span><b>↗</b>
        </Link>
        </section>

        <div className="sidebar-social">
        <a className="ss-btn ss-youtube" href="https://youtube.com/channel/UCvRcpOHOqvSHQPNbgZdPNUw/" target="_blank" rel="noopener noreferrer" title={T.youtube}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M23.5 6.2a3 3 0 0 0-2.11-2.12C19.44 3.5 12 3.5 12 3.5s-7.44 0-9.39.58A3 3 0 0 0 .5 6.2 31.6 31.6 0 0 0 0 12a31.6 31.6 0 0 0 .5 5.8 3 3 0 0 0 2.11 2.12C4.56 20.5 12 20.5 12 20.5s7.44 0 9.39-.58a3 3 0 0 0 2.11-2.12A31.6 31.6 0 0 0 24 12a31.6 31.6 0 0 0-.5-5.8ZM9.6 15.6V8.4L15.8 12Z"/></svg>
          <span>{T.youtube}</span>
        </a>
        <a className="ss-btn ss-instagram" href="https://www.instagram.com/gondry__workshop/" target="_blank" rel="noopener noreferrer" title={T.instagram}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.2c3.2 0 3.6 0 4.85.07 1.17.06 1.97.24 2.43.42a4.9 4.9 0 0 1 1.77 1.15 4.9 4.9 0 0 1 1.15 1.77c.18.46.36 1.26.42 2.43.06 1.25.07 1.65.07 4.85s0 3.6-.07 4.85c-.06 1.17-.24 1.97-.42 2.43a4.9 4.9 0 0 1-1.15 1.77 4.9 4.9 0 0 1-1.77 1.15c-.46.18-1.26.36-2.43.42-1.25.06-1.65.07-4.85.07s-3.6 0-4.85-.07c-1.17-.06-1.97-.24-2.43-.42a4.9 4.9 0 0 1-1.77-1.15 4.9 4.9 0 0 1-1.15-1.77c-.18-.46-.36-1.26-.42-2.43C2.2 15.6 2.2 15.2 2.2 12s0-3.6.07-4.85c.06-1.17.24-1.97.42-2.43A4.9 4.9 0 0 1 3.84 3c.53-.5 1.12-.9 1.77-1.15.46-.18 1.26-.36 2.43-.42C9.29 1.37 9.69 2.2 12 2.2Zm0 1.8c-3.15 0-3.52 0-4.75.06-.96.05-1.48.2-1.82.34a3.1 3.1 0 0 0-1.15.75 3.1 3.1 0 0 0-.75 1.15c-.14.34-.29.86-.34 1.82-.06 1.23-.06 1.6-.06 4.75s0 3.52.06 4.75c.05.96.2 1.48.34 1.82.16.42.38.79.75 1.15.36.36.73.6 1.15.75.34.14.86.29 1.82.34 1.23.06 1.6.06 4.75.06s3.52 0 4.75-.06c.96-.05 1.48-.2 1.82-.34.42-.16.79-.38 1.15-.75.36-.36.6-.73.75-1.15.14-.34.29-.86.34-1.82.06-1.23.06-1.6.06-4.75s0-3.52-.06-4.75c-.05-.96-.2-1.48-.34-1.82a3.1 3.1 0 0 0-.75-1.15 3.1 3.1 0 0 0-1.15-.75c-.34-.14-.86-.29-1.82-.34C15.52 4 15.15 4 12 4Zm0 3.05a4.95 4.95 0 1 1 0 9.9 4.95 4.95 0 0 1 0-9.9Zm0 1.8a3.15 3.15 0 1 0 0 6.3 3.15 3.15 0 0 0 0-6.3Zm5.3-3.4a1.15 1.15 0 1 1 0 2.3 1.15 1.15 0 0 1 0-2.3Z"/></svg>
          <span>{T.instagram}</span>
        </a>
        <a className="ss-btn ss-facebook" href="https://www.facebook.com/profile.php?id=61591483650900" target="_blank" rel="noopener noreferrer" title={T.facebook}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12.06C22 6.51 17.52 2 12 2S2 6.51 2 12.06c0 5.01 3.66 9.16 8.44 9.94v-7.03H7.9v-2.91h2.54V9.79c0-2.51 1.49-3.9 3.77-3.9 1.09 0 2.23.2 2.23.2v2.75h-1.26c-1.24 0-1.63.78-1.63 1.58v1.89h2.78l-.44 2.91h-2.34V22c4.78-.78 8.44-4.93 8.44-9.94Z"/></svg>
          <span>{T.facebook}</span>
        </a>
        <a className="ss-btn ss-naver" href="https://blog.naver.com/growthoptplaybook" target="_blank" rel="noopener noreferrer" title={T.naverBlog}>
          <span className="social-letter-icon" aria-hidden="true">N</span>
          <span>{T.naverBlog}</span>
        </a>
        </div>
      </details>
      {isHome && (
        <div className="home-sidebar-local">
          <b>LOCAL ONLY</b>
          <span>{T.localOnly}</span>
        </div>
      )}
    </aside>
  );
}
