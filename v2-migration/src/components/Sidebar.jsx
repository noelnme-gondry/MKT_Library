"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppStore, IA, SECTIONS, displayGroupNumberShort, displayItemNumberShort, findMeta } from "@/store/useDataStore";
import { idToSlug, resolvePathToId, hasEnVersion } from "@/lib/routeMap";
import { trGroupTitle, trItemTitle, trSectionLabel } from "@/lib/enNavCopy";
import { localizedHref } from "@/lib/localizedHref";
import { workspaceNavItems } from "@/lib/workspaceNav";
import { PUBLISHED_TOOL_IDS } from "@/lib/toolIndex";
import { TOOL_JOURNEY, localizedTool } from "@/lib/toolConnections";
import { getDecisionReviewBucket } from "@/lib/decisionReview";
import BrandMark from "@/components/BrandMark";

const SIDEBAR_COPY = {
  ko: {
    searchPlaceholder: "작업·도구·가이드 검색…",
    blog: "블로그",
    guide: "운영 가이드",
    calculators: "마케팅 지표 계산기",
    templates: "템플릿·체크리스트",
    glossary: "용어사전",
    compare: "방법 비교",
    youtube: "유튜브",
    instagram: "인스타",
    facebook: "페북",
    naverBlog: "네이버 블로그",
    resourceLabel: "자료실",
    workspaceLabel: "DECISION WORKSPACE",
    allTools: "할 수 있는 분석 전체 →",
    allToolsTitle: "할 수 있는 분석",
    allToolsDesc: (count) => `${count}개를 판단 단계별로 보기`,
    reviewAria: (count, name = "지난 결정") => `${name}${count ? `, 지금 검토할 결정 ${count}건` : ""}`,
    reviewDue: (count) => `검토 대기 ${count}건`,
    workflow: "연결된 분석 흐름",
    dataGuide: "데이터 준비",
    insights: "실무 인사이트",
    localOnly: "업로드한 데이터는 이 브라우저 안에서만 처리됩니다.",
  },
  en: {
    searchPlaceholder: "Search tasks, tools, guides…",
    blog: "Blog",
    guide: "Operating Guide",
    calculators: "Marketing metric calculators",
    templates: "Templates",
    glossary: "Glossary",
    compare: "Method comparisons",
    resourceLabel: "Library",
    youtube: "YouTube",
    instagram: "Instagram",
    facebook: "Facebook",
    naverBlog: "Naver Blog",
    workspaceLabel: "DECISION WORKSPACE",
    allTools: "Every analysis →",
    allToolsTitle: "Every analysis",
    allToolsDesc: (count) => `All ${count}, grouped by decision`,
    reviewAria: (count, name = "Past decisions") => `${name}${count ? `, ${count} decision${count === 1 ? "" : "s"} due now` : ""}`,
    reviewDue: (count) => `${count} due now`,
    workflow: "Connected workflow",
    dataGuide: "Prepare data",
    insights: "Practical insights",
    localOnly: "Uploaded data is processed only in this browser.",
  },
};

export default function Sidebar({ locale = "ko" }) {
  const T = SIDEBAR_COPY[locale] || SIDEBAR_COPY.ko;
  // 개수를 손으로 적으면 도구가 늘 때 이 줄만 낡는다 — 레지스트리에서 센다(§7).
  const allToolsDesc = T.allToolsDesc(PUBLISHED_TOOL_IDS.length);
  // 번역된 항목만 /en 유지, 나머지는 KR 페이지로(반쪽 번역 노출 방지 — §plan).
  const navHref = (id) =>
    locale === "en" && hasEnVersion(id) ? `/en${idToSlug[id] || ""}` : idToSlug[id] || "/";
  // Active id is derived from the URL (SSOT) so highlight is correct even before
  // the page-level store-sync effect runs (avoids a first-paint race).
  const pathname = usePathname();
  const currentRouteId = resolvePathToId(pathname) ?? "home";
  const cleanPath = (pathname || "/").replace(/^\/en(?=\/|$)/, "") || "/";
  const isHome = cleanPath === "/";
  const isStart = cleanPath === "/start";
  const isCalculator = cleanPath === "/calculator" || cleanPath.startsWith("/calculator/");
  const isDiagnose = cleanPath === "/diagnose";
  const isWeeklyReview = cleanPath === "/weekly-review";
  const isLibraryRoute = /^\/(blog|guide|templates|glossary|compare)(\/|$)/.test(cleanPath);
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
            {workspaceNavItems(locale).map((item) => {
              const isReview = item.id === "review";
              const isActive = item.id === "home";
              return (
                <Link
                  key={item.id}
                  href={localizedHref(item.href, locale)}
                  className={`home-sidebar-nav__item${isActive ? " active" : ""}${isReview ? " home-sidebar-nav__item--review" : ""}`}
                  aria-current={isActive ? "page" : undefined}
                  aria-label={isReview ? T.reviewAria(dueDecisionCount, item.name) : `${item.name}: ${item.desc}`}
                  data-due={isReview && dueDecisionCount > 0 ? "true" : undefined}
                >
                  <span className="home-sidebar-nav__icon" aria-hidden="true">{item.icon}</span>
                  <span className="home-sidebar-nav__copy"><strong>{item.name}</strong><em>{item.desc}</em></span>
                  {isReview && dueDecisionCount > 0 && <b aria-hidden="true">{dueDecisionCount}</b>}
                </Link>
              );
            })}
            {/* 홈 사이드바는 워크스페이스 네 줄만 그려서, 정작 홈에서 "무슨 분석이
                가능한지"를 볼 길이 없었다. 전체 목록으로 가는 줄을 여기에도 둔다. */}
            <Link href={localizedHref("/start", locale)} className="home-sidebar-nav__item home-sidebar-nav__item--all" aria-label={`${T.allToolsTitle}: ${allToolsDesc}`}>
              <span className="home-sidebar-nav__icon" aria-hidden="true">▦</span><span className="home-sidebar-nav__copy"><strong>{T.allToolsTitle}</strong><em>{allToolsDesc}</em></span>
            </Link>
          </nav>
        </div>
      ) : (
        <>
      {/* 홈 변형과 같은 SSOT를 쓴다 — 예전에는 두 변형이 각자 라벨을 들고 있어서
          한쪽만 고치면 어긋났고, 부제가 `NOW`·`DATA`·`DIAG`·`WEEK` 같은 암호였다.
          줄여 쓴 코드는 읽는 사람에게 아무것도 주지 않아 그 자리를 설명으로 바꿨다. */}
      <nav className="sidebar-primary-nav" aria-label={T.workspaceLabel}>
        {workspaceNavItems(locale).map((item) => {
          const isReview = item.id === "review";
          const isActive = (item.id === "start" && isStart)
            || (item.id === "diagnose" && isDiagnose)
            || (isReview && isWeeklyReview);
          const sub = isReview && dueDecisionCount > 0 ? T.reviewDue(dueDecisionCount) : item.desc;
          return (
            <Link
              key={item.id}
              href={localizedHref(item.href, locale)}
              className={`sidebar-primary-nav__item${isReview ? " sidebar-primary-nav__item--review" : ""}${isActive ? " active" : ""}`}
              aria-label={isReview ? T.reviewAria(dueDecisionCount, item.name) : `${item.name}: ${item.desc}`}
              aria-current={isActive ? "page" : undefined}
              data-due={isReview && dueDecisionCount > 0 ? "true" : undefined}
            >
              <span aria-hidden="true">{item.icon}</span>
              <strong>{item.name}</strong>
              <small aria-hidden="true">{sub}</small>
            </Link>
          );
        })}
      </nav>
      <div className="inner-workspace-label inner-workspace-label--stacked">
        <span>{T.workspaceLabel}</span>
        {/* 사이드바가 접혀 있으면 무엇을 할 수 있는지 볼 방법이 없었다. 접힘 여부와
            무관하게 전체 목록으로 가는 길을 상시 노출한다. */}
        <Link className="inner-workspace-label__all" href={localizedHref("/start", locale)}>{T.allTools}</Link>
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
                    </Link>
                    {TOOL_JOURNEY.map((stage) => {
                      const hasActive = stage.tools.includes(currentRouteId);
                      const stageKey = `journey-${stage.id}`;
                      // 활성 스테이지만 펼친다. 발견("무엇을 할 수 있나")은 이제 홈과
                      // /start의 인덱스가 맡으므로, 사이드바까지 전부 펴면 세션 중
                      // 이동용 내비가 벽이 된다(CSV 올린 화면에서 특히).
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
                                  {/* 도구 번호 칩 없음 — 스테이지 헤더(01~05)가 순서를 보여주고,
                                      IA 그룹 기준 번호는 이 계층과 축이 달라 어긋났다. */}
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

      {/* 라이브러리는 분석 흐름보다 한 단계 낮은 보조 문맥이다. 해당 리소스·계산기
          페이지에서만 펼치고, 홈과 도구 작업 중에는 접어 현재 판단 흐름을 우선한다. */}
      <details className="sidebar-library-disclosure" open={isLibraryRoute || isCalculator}>
        <summary className="sidebar-resource-label">
          <span>{T.resourceLabel}</span>
        </summary>
        <section className="sidebar-library" data-section="resources">
        <Link
          href={locale === "en" ? "/en/blog" : "/blog"}
          className="sidebar-library-link"
          aria-current={(pathname || "").includes("/blog") ? "page" : undefined}
        >
          <span><strong>{T.blog}</strong></span><b>↗</b>
        </Link>
        <Link
          href={locale === "en" ? "/en/calculator" : "/calculator"}
          className="sidebar-library-link"
          aria-current={isCalculator ? "page" : undefined}
        >
          <span><strong>{T.calculators}</strong></span><b>↗</b>
        </Link>
        <Link
          href={locale === "en" ? "/en/guide" : "/guide"}
          className="sidebar-library-link"
          aria-current={(pathname || "").includes("/guide") ? "page" : undefined}
        >
          <span><strong>{T.guide}</strong></span><b>↗</b>
        </Link>
        <Link
          href={locale === "en" ? "/en/templates" : "/templates"}
          className="sidebar-library-link"
          aria-current={(pathname || "").includes("/templates") ? "page" : undefined}
        >
          <span><strong>{T.templates}</strong></span><b>↗</b>
        </Link>
        <Link
          href={locale === "en" ? "/en/glossary" : "/glossary"}
          className="sidebar-library-link"
          aria-current={(pathname || "").includes("/glossary") ? "page" : undefined}
        >
          <span><strong>{T.glossary}</strong></span><b>↗</b>
        </Link>
        <Link
          href={locale === "en" ? "/en/compare" : "/compare"}
          className="sidebar-library-link"
          aria-current={(pathname || "").includes("/compare") ? "page" : undefined}
        >
          <span><strong>{T.compare}</strong></span><b>↗</b>
        </Link>
        </section>
      </details>

      {isHome && (
        <div className="home-sidebar-local">
          <span>{T.localOnly}</span>
        </div>
      )}
    </aside>
  );
}
