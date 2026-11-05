"use client";
import { ArrowRight } from "lucide-react";
import DataTable from "@/components/ds/DataTable";
import ResultChange from "@/components/ds/ResultChange";
import { fmtNum } from "@/utils/format";
import { periodDays } from "@/lib/analysisPeriod";
import { operationsPlanRange } from "@/lib/operations/operationsScenario";

export default function OperationsPlanBoard({ brief, plan, options, onChange, money, pct, outcomeName, metricName, locale, holdMessages, onAction, selected, onSelect, busy }) {
  const tr = (ko, en) => locale === "en" ? en : ko;
  const range = plan.planRange || operationsPlanRange(brief.periods.current.end, options.horizon);
  const n = periodDays(range), hasBase = n > 0 && brief.campaigns.length > 0 && brief.campaigns.every(row => Number.isFinite(brief.currentSpends[row.id]));
  const base = hasBase ? Object.values(brief.currentSpends).reduce((a, b) => a + b, 0) * n : null;
  const rows = plan.items.map(item => ({ ...item, ...brief.campaigns.find(row => row.id === item.id), allocation: item })).sort((a, b) => (b.allocation.budget - b.allocation.current) - (a.allocation.budget - a.allocation.current));
  const changeMode = mode => onChange({ mode, targetTotal: mode === "maintain" || !hasBase ? null : Math.round(base * (mode === "increase" ? 1.1 : .9)) });
  const delta = value => `${value > 1e-6 ? "+" : value < -1e-6 ? "−" : ""}${money(Math.abs(value))}`;
  const direction = item => item.budget > item.current + 1e-6 ? "increase" : item.budget < item.current - 1e-6 ? "decrease" : "hold";
  const labels = { increase: tr("증액 · 성과 확대", "Increase · grow outcomes"), decrease: tr("감액 · 지출 축소", "Decrease · reduce spend"), hold: tr("예산 유지", "Keep budget") };
  const reduced = rows.filter(row => direction(row.allocation) === "decrease"), increased = rows.filter(row => direction(row.allocation) === "increase");
  const moved = reduced.reduce((sum, row) => sum + row.allocation.current - row.allocation.budget, 0) * n;
  const movementList = (items, label) => <div className="ops-transfer__side"><h4>{label}</h4>{items.length ? items.map(row => <button type="button" key={row.id} onClick={() => onSelect(row.id)} aria-pressed={selected === row.id} className="ops-transfer__item"><span><strong>{row.name}</strong><small>{row.context}</small></span><b data-direction={direction(row.allocation)}>{delta((row.allocation.budget - row.allocation.current) * n)}</b></button>) : <p>{tr("변경할 대상 없음", "No changes")}</p>}</div>;
  const controls = <div className="ops-plan-controls">
      <fieldset><legend>{tr("다음 예산을 어떻게 운영할까요?", "What should happen to the next budget?")}</legend><div className="ops-mode">{[["maintain", "유지·재배분", "Keep & reallocate"], ["increase", "증액", "Increase"], ["decrease", "감액", "Decrease"]].map(([id, ko, en]) => <button key={id} type="button" aria-pressed={options.mode === id} onClick={() => changeMode(id)}>{tr(ko, en)}</button>)}</div></fieldset>
      <label>{tr("적용 기간", "Plan period")}<select aria-label={tr("적용 기간", "Plan period")} aria-describedby="ops-plan-dates" value={options.horizon} onChange={event => {
        const horizon = event.target.value, nextDays = periodDays(operationsPlanRange(brief.periods.current.end, horizon));
        onChange({ horizon, targetTotal: options.targetTotal == null ? null : Math.round(options.targetTotal / n * nextDays) });
      }}><option value="week">{tr("다음 7일", "Next 7 days")}</option><option value="month">{tr("다음 달", "Next calendar month")}</option></select><small id="ops-plan-dates">{range.start} – {range.end} · {n}{tr("일", " days")}</small></label>
      <label>{tr("기간 전체 예산", "Total for this period")}<input type="text" inputMode="decimal" value={options.mode === "maintain" ? hasBase ? fmtNum(base) : "—" : options.targetTotal ?? ""} readOnly={options.mode === "maintain" || !hasBase} aria-label={tr("기간 전체 예산", "Total for this period")} onChange={event => onChange({ targetTotal: event.target.value.replaceAll(",", "") })} /><small>{tr("현재 지출 기준", "At current spending")} {money(base)}</small></label>
      <label>{tr("캠페인별 변경 한도", "Change limit per campaign")}<strong>±{Math.round(options.changeLimit * 100)}%</strong><input type="range" aria-label={tr("캠페인별 변경 한도", "Change limit per campaign")} min="0" max="30" step="5" value={options.changeLimit * 100} onChange={event => onChange({ changeLimit: Number(event.target.value) / 100 })} /></label>
    </div>;
  return <section className="ops-plan" aria-labelledby="ops-plan-title" aria-busy={busy}>
    {!plan.ok && controls}
    {!plan.ok ? <div className="ops-plan-held" role="status"><h3 id="ops-plan-title">{tr("이 조건에서는 예산 제안을 보류합니다", "No budget proposal under these conditions")}</h3>{holdMessages.map(message => <p key={message}>{message}</p>)}{Number.isFinite(plan.minTotal) && <p>{tr("설정할 수 있는 기간 총액", "Available total for the period")}: {money(plan.minTotal * n)} – {money(plan.maxTotal * n)}</p>}<p>{tr("아래 실제 성과와 변화 이력은 계속 확인할 수 있습니다.", "Observed performance and change history remain available below.")}</p></div> : <>
      <div className="ops-plan-summary">
        <div className="ops-plan-proposal"><span className="ops-section-label">{tr("추천 예산 액션", "Recommended budget actions")}</span><h3 id="ops-plan-title">{options.mode === "maintain" ? moved < 1e-6 ? tr("현재 캠페인별 예산을 유지하세요", "Keep the current campaign budgets") : tr(`${money(moved)}을 재배분하세요`, `Reallocate ${money(moved)}`) : options.mode === "increase" ? tr(`기간 예산을 ${money(plan.totalBudget * n)}으로 늘립니다`, `Increase the period budget to ${money(plan.totalBudget * n)}`) : tr(`기간 예산을 ${money(plan.totalBudget * n)}으로 줄입니다`, `Reduce the period budget to ${money(plan.totalBudget * n)}`)}</h3><p>{tr(`${n}일 총액 기준 · 캠페인을 누르면 아래 근거가 바뀝니다.`, `${n}-day totals · Select a campaign to inspect its evidence below.`)}</p>
          <div className={`ops-transfer${options.mode !== "maintain" ? " ops-transfer--single" : ""}`} style={{ "--transfer-rows": Math.max(1, options.mode === "maintain" ? Math.max(reduced.length, increased.length) : rows.length) }}>{options.mode === "maintain" ? <>{movementList(reduced, tr("줄일 곳", "Reduce"))}<ArrowRight className="ops-transfer__arrow" aria-hidden="true" />{movementList(increased, tr("늘릴 곳", "Increase"))}</> : movementList(rows, options.mode === "increase" ? tr("늘리거나 유지할 곳", "Increase or keep") : tr("줄이거나 유지할 곳", "Reduce or keep"))}</div>
        </div>
        <div className="ops-plan-outcome" data-design-exempt="eyebrow: Names the forecast metric and its unit beside the calculated value"><span className="ops-section-label">{tr("이 조정안의 예상 성과", "Expected outcomes with this plan")}</span><ResultChange value={plan.expectedResults} as="strong" className="ops-plan-impact">{pct(plan.improvementPct)}</ResultChange><p>{tr(`전체 ${outcomeName}`, `Total ${outcomeName}`)} · {fmtNum(plan.baselineResults * n)} → <b>{fmtNum(plan.expectedResults * n)}</b></p>
          <div className="ops-impact-list">{rows.map(row => <button key={row.id} type="button" aria-pressed={selected === row.id} onClick={() => onSelect(row.id)}><span>{row.name}</span><b>{row.allocation.expectedResults > row.allocation.currentResults ? "+" : ""}{fmtNum((row.allocation.expectedResults - row.allocation.currentResults) * n, 1)}</b></button>)}</div>
          <div className="ops-cost-outcome"><span>{tr(`전체 예상 ${metricName}`, `Overall predicted ${metricName}`)}</span><strong>{money(plan.baselineCpr)} → {money(plan.expectedCpr)}</strong></div>
        </div>
      </div>
      {controls}
      <div className="ops-plan-commit"><div><strong>{tr("예산안에서 실행과 검토까지", "From a budget plan to execution and review")}</strong><p>{tr("캠페인별 실행 금액을 확인하고, 실행일과 다음 검토를 기록하세요.", "Confirm each campaign amount, then record execution and the next review.")}</p></div><button type="button" className="btn primary" onClick={() => onAction("budget")}>{tr("예산 액션 정하기", "Plan budget actions")} <ArrowRight size={18} aria-hidden="true" /></button></div>
      <p className="ops-plan-note">{options.mode === "maintain" ? tr("현재 배분 유지안과 조정안을 동일 모형으로 비교합니다.", "The current allocation and revised plan use the same model.") : tr("총예산 변화와 배분 변화가 함께 반영된 예상입니다.", "The estimate includes both total-budget and allocation changes.")} {tr("최근 지출을 기준으로 계산하며 실제 예산 설정값과 다를 수 있습니다. 소재 변화·초기 학습의 효과를 분리한 예측은 아닙니다.", "Based on recent spending, which may differ from configured budgets. Creative changes and initial learning are not isolated.")}</p>
      <section className="ops-allocation" data-design-exempt="nested: Scrollable campaign table belongs to the executable allocation section" aria-labelledby="ops-allocation-title"><header><h3 id="ops-allocation-title">{tr("캠페인별 실행안과 예상 성과", "Campaign actions and expected outcomes")}</h3><span>{range.start} – {range.end} · {tr("기간 합계", "Period totals")}</span></header>
        <DataTable ariaLabel={tr("캠페인별 실행안", "Campaign action plan")} rows={rows} rowKey={row => row.id} columns={[
          { key: "name", label: tr("캠페인", "Campaign"), fmt: (value, row) => <button type="button" className="ops-entity-button" aria-pressed={selected === row.id} onClick={() => onSelect(row.id)}><strong>{value}</strong><small>{row.context}</small></button> },
          { key: "budget", label: tr("기간 예산 · 현재 → 조정안", "Period budget · current → plan"), align: "right", fmt: (_, row) => <span>{money(row.allocation.current * n)} → <b>{money(row.allocation.budget * n)}</b></span> },
          { key: "delta", label: tr("변경 금액", "Change"), align: "right", fmt: (_, row) => <strong data-direction={direction(row.allocation)}>{delta((row.allocation.budget - row.allocation.current) * n)}<small>{pct((row.allocation.budget / row.allocation.current - 1) * 100)}</small></strong> },
          { key: "outcomes", label: tr(`예상 ${outcomeName}`, `Expected ${outcomeName}`), align: "right", fmt: (_, row) => <span>{fmtNum(row.allocation.currentResults * n)} → <b>{fmtNum(row.allocation.expectedResults * n)}</b></span> },
          { key: "cpr", label: tr(`예상 ${metricName}`, `Predicted ${metricName}`), align: "right", fmt: (_, row) => <span>{money(row.allocation.current / row.allocation.currentResults)} → <b>{money(row.allocation.expectedCpr)}</b></span> },
          { key: "action", label: tr("실행할 액션", "Action"), fmt: (_, row) => <button type="button" className="ops-action-label" data-direction={direction(row.allocation)} onClick={() => onAction(`budget:${row.id}`)}>{labels[direction(row.allocation)]}</button> },
        ]} />
        <p className="ops-plan-note">{tr("금액과 성과 수는 반올림해 표시하므로, 행을 더한 값과 전체 합계에 차이가 날 수 있습니다.", "Amounts and outcome counts are rounded for display, so visible rows may not add exactly to the total.")}</p>
      </section>
    </>}
  </section>;
}
