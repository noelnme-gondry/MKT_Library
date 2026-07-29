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
          <span>START HERE</span>
          <h2 id="dashboard-recommendations-title">{tr("이 데이터에서 먼저 볼 3가지", "Start with these 3 views")}</h2>
        </div>
        <p>{label}</p>
      </div>
      <div className="dashboard-recommendations__grid">
        {recommendations.map((item) => (
          <button key={item.tab} type="button" className="dashboard-recommendation" onClick={() => onSelect?.(item)}>
            <span className="dashboard-recommendation__rank">0{item.rank}</span>
            <span className="dashboard-recommendation__content">
              <span className="dashboard-recommendation__topline"><strong>{item.title}</strong><em>{item.confidenceLabel}</em></span>
              <span>{item.reason}</span>
            </span>
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        ))}
      </div>
      {additional.length > 0 && (
        <details className="dashboard-recommendations__more">
          <summary><ListTree size={14} aria-hidden="true" /> {tr("나머지 탭도 직접 보기", "See the other views")}</summary>
          <div>{additional.map((item) => <button key={item.tab} type="button" onClick={() => onSelect?.(item)}>{item.title}</button>)}</div>
        </details>
      )}
    </section>
  );
}
