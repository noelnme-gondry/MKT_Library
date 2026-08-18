"use client";
import React, { useId } from "react";
import ToolBrief from "@/components/ds/ToolBrief";
import { toolIndexEntry } from "@/lib/toolIndex";

/**
 * ToolPageShell — 5-x 분석 도구 공용 레이아웃 래퍼.
 *
 * 레거시 index.html의 `pageShell()` 중 5-x 분기를 그대로
 * 미러링: page-sticky-bar(제목+칩+옵션 stickyFilter) + summary 콜아웃 +
 * children(본문) + 우측 플로팅 TOC. 기존 page-sticky 클래스는 호환용으로
 * 유지하고, tool-instrument-header 계약으로 모든 도구의 제목·상태·범위를
 * 같은 시각 구조에 배치한다.
 *
 * 순수 프레젠테이션 컴포넌트: store 구독·비즈니스 로직 없음.
 */
const COPY = {
  ko: { summaryLabel: "핵심 요약", toc: "목차", workspace: "의사결정 작업대" },
  en: { summaryLabel: "Summary", toc: "Contents", workspace: "DECISION WORKSPACE" },
};

export default function ToolPageShell({ title, chips, summary, toc, stickyFilter, children, locale = "ko", toolId = "", titleLevel = 1 }) {
  const T = COPY[locale] || COPY.ko;
  // 도구 이름의 SSOT는 스토어 IA다. 컴포넌트가 제목을 직접 넘기면 리네임 때
  // 두 곳이 갈린다 — toolId가 있으면 레지스트리 이름이 이긴다.
  const registered = toolId ? toolIndexEntry(toolId, locale) : null;
  const resolvedTitle = registered?.name || title;
  const tocItems = toc || [];
  const hasToc = tocItems.length > 0;
  const titleId = useId();
  const TitleTag = titleLevel === 2 ? "h2" : "h1";
  const hasTitle = Boolean(resolvedTitle && titleLevel !== 0);
  const hasHeader = hasTitle || Boolean(chips) || Boolean(stickyFilter);

  return (
    <div className={`tool-page-shell${hasToc ? " has-toc" : ""}`} data-tool-id={toolId || undefined} aria-labelledby={hasTitle && typeof resolvedTitle === "string" ? titleId : undefined}>
      {/* Main Content Area */}
      <div className="tool-page-shell__main">
        {/* Sticky title bar — legacy page-sticky-bar/page-sticky-row1/page-sticky-title
            (index.html pageShell 5-x 분기 이관) */}
        {hasHeader && <header className="page-sticky-bar tool-instrument-header tool-instrument-header--sticky">
          <div className="page-sticky-row1">
            {hasTitle && (
              <div className="tool-instrument-header__heading">
                <span className="tool-instrument-header__eyebrow">{T.workspace}</span>
                <TitleTag id={titleId} className="page-sticky-title tool-instrument-header__title">{resolvedTitle}</TitleTag>
              </div>
            )}
            {chips && <div className="tool-instrument-header__status">{chips}</div>}
          </div>
          {stickyFilter && <div className="tool-instrument-header__controls">{stickyFilter}</div>}
        </header>}

        {toolId && <ToolBrief toolId={toolId} locale={locale} />}

        {/* Summary callout — .summary/.summary-label (globals.css, MarketingEfficiency.jsx 패턴 재사용) */}
        {summary && (
          <div className="summary">
            <div className="summary-label">{T.summaryLabel}</div>
            {summary}
          </div>
        )}

        {children}
      </div>

      {/* Floating Table of Contents (Right Side) — Dashboard.jsx 우측 TOC aside와 동일 마크업/포지셔닝 */}
      {hasToc && (
        <aside className="tool-page-shell__toc" aria-label={T.toc}>
          <div className="tool-page-shell__toc-label">
            {T.toc}
          </div>
          {tocItems.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className="tool-page-shell__toc-link"
            >
              {item.title}
            </a>
          ))}
        </aside>
      )}
    </div>
  );
}
