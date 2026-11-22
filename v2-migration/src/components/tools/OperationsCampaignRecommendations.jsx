"use client";
import { useId, useRef } from "react";
import { fmtNum } from "@/utils/format";
import ResultChange from "@/components/ds/ResultChange";
import { OperationsCprScatter } from "./OperationsCharts";
import "./OperationsCampaignRecommendations.css";

export default function OperationsCampaignRecommendations({ brief, plan, rows, selected, onSelect, days, horizon, money, delta, countDelta, pct, metricName, outcomeName, locale, currency, isDemo }) {
  const tr = (ko, en) => locale === "en" ? en : ko;
  const entity = brief.unit === "campaign" ? tr("캠페인", "campaign") : tr("채널", "channel");
  const active = rows.find(row => row.id === selected);
  const panelId = useId();
  const heading = useRef(null);
  const table = useRef(null);
  const changes = rows.map(row => (row.allocation.budget - row.allocation.current) * days);
  const moved = changes.reduce((sum, value) => sum + Math.max(0, -value), 0);
  const largestChange = changes.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
  const periodLabel = horizon === "month" ? tr("다음 달", "next month") : tr(`다음 ${days}일`, `the next ${days} days`);
  const modeText = { maintain: tr("총예산 유지", "Fixed total"), increase: tr("총예산 증액", "Increased total"), decrease: tr("총예산 감액", "Reduced total") };
  const focusRow = index => table.current?.rows[index]?.querySelector("button")?.focus();
  function activate(row, event) {
    onSelect(row.id);
    const el = heading.current;
    if (!el) return;
    if (event.detail === 0) el.focus();
    else if (el.getBoundingClientRect().top >= window.innerHeight || el.getBoundingClientRect().bottom <= 0) el.scrollIntoView?.({ block: "start" });
  }
  function navigate(event, index) {
    const next = { ArrowDown: (index + 1) % rows.length, ArrowUp: (index + rows.length - 1) % rows.length, Home: 0, End: rows.length - 1 }[event.key];
    if (next == null) return;
    event.preventDefault();
    onSelect(rows[next].id);
    focusRow(next);
  }
  return <>
    <div className="ops-recommendation-summary">
      <div><h3 id="ops-plan-title">{plan.mode === "maintain" ? tr(`${periodLabel}에 옮길 예산`, `Budget to reallocate for ${periodLabel}`) : tr(`${periodLabel} 전체 예산`, `Total budget for ${periodLabel}`)}</h3>
        <strong>{money(plan.mode === "maintain" ? moved : plan.totalBudget * days)}</strong>
        <small>{modeText[plan.mode]} · {tr("변경 한도", "Change limit")} ±{Math.round(plan.changeLimit * 100)}%</small></div>
      <div><h3>{tr(`전체 예상 ${outcomeName} 증감`, `Change in projected ${outcomeName}`)}</h3>
        <ResultChange as="strong" value={plan.expectedResults}>{countDelta((plan.expectedResults - plan.baselineResults) * days)}{tr("건", "")}</ResultChange>
        <small>{fmtNum(plan.baselineResults * days)} → {fmtNum(plan.expectedResults * days)} (<span className="ops-recommendation-pct">{pct(plan.improvementPct)}</span>)</small></div>
      <div><h3>{tr(`예상 ${metricName}`, `Projected ${metricName}`)}</h3><strong>{money(plan.expectedCpr)}</strong><small>{tr("기준안", "Baseline")} {money(plan.baselineCpr)}</small></div>
    </div>
    <div className="ops-recommendation-layout">
      <div className="ops-recommendation-list"><h3>{tr(`${entity}별 추천 조정안`, `Recommended changes by ${entity}`)}</h3>
        <table className="data ops-recommendation-table" aria-label={tr(`${entity}별 예산과 예상 ${outcomeName}`, `Budget and projected ${outcomeName} by ${entity}`)}>
          <thead><tr><th scope="col">{entity}</th><th scope="col">{tr("예산 증감", "Budget change")}</th><th scope="col">{tr(`예상 ${outcomeName} 증감`, `Change in ${outcomeName}`)}<small>{tr("기준안 → 조정안", "Baseline → Plan")}</small></th></tr></thead>
          <tbody ref={table}>{rows.map((row, i) => {
            const { allocation } = row;
            const change = changes[i];
            const lift = (allocation.expectedResults - allocation.currentResults) * days;
            return <tr key={row.id} className={row.id === selected ? "is-selected" : undefined} onClick={event => activate(row, event)}>
              <th scope="row"><button className="ops-campaign-pick" type="button" aria-controls={panelId} aria-pressed={row.id === selected} onKeyDown={event => navigate(event, i)}>
                <span>{row.name}</span><small>{row.context}</small></button></th>
              <td><b>{delta(change)}</b><span className="ops-budget-bar" aria-hidden="true"><i className={change >= 0 ? "is-increase" : "is-decrease"} style={{ width: `${largestChange ? Math.abs(change) / largestChange * 50 : 0}%` }} /></span></td>
              <td><b>{countDelta(lift)}{tr("건", "")}</b><small>{fmtNum(allocation.currentResults * days)} → {fmtNum(allocation.expectedResults * days)}</small></td>
            </tr>;
          })}</tbody>
        </table>
        <p className="ops-forecast-rounding">{tr("예상 성과는 반올림 전 수치로 합산합니다. 각 행의 표시값을 더한 수치와 차이가 날 수 있습니다.", "Totals use unrounded forecasts and can differ from the sum of the displayed rows.")}</p>
      </div>
      {active && <div id={panelId} className="ops-campaign-proof" role="region" aria-labelledby={panelId + "-title"}>
        <h3 id={panelId + "-title"} ref={heading} tabIndex={-1}>{active.name} · {metricName}</h3>
        <div className="ops-proof-budgets"><span>{tr("현재 일평균 지출", "Current daily spend")} <b data-current-spend={active.allocation.current}>{money(active.allocation.current)}</b></span>
          <span>{tr("제안 일예산", "Proposed daily budget")} <b data-planned-spend={active.allocation.budget}>{money(active.allocation.budget)}</b></span></div>
        <OperationsCprScatter key={JSON.stringify([active.id, active.grain])} campaign={active} model={brief.models.get(active.id)} currentSpend={active.allocation.current} plannedSpend={active.allocation.budget} periods={brief.periods} {...{ metricName, currency, locale, isDemo }} compact />
        <button type="button" className="btn ghost ops-return-to-row" onClick={() => focusRow(rows.indexOf(active))}>{tr("선택한 행으로 돌아가기", "Back to selected row")}</button>
      </div>}
    </div>
  </>;
}
