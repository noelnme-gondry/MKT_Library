"use client";
import React from "react";
import { ChevronRight, ListTree } from "lucide-react";

export default function DashboardRecommendedViews({ recommendations = [], additional = [], label, locale = "ko", onSelect }) {
  const tr = (ko, en) => (locale === "en" ? en : ko);
  if (!recommendations.length) return null;
  return (
    <section className="dashboard-recommendations" aria-labelledby="dashboard-recommendations-title">
      <div className="dashboard-recommendations__heading">
        <div>
          <h2 id="dashboard-recommendations-title">{tr("이어서 확인할 분석", "Recommended next analyses")}</h2>
        </div>
        <p>{label}</p>
      </div>
      <div className="dashboard-recommendations__grid">
        {recommendations.map((item) => (
          <button key={item.tab} type="button" className="dashboard-recommendation" onClick={() => onSelect?.(item)} aria-label={tr(`${item.title} 열기`, `Open ${item.title}`)}>
            {/* 순서 번호·"신뢰도 높음" 알약은 뺐다(2026-11-06) — 목록 순서가 곧 우선순위이고,
                신뢰도는 기준을 통과한 뷰만 오므로 낮을 때만 글자로 말한다. */}
            <span className="dashboard-recommendation__content">
              <strong>{item.title}</strong>
              <span>{item.reason}</span>
              {item.confidence && item.confidence !== "high" && <small className="dashboard-recommendation__confidence">{item.confidenceLabel}</small>}
            </span>
            <span className="dashboard-recommendation__open">{tr("열기", "Open")} <ChevronRight size={15} aria-hidden="true" /></span>
          </button>
        ))}
      </div>
      {additional.length > 0 && (
        <section data-information-section="" className="dashboard-recommendations__more">
          <header data-information-heading=""><ListTree size={14} aria-hidden="true" /> {tr("나머지 탭도 직접 보기", "See the other views")}</header>
          <div>{additional.map((item) => <button key={item.tab} type="button" onClick={() => onSelect?.(item)}>{item.title}</button>)}</div>
        </section>
      )}
    </section>
  );
}
