"use client";

import { useRef } from "react";
import { FigureHead } from "@/components/ds/FigurePngButton";
import { allocationDistribution } from "@/lib/analysis-results/allocationPresentation";

export default function AllocationDistribution({ rows, locale = "ko", embedded = false, controls, scopeLabel, hidden = false }) {
  const en = locale === "en";
  const target = useRef(null);
  const groups = allocationDistribution(rows);
  const title = en ? "How does the budget split change?" : "배분 후 비중은 어떻게 바뀌나?";
  return <section hidden={hidden} className={embedded ? "allocation-distribution-section" : "block"} id="s-bar">
    <FigureHead level={embedded ? 3 : 2} title={title} target={target} fileName="budget_share" locale={locale} />
    {controls}
    <figure className="allocation-distribution" ref={target} aria-label={title}>
      {scopeLabel && <strong className="allocation-chart-scope">{en ? "Countries" : "표시 국가"}: {scopeLabel}</strong>}
      {!rows.length && <p className="allocation-chart-empty">{en ? "Select a country to display." : "표시할 국가를 선택하세요."}</p>}
      <figcaption>{en ? "Each plan’s total within the selected countries is 100%. OS are combined for the same channel when available." : "선택 국가 안에서 현재·변경안 각각의 합계를 100%로 봅니다. 같은 채널의 OS는 합쳐 비교합니다."}</figcaption>
      <ul>{groups.map(row => <li key={row.entity}>
        <div className="allocation-distribution__name"><strong>{row.entity}</strong><span className="tnum">{row.currentShare != null && row.nextShare != null ? `${row.nextShare - row.currentShare >= 0 ? "+" : ""}${(row.nextShare - row.currentShare).toFixed(1)}%p` : "—"}</span></div>
        <div className="allocation-distribution__bars">{[["current", en ? "Current" : "현재", row.currentShare], ["next", en ? "Plan" : "변경안", row.nextShare]].map(([key, label, value]) => <div key={key} className={`is-${key}`}><span>{label}</span><div aria-hidden="true"><i style={{ width: `${value || 0}%` }} /></div><strong className="tnum">{value != null ? `${value.toFixed(1)}%` : "—"}</strong></div>)}</div>
      </li>)}</ul>
    </figure>
  </section>;
}
