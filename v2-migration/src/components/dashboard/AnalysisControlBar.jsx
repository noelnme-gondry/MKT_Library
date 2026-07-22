"use client";
import React from "react";

/**
 * 분석 범위·표시 기준처럼 결과 전체에 영향을 주는 제어를 한곳에 모은다.
 * 도구별 분석 조건은 본문에 남기고, sticky 영역은 데이터 범위만 담당한다.
 */
export default function AnalysisControlBar({ title, activeCount = 0, hint, children }) {
  return (
    <section className="analysis-control-bar" aria-label={title}>
      <div className="analysis-control-bar__heading">
        <span className="analysis-control-bar__title">{title}</span>
        {activeCount > 0 && <span className="analysis-control-bar__count">{activeCount}</span>}
        {hint && <span className="analysis-control-bar__hint">{hint}</span>}
      </div>
      <div className="analysis-control-bar__controls">{children}</div>
    </section>
  );
}
