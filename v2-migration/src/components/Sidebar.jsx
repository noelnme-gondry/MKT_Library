"use client";

import React, { Suspense, useEffect } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useAppStore } from "@/store/useDataStore";
import { localizedHref } from "@/lib/localizedHref";
import { WORKSPACE_NAV_GROUPS, workspaceNavItems } from "@/lib/workspaceNav";
import { trackProductEvent } from "@/lib/analytics";
import { getDecisionReviewBucket } from "@/lib/decisionReview";
import BrandMark from "@/components/BrandMark";
import ModalDialog from "@/components/ds/ModalDialog";
import { setMobileNavigationOpen, useMobileNavigation } from "@/lib/mobileNavigation";

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
    workspaceLabel: "워크스페이스",
    allTools: "할 수 있는 분석 전체 →",
    allToolsTitle: "할 수 있는 분석",
    allToolsDesc: (count) => `${count}개를 판단 단계별로 보기`,
    reviewAria: (count, name = "내 프로젝트") => `${name}${count ? `, 지금 검토할 결정 ${count}건` : ""}`,
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
    workspaceLabel: "Workspace",
    allTools: "Every analysis →",
    allToolsTitle: "Every analysis",
    allToolsDesc: (count) => `All ${count}, grouped by decision`,
    reviewAria: (count, name = "My projects") => `${name}${count ? `, ${count} decision${count === 1 ? "" : "s"} due now` : ""}`,
    reviewDue: (count) => `${count} due now`,
    workflow: "Connected workflow",
    dataGuide: "Prepare data",
    insights: "Practical insights",
    localOnly: "Uploaded data is processed only in this browser.",
  },
};

function SidebarContents({ locale = "ko", onNavigate, isMethods = false }) {
  const T = SIDEBAR_COPY[locale] || SIDEBAR_COPY.ko;
  const pathname = usePathname();
  const cleanPath = (pathname || "/").replace(/^\/en(?=\/|$)/, "") || "/";
  const isCalculator = cleanPath === "/calculator" || cleanPath.startsWith("/calculator/");
  const decisionRecords = useAppStore((state) => state.decisionRecords);
  const dueDecisionCount = decisionRecords.reduce((count, record) => {
    const bucket = getDecisionReviewBucket(record);
    return count + (bucket === "overdue" || bucket === "today" ? 1 : 0);
  }, 0);

  return (
    <aside className="sidebar library-sidebar" id="sidebar" aria-label={locale === "en" ? "Site navigation" : "사이트 메뉴"} onClick={(event) => {
      if (event.target.closest("a") && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) onNavigate?.();
    }}>
      {onNavigate && <button className="library-sidebar-close" type="button" aria-label={locale === "en" ? "Close navigation" : "메뉴 닫기"} onClick={onNavigate}>×</button>}
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

      <nav className="sidebar-primary-nav library-nav" aria-label={locale === "en" ? "Library and workspace" : "라이브러리와 워크스페이스"}>
        {WORKSPACE_NAV_GROUPS.map((group) => <div className="library-nav-group" key={group.id}>
          <div className="library-nav-group__label">{group[locale === "en" ? "en" : "ko"]}</div>
          {workspaceNavItems(locale).filter((item) => item.group === group.id && !item.secondary).map((item) => {
            const isReview = item.id === "review";
            const isActive = (item.id === "methods" ? cleanPath === "/start" && isMethods : item.id === "start" ? cleanPath === "/start" && !isMethods : cleanPath === item.href) || (["blog", "guide"].includes(item.id) && cleanPath.startsWith(`${item.href}/`));
            return <Link key={item.id}
              href={localizedHref(item.href, locale)}
              className={`sidebar-primary-nav__item library-nav-item${isActive ? " active" : ""}`}
              aria-current={isActive ? "page" : undefined}
              aria-label={isReview ? T.reviewAria(dueDecisionCount, item.name) : `${item.name}: ${item.desc}`}
              title={item.desc}
              onClick={(event) => {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                if (isReview) trackProductEvent("review_entry_clicked", { source: "navigation", placement: "sidebar", locale });
              }}>
              <span className="library-nav-item__icon" aria-hidden="true">{item.icon}</span>
              <strong>{item.name}</strong>
              {isReview && dueDecisionCount > 0 && <b className="library-nav-item__count">{dueDecisionCount}</b>}
            </Link>;
          })}
        </div>)}
      </nav>
      {/* 라이브러리는 분석 흐름보다 한 단계 낮은 보조 문맥이다. 해당 리소스·계산기
          페이지에서만 펼치고, 홈과 도구 작업 중에는 접어 현재 판단 흐름을 우선한다. */}
      <section data-information-section="" className="sidebar-library-disclosure" >
        <header data-information-heading="" className="sidebar-resource-label">
          <span>{T.resourceLabel}</span>
        </header>
        <section className="sidebar-library" data-section="resources">
        <Link
          href={locale === "en" ? "/en/calculator" : "/calculator"}
          className="sidebar-library-link"
          aria-current={isCalculator ? "page" : undefined}
        >
          <span><strong>{T.calculators}</strong></span><b>↗</b>
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
      </section>

      <div className="home-sidebar-local"><span>{T.localOnly}</span></div>
    </aside>
  );
}


function QuerySidebar(props) {
  const isMethods = useSearchParams().get("view") === "methods";
  return <SidebarContents {...props} isMethods={isMethods} />;
}
function RoutedSidebar(props) {
  return <Suspense fallback={<SidebarContents {...props} />}><QuerySidebar {...props} /></Suspense>;
}

export default function Sidebar({ locale = "ko" }) {
  const pathname = usePathname();
  const { isMobile, isOpen } = useMobileNavigation();
  // Mobile openness is temporary; desktop collapse preferences are never changed.
  useEffect(() => {
    setMobileNavigationOpen(false);
    return () => setMobileNavigationOpen(false);
  }, [pathname, isMobile]);
  if (!isMobile) return <RoutedSidebar locale={locale} />;
  return <ModalDialog open={isOpen} onClose={() => setMobileNavigationOpen(false)}
    ariaLabel={locale === "en" ? "Site navigation" : "사이트 메뉴"}
    overlayClassName="library-nav-overlay" panelClassName="library-nav-dialog">
    <RoutedSidebar locale={locale} onNavigate={() => setMobileNavigationOpen(false)} />
  </ModalDialog>;
}
