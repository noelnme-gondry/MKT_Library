"use client";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import DataTable from "@/components/ds/DataTable";
import { useAppStore } from "@/store/useDataStore";
import { matchesOperationsTarget } from "@/lib/operations/operationsIdentity";
import { defaultOperationsSelection, forecastOperationsSelection, isRecommendedSelection, pendingBudgetActions } from "@/lib/operations/operationsSelection";
import { CommaNumberInput } from "./marketingResponseModel";
import OperationsPlanSaveDialog from "./OperationsPlanSaveDialog";
import ResultChange from "@/components/ds/ResultChange";
import { fmtNum } from "@/utils/format";
import { periodDays } from "@/lib/analysisPeriod";
import { operationsPlanRange } from "@/lib/operations/operationsScenario";

export default function OperationsPlanBoard({ brief, plan, options, onChange, money, pct, outcomeName, metricName, locale, holdMessages, selected, onSelect, busy, metric, currency, isDemo, signals = [], today, sourceThrough }) {
  const tr = (ko, en) => locale === "en" ? en : ko;
  // 사람이 고른 실행안. 추천안이 다시 계산되면(조건 변경) 추천안으로 돌아간다 — 상태는 그 추천안에 묶여 있다.
  const [edits, setEdits] = useState({ plan: null, choices: null });
  const [saving, setSaving] = useState(false);
  const records = useAppStore(state => state.decisionRecords);
  const choices = edits.plan === plan && edits.choices ? edits.choices : defaultOperationsSelection(plan);
  const pending = isDemo ? new Map() : pendingBudgetActions(records, brief.campaigns, { metric, currency, matches: matchesOperationsTarget });
  // 이미 저장한 예산 액션이 진행 중인 캠페인은 다시 고르지 않는다(실행·검토는 아래 목록에서 이어 간다).
  const effective = Object.fromEntries(Object.entries(choices).map(([id, choice]) => [id, pending.has(id) ? { ...choice, selected: false } : choice]));
  const forecast = forecastOperationsSelection(brief, plan, effective);
  const recommended = isRecommendedSelection(plan, choices);
  const setChoice = (id, patch) => setEdits({ plan, choices: { ...choices, [id]: { ...choices[id], ...patch } } });
  const creativeAttention = new Set(signals.filter(signal => signal.needsAction).map(signal => signal.entityId));
  const range = plan.planRange || operationsPlanRange(brief.periods.current.end, options.horizon);
  const n = periodDays(range), hasBase = n > 0 && brief.campaigns.length > 0 && brief.campaigns.every(row => Number.isFinite(brief.currentSpends[row.id]));
  const base = hasBase ? Object.values(brief.currentSpends).reduce((a, b) => a + b, 0) * n : null;
  const rows = plan.items.map(item => ({ ...item, ...brief.campaigns.find(row => row.id === item.id), allocation: item })).sort((a, b) => (b.allocation.budget - b.allocation.current) - (a.allocation.budget - a.allocation.current));
  const changeMode = mode => onChange({ mode, targetTotal: mode === "maintain" || !hasBase ? null : Math.round(base * (mode === "increase" ? 1.1 : .9)) });
  const delta = value => `${value > 1e-6 ? "+" : value < -1e-6 ? "−" : ""}${money(Math.abs(value))}`;
  // 모형 성과는 소수로 나오지만 설치·가입은 정수로 읽는다. 표시만 반올림하고 0으로 접히면 부호를 붙이지 않는다.
  const countDelta = value => { const rounded = Math.round(value); return `${rounded > 0 ? "+" : rounded < 0 ? "−" : ""}${fmtNum(Math.abs(rounded))}`; };
  const direction = item => item.budget > item.current + 1e-6 ? "increase" : item.budget < item.current - 1e-6 ? "decrease" : "hold";
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
          <div className="ops-impact-list">{rows.map(row => <button key={row.id} type="button" aria-pressed={selected === row.id} onClick={() => onSelect(row.id)}><span>{row.name}</span><b>{countDelta((row.allocation.expectedResults - row.allocation.currentResults) * n)}</b></button>)}</div>
          <div className="ops-cost-outcome"><span>{tr(`전체 예상 ${metricName}`, `Overall predicted ${metricName}`)}</span><strong>{money(plan.baselineCpr)} → {money(plan.expectedCpr)}</strong></div>
        </div>
      </div>
      {controls}
      <section className="ops-allocation" data-design-exempt="nested: The campaign table belongs to the plan selection section" aria-labelledby="ops-allocation-title"><header><div><h3 id="ops-allocation-title">{tr("실행할 액션 고르기", "Choose the actions to run")}</h3><p>{tr("추천안을 미리 골라 두었습니다. 실행할 캠페인과 기간 예산을 바꾸면 같은 모형으로 예상 성과를 다시 계산합니다.", "The recommendation is preselected. Change the campaigns or period budgets to recalculate expected outcomes with the same model.")}</p></div><span>{range.start} – {range.end} · {tr("기간 합계", "Period totals")}</span></header>
        <div className="ops-selection" aria-live="polite">
          {forecast.ok ? <dl className="ops-selection__totals">
            <div><dt>{tr("고른 변경", "Selected changes")}</dt><dd><b>{tr(`${forecast.changed.length}건`, `${forecast.changed.length}`)}</b></dd></div>
            <div><dt>{tr("기간 예산", "Period budget")}</dt><dd>{money(forecast.totals.currentSpend * n)} → <b>{money(forecast.totals.spend * n)}</b><small>{delta((forecast.totals.spend - forecast.totals.currentSpend) * n)}</small></dd></div>
            <div><dt>{tr(`예상 ${outcomeName}`, `Expected ${outcomeName}`)}</dt><dd>{fmtNum(forecast.totals.baselineResults * n)} → <b>{fmtNum(forecast.totals.expectedResults * n)}</b><small>{pct(forecast.totals.resultsChangePct)}</small></dd></div>
            <div><dt>{tr(`예상 ${metricName}`, `Expected ${metricName}`)}</dt><dd>{money(forecast.totals.baselineCpr)} → <b>{money(forecast.totals.expectedCpr)}</b></dd></div>
          </dl> : <p role="alert">{tr("관측한 지출 범위를 벗어난 금액이 있어 합계를 예측하지 않습니다. 표시된 범위 안으로 바꿔 주세요.", "Some amounts are outside the observed spend range, so totals are not forecast. Use an amount within the range shown.")}</p>}
          <div className="ops-selection__actions">
            {!recommended && <button type="button" className="btn ghost" onClick={() => setEdits({ plan: null, choices: null })}>{tr("추천안으로 되돌리기", "Reset to recommendation")}</button>}
            <button type="button" className="btn primary" disabled={!forecast.ok || !forecast.changed.length} onClick={() => setSaving(true)}>{tr(`선택한 계획 저장 · ${forecast.changed.length}건`, `Save selected plan · ${forecast.changed.length}`)}</button>
          </div>
        </div>
        <DataTable ariaLabel={tr("실행할 액션과 예상 성과", "Actions to run and expected outcomes")} rows={rows} rowKey={row => row.id} columns={[
          { key: "name", label: tr("실행 · 캠페인", "Run · campaign"), fmt: (value, row) => { const item = forecast.items.find(entry => entry.id === row.id), saved = pending.get(row.id);
            return <label className="ops-select-row"><input type="checkbox" checked={item.selected} disabled={!!saved} onChange={event => setChoice(row.id, { selected: event.target.checked })} aria-label={tr(`${value} 실행에 포함`, `Include ${value}`)} />
              <span><strong>{value}</strong><small>{row.context}</small>
                {(saved || creativeAttention.has(row.id)) && <span className="ops-chips">{saved && <span className="ops-chip ops-chip--ok">{saved.action.state === "executed" ? tr("저장됨 · 실행 후 관찰 중", "Saved · observing") : tr("저장됨 · 실행 대기", "Saved · planned")}</span>}{creativeAttention.has(row.id) && <span className="ops-chip ops-chip--warn">{tr("소재 신호 있음", "Creative signal")}</span>}</span>}</span></label>; } },
          { key: "budget", label: tr("기간 예산 · 현재 → 실행", "Period budget · current → run"), align: "right", fmt: (_, row) => { const item = forecast.items.find(entry => entry.id === row.id), choice = effective[row.id];
            return <span className="ops-budget-input"><small>{tr("현재", "Current")} {money(item.current * n)} →</small>
              <CommaNumberInput value={item.selected ? Math.round(choice.budget * n * (currency === "USD" ? 100 : 1)) / (currency === "USD" ? 100 : 1) : Math.round(item.current * n)} disabled={!item.selected} allowDecimals={currency === "USD"} maximumFractionDigits={currency === "USD" ? 2 : 0}
                ariaLabel={tr(`${row.name} ${n}일 예산`, `${row.name} ${n}-day budget`)} onCommit={value => setChoice(row.id, { budget: value == null ? NaN : value / n })} />
              {item.status === "range" ? <small role="alert" className="ops-budget-input__error">{tr("예측 가능", "Forecastable")} {money(item.min * n)} – {money(item.max * n)}</small>
                : item.selected ? <small>{tr("하루", "Daily")} {money(item.budget)}</small> : null}</span>; } },
          { key: "delta", label: tr("변경 금액", "Change"), align: "right", fmt: (_, row) => { const item = forecast.items.find(entry => entry.id === row.id);
            return !item.selected ? <span className="ops-muted">{tr("유지", "Keep")}</span> : <strong data-direction={direction({ budget: item.budget, current: item.current })}>{delta((item.budget - item.current) * n)}<small>{pct((item.budget / item.current - 1) * 100)}</small></strong>; } },
          { key: "outcomes", label: tr(`예상 ${outcomeName}`, `Expected ${outcomeName}`), align: "right", fmt: (_, row) => { const item = forecast.items.find(entry => entry.id === row.id);
            return item.expectedResults == null ? "—" : <span>{fmtNum(item.currentResults * n)} → <b>{fmtNum(item.expectedResults * n)}</b></span>; } },
          { key: "cpr", label: tr(`예상 ${metricName}`, `Expected ${metricName}`), align: "right", fmt: (_, row) => { const item = forecast.items.find(entry => entry.id === row.id);
            return item.expectedCpr == null ? "—" : <span>{money(item.current / item.currentResults)} → <b>{money(item.expectedCpr)}</b></span>; } },
        ]} />
        <p className="ops-plan-note">{tr("금액은 캠페인마다 관측한 지출 범위 안에서만 예측합니다. 고르지 않은 캠페인은 현재 지출을 유지한다고 계산합니다.", "Amounts are forecast only within each campaign's observed spend range. Unselected campaigns are assumed to keep current spending.")} {options.mode === "maintain" ? tr("현재 배분 유지안과 조정안을 동일 모형으로 비교합니다.", "The current allocation and revised plan use the same model.") : tr("총예산 변화와 배분 변화가 함께 반영된 예상입니다.", "The estimate includes both total-budget and allocation changes.")} {tr("최근 지출을 기준으로 계산하며 실제 예산 설정값과 다를 수 있습니다. 소재 변화·초기 학습의 효과를 분리한 예측은 아닙니다. 금액과 성과 수는 반올림해 표시합니다.", "Based on recent spending, which may differ from configured budgets. Creative changes and initial learning are not isolated. Amounts and outcome counts are rounded.")}{creativeAttention.size ? ` ${tr("‘소재 신호 있음’ 캠페인은 예산과 소재를 함께 바꾸면 각각의 효과를 나눠 볼 수 없습니다.", "For campaigns with a creative signal, changing budget and creative together makes their effects inseparable.")}` : ""}</p>
        {saving && <OperationsPlanSaveDialog {...{ brief, plan, forecast, metric, currency, locale, isDemo, today, sourceThrough, money }} names={new Map(rows.map(row => [row.id, row.name]))} onClose={() => setSaving(false)} />}
      </section>
    </>}
  </section>;
}
