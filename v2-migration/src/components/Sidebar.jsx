"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppStore, IA, SECTIONS, displayGroupNumberShort, displayItemNumberShort } from "@/store/useDataStore";
import { idToSlug, resolveSlugToId } from "@/lib/routeMap";

export default function Sidebar() {
  // Active id is derived from the URL (SSOT) so highlight is correct even before
  // the page-level store-sync effect runs (avoids a first-paint race).
  const pathname = usePathname();
  const currentRouteId =
    resolveSlugToId((pathname || "/").split("/").filter(Boolean)) ?? "home";
  const setCmdkOpen = useAppStore((state) => state.setCmdkOpen);

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
        href="/"
        className="brand"
        id="brand"
        style={{ cursor: "pointer", textDecoration: "none", color: "inherit" }}
      >
        <div className="brand-mark">GO</div>
        <div>
          <div className="brand-name">Growth Ops</div>
          <div className="brand-sub">Playbook</div>
        </div>
      </Link>

      <div className="sidebar-search" onClick={() => setCmdkOpen(true)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input type="text" placeholder="가이드·파라미터·코드 검색…" readOnly />
        <kbd>⌘K</kbd>
      </div>

      <nav id="nav" data-rendered="1">
        {SECTIONS.map((section) => {
          const sectionGroups = IA.filter((g) => section.groups.includes(g.id));
          const sectionHasActive = sectionGroups.some((g) =>
            g.items.some((it) => it.id === currentRouteId)
          );

          // If it hasn't been explicitly toggled, use the derived state
          const isSectionCollapsed = collapsedSections[section.id] !== undefined
            ? collapsedSections[section.id]
            : !sectionHasActive;

          return (
            <section
              key={section.id}
              className={`phase-section ${isSectionCollapsed ? "collapsed" : ""}`}
              data-section={section.id}
            >
              <button
                className="phase-header"
                type="button"
                onClick={() => toggleSection(section.id, isSectionCollapsed)}
                aria-expanded={!isSectionCollapsed}
              >
                <span className="phase-header-left">
                  <span className="phase-tag">{section.label}</span>
                </span>
                <svg className="phase-chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>

              <div className="phase-body">
                {sectionGroups.map((group) => {
                  const hasActive = group.items.some((it) => it.id === currentRouteId);
                  const isGroupCollapsed = collapsedGroups[group.id] !== undefined
                    ? collapsedGroups[group.id]
                    : !hasActive;

                  return (
                    <div key={group.id} className={`nav-group ${isGroupCollapsed ? "collapsed" : ""}`} data-group={group.id}>
                      <div
                        className="nav-group-header"
                        onClick={() => toggleGroup(group.id, isGroupCollapsed)}
                      >
                        <span className="nav-group-title">
                          <span className="nav-group-index">{displayGroupNumberShort(group.id)}</span>
                          <span>{group.title}</span>
                        </span>
                        <svg className="chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                      </div>
                      <div className="nav-items">
                        {group.items.map((it) => (
                          <Link
                            key={it.id}
                            href={idToSlug[it.id] || "/"}
                            className={`nav-item ${it.id === currentRouteId ? "active" : ""}`}
                            data-route={it.id}
                          >
                            <span className="ix tnum">{displayItemNumberShort(it.id)}</span>
                            <span>{it.title}</span>
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

      <div className="sidebar-social">
        <a className="ss-btn ss-youtube" href="https://youtube.com/channel/UCvRcpOHOqvSHQPNbgZdPNUw/" target="_blank" rel="noopener noreferrer" title="유튜브">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M23.5 6.2a3 3 0 0 0-2.11-2.12C19.44 3.5 12 3.5 12 3.5s-7.44 0-9.39.58A3 3 0 0 0 .5 6.2 31.6 31.6 0 0 0 0 12a31.6 31.6 0 0 0 .5 5.8 3 3 0 0 0 2.11 2.12C4.56 20.5 12 20.5 12 20.5s7.44 0 9.39-.58a3 3 0 0 0 2.11-2.12A31.6 31.6 0 0 0 24 12a31.6 31.6 0 0 0-.5-5.8ZM9.6 15.6V8.4L15.8 12Z"/></svg>
          <span>유튜브</span>
        </a>
        <a className="ss-btn ss-instagram" href="https://www.instagram.com/gondry__workshop/" target="_blank" rel="noopener noreferrer" title="인스타그램">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.2c3.2 0 3.6 0 4.85.07 1.17.06 1.97.24 2.43.42a4.9 4.9 0 0 1 1.77 1.15 4.9 4.9 0 0 1 1.15 1.77c.18.46.36 1.26.42 2.43.06 1.25.07 1.65.07 4.85s0 3.6-.07 4.85c-.06 1.17-.24 1.97-.42 2.43a4.9 4.9 0 0 1-1.15 1.77 4.9 4.9 0 0 1-1.77 1.15c-.46.18-1.26.36-2.43.42-1.25.06-1.65.07-4.85.07s-3.6 0-4.85-.07c-1.17-.06-1.97-.24-2.43-.42a4.9 4.9 0 0 1-1.77-1.15 4.9 4.9 0 0 1-1.15-1.77c-.18-.46-.36-1.26-.42-2.43C2.2 15.6 2.2 15.2 2.2 12s0-3.6.07-4.85c.06-1.17.24-1.97.42-2.43A4.9 4.9 0 0 1 3.84 3c.53-.5 1.12-.9 1.77-1.15.46-.18 1.26-.36 2.43-.42C9.29 1.37 9.69 2.2 12 2.2Zm0 1.8c-3.15 0-3.52 0-4.75.06-.96.05-1.48.2-1.82.34a3.1 3.1 0 0 0-1.15.75 3.1 3.1 0 0 0-.75 1.15c-.14.34-.29.86-.34 1.82-.06 1.23-.06 1.6-.06 4.75s0 3.52.06 4.75c.05.96.2 1.48.34 1.82.16.42.38.79.75 1.15.36.36.73.6 1.15.75.34.14.86.29 1.82.34 1.23.06 1.6.06 4.75.06s3.52 0 4.75-.06c.96-.05 1.48-.2 1.82-.34.42-.16.79-.38 1.15-.75.36-.36.6-.73.75-1.15.14-.34.29-.86.34-1.82.06-1.23.06-1.6.06-4.75s0-3.52-.06-4.75c-.05-.96-.2-1.48-.34-1.82a3.1 3.1 0 0 0-.75-1.15 3.1 3.1 0 0 0-1.15-.75c-.34-.14-.86-.29-1.82-.34C15.52 4 15.15 4 12 4Zm0 3.05a4.95 4.95 0 1 1 0 9.9 4.95 4.95 0 0 1 0-9.9Zm0 1.8a3.15 3.15 0 1 0 0 6.3 3.15 3.15 0 0 0 0-6.3Zm5.3-3.4a1.15 1.15 0 1 1 0 2.3 1.15 1.15 0 0 1 0-2.3Z"/></svg>
          <span>인스타</span>
        </a>
        <a className="ss-btn ss-facebook" href="https://www.facebook.com/profile.php?id=61591483650900" target="_blank" rel="noopener noreferrer" title="페이스북">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12.06C22 6.51 17.52 2 12 2S2 6.51 2 12.06c0 5.01 3.66 9.16 8.44 9.94v-7.03H7.9v-2.91h2.54V9.79c0-2.51 1.49-3.9 3.77-3.9 1.09 0 2.23.2 2.23.2v2.75h-1.26c-1.24 0-1.63.78-1.63 1.58v1.89h2.78l-.44 2.91h-2.34V22c4.78-.78 8.44-4.93 8.44-9.94Z"/></svg>
          <span>페북</span>
        </a>
        <a className="ss-btn ss-feedback" href="https://forms.gle/vxTfmt6HmxwNnWb99" target="_blank" rel="noopener noreferrer" title="1분 설문">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>
          <span>설문</span>
        </a>
      </div>
    </aside>
  );
}
