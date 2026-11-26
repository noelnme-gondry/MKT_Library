"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppStore } from "@/store/useDataStore";
import { localizedHref } from "@/lib/localizedHref";
import { workspaceNavItem } from "@/lib/workspaceNav";
import { trackProductEvent } from "@/lib/analytics";
import { getDecisionReviewBucket } from "@/lib/decisionReview";
import BrandMark from "@/components/BrandMark";
import ModalDialog from "@/components/ds/ModalDialog";
import { setMobileNavigationOpen, useMobileNavigation } from "@/lib/mobileNavigation";

const collections = [
  { id: "tools", ko: "분석 도구", en: "Analysis tools", items: ["start", "diagnose"] },
  { id: "reading", ko: "블로그·자료실", en: "Blog & resources", items: ["blog", "guide", "calculator", "templates", "glossary", "compare"] },
  { id: "account", ko: "계정·데이터", en: "Account & data", items: ["account", "storage", "subscription"] },
];

const resources = {
  calculator: { ko: "마케팅 지표 계산기", en: "Marketing metric calculators" },
  templates: { ko: "템플릿·체크리스트", en: "Templates" },
  glossary: { ko: "용어사전", en: "Glossary" },
  compare: { ko: "마케팅 분석", en: "Marketing analysis" },
};

function destination(id, locale) {
  return workspaceNavItem(id, locale) ?? { id, href: `/${id}`, name: resources[id][locale] };
}

function SidebarContents({ locale = "ko", onNavigate }) {
  const english = locale === "en";
  const pathname = usePathname();
  const cleanPath = (pathname || "/").replace(/^\/en(?=\/|$)/, "") || "/";
  const current = ({ href }) => cleanPath === href || cleanPath.startsWith(`${href}/`);
  const decisionRecords = useAppStore((state) => state.decisionRecords);
  const dueDecisionCount = decisionRecords.reduce((count, record) => {
    const bucket = getDecisionReviewBucket(record);
    return count + (bucket === "overdue" || bucket === "today" ? 1 : 0);
  }, 0);

  function renderLink(item) {
    const planner = item.id === "operations";
    const review = item.id === "review";
    const due = review && dueDecisionCount > 0
      ? (english ? `${dueDecisionCount} due now` : `지금 검토할 결정 ${dueDecisionCount}건`) : "";
    return <Link key={item.id} href={localizedHref(item.href, locale)}
      className={planner ? "rail-planner" : "rail-link"}
      aria-current={current(item) ? "page" : undefined}
      aria-label={due ? `${item.name}, ${due}` : undefined}
      onClick={review ? (event) => {
        if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey)
          trackProductEvent("review_entry_clicked", { source: "navigation", placement: "sidebar", locale });
      } : undefined}>
      <strong>{item.name}</strong>
      {planner && <span>{english ? "Diagnose campaigns from a CSV" : "CSV로 캠페인 효율 진단"}</span>}
      {due && <b className="library-nav-item__count">{dueDecisionCount}</b>}
    </Link>;
  }

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

      <nav className="sidebar-primary-nav library-nav planner-rail" aria-label={english ? "Workspace navigation" : "워크스페이스 메뉴"}>
        {renderLink(destination("operations", locale))}
        {renderLink(destination("review", locale))}
        <div className="rail-collections">
          {collections.map((group) => {
            const items = group.items.map((id) => destination(id, locale));
            return <details key={`${group.id}:${cleanPath}`} open={items.some(current)}>
              <summary>{group[locale]}</summary>
              {items.map(renderLink)}
            </details>;
          })}
        </div>
      </nav>
    </aside>
  );
}


export default function Sidebar({ locale = "ko" }) {
  const pathname = usePathname();
  const { isMobile, isOpen } = useMobileNavigation();
  // Mobile openness is temporary; desktop collapse preferences are never changed.
  useEffect(() => {
    setMobileNavigationOpen(false);
    return () => setMobileNavigationOpen(false);
  }, [pathname, isMobile]);
  if (!isMobile) return <SidebarContents locale={locale} />;
  return <ModalDialog open={isOpen} onClose={() => setMobileNavigationOpen(false)}
    ariaLabel={locale === "en" ? "Site navigation" : "사이트 메뉴"}
    overlayClassName="library-nav-overlay" panelClassName="library-nav-dialog">
    <SidebarContents locale={locale} onNavigate={() => setMobileNavigationOpen(false)} />
  </ModalDialog>;
}
