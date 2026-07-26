"use client";
import React from "react";

/**
 * ToolPageShell — 5-x 분석 도구 공용 레이아웃 래퍼.
 *
 * 레거시 index.html의 `pageShell()` 중 5-x 분기(§4.1, CLAUDE.md)를 그대로
 * 미러링: page-sticky-bar(제목+칩+옵션 stickyFilter) + summary 콜아웃 +
 * children(본문) + 우측 플로팅 TOC. Dashboard.jsx가 이미 검증한 클래스/스타일
 * 값을 그대로 재사용(신규 스타일 발명 금지 — CLAUDE.md 지침).
 *
 * 순수 프레젠테이션 컴포넌트: store 구독·비즈니스 로직 없음.
 */
const COPY = {
  ko: { summaryLabel: "핵심 요약", toc: "목차" },
  en: { summaryLabel: "Summary", toc: "Contents" },
};

export default function ToolPageShell({ title, chips, summary, toc, stickyFilter, children, locale = "ko", toolId = "" }) {
  const T = COPY[locale] || COPY.ko;
  const tocItems = toc || [];
  const hasToc = tocItems.length > 0;

  return (
    <div className={`tool-page-shell${hasToc ? " has-toc" : ""}`} data-tool-id={toolId || undefined} aria-label={typeof title === "string" ? title : undefined}>
      {/* Main Content Area */}
      <div className="tool-page-shell__main">
        {/* Sticky title bar — legacy page-sticky-bar/page-sticky-row1/page-sticky-title
            (index.html pageShell 5-x 분기, CLAUDE.md §4.1) */}
        <div className="page-sticky-bar">
          <div className="page-sticky-row1">
            <h1 className="page-sticky-title">{title}</h1>
            {chips}
          </div>
          {stickyFilter}
        </div>

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
        <aside className="tool-page-shell__toc">
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
