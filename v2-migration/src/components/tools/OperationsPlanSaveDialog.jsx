"use client";
import { useRef, useState } from "react";
import ModalDialog from "@/components/ds/ModalDialog";
import ReviewSaveDialog from "@/components/ReviewSaveDialog";
import { createOperationRecord } from "@/lib/operations/operationLoop";
import { operationsPlanDrafts } from "@/lib/operations/operationsSelection";
import { shiftDate } from "@/lib/operations/changeHistory";
import { fmtNum } from "@/utils/format";

// 고른 예산 액션과 그 예측을 프로젝트에 한 번에 저장한다. 광고 계정은 바뀌지 않는다.
// 예측은 실행일부터 같은 기간의 실제와 나중에 대조한다(운영 플래너의 실행·검토 목록).
export default function OperationsPlanSaveDialog({ brief, plan, forecast, metric, currency, locale, isDemo, today, sourceThrough, money, names, onClose }) {
  const tr = (ko, en) => locale === "en" ? en : ko;
  const headingRef = useRef(null);
  const [plannedDate, setPlannedDate] = useState(plan.planRange.start);
  const [done, setDone] = useState(false);
  const [executedDate, setExecutedDate] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [records, setRecords] = useState(null);
  const [planId] = useState(() => crypto.randomUUID());
  const saved = useRef(false);
  const metricName = metric === "actions" ? "CPA" : "CPI", outcomeName = metric === "actions" ? tr("가입", "sign-ups") : tr("설치", "installs");
  const days = plan.horizonDays, totals = forecast.totals;
  const start = done ? executedDate : plannedDate;
  const due = /^\d{4}-\d{2}-\d{2}$/.test(start) ? shiftDate(start, days) : "—";
  const submit = event => {
    event.preventDefault();
    const drafts = operationsPlanDrafts({ brief, plan, forecast, planId, plannedDate, state: done ? "executed" : "planned", executedDate, note, metric, currency });
    const prepared = drafts.map(draft => createOperationRecord({ draft, locale, today, sourceThrough }));
    if (!prepared.length || prepared.some(item => !item)) {
      setError(tr("날짜를 확인해 주세요. 실행일은 오늘 이후로 기록할 수 없습니다.", "Check the dates. Execution cannot be recorded in the future."));
      return;
    }
    setError("");
    setRecords(prepared);
  };
  return <>
    <ModalDialog open={!records} onClose={onClose} initialFocusRef={headingRef} ariaLabel={tr("선택한 계획 저장", "Save the selected plan")} overlayClassName="tutorial-overlay" panelClassName="decision-editor-panel">
      <form onSubmit={submit} className="ops-plan-save">
        <h2 ref={headingRef} tabIndex={-1}>{tr("선택한 계획 저장", "Save the selected plan")}</h2>
        <p>{tr(`고른 예산 액션 ${forecast.changed.length}건과 예상 성과를 프로젝트에 남깁니다. 실행일부터 ${days}일이 지난 뒤 같은 기간 데이터를 올리면 예상과 실제를 비교합니다. 광고 계정 설정은 바뀌지 않습니다.`,
          `Saves ${forecast.changed.length} budget actions and their expected outcomes to your project. After ${days} days from execution, upload data for that period to compare expected and actual results. Your ad account is not changed.`)}</p>
        <ul className="ops-plan-save__list">{forecast.changed.map(item => <li key={item.id}>
          <strong>{names.get(item.id)}</strong>
          <span>{tr("하루", "Daily")} {money(item.current)} → <b>{money(item.budget)}</b></span>
          <span>{tr(`예상 ${outcomeName} ${fmtNum(item.expectedResults * days)} · 예상 ${metricName} ${money(item.expectedCpr)}`, `Expected ${outcomeName} ${fmtNum(item.expectedResults * days)} · expected ${metricName} ${money(item.expectedCpr)}`)}</span>
        </li>)}</ul>
        <p className="ops-plan-save__total">{tr(`전체 ${days}일: 예산 ${money(totals.currentSpend * days)} → ${money(totals.spend * days)} · 예상 ${outcomeName} ${fmtNum(totals.baselineResults * days)} → ${fmtNum(totals.expectedResults * days)} · 예상 ${metricName} ${money(totals.baselineCpr)} → ${money(totals.expectedCpr)}`,
          `All ${days} days: budget ${money(totals.currentSpend * days)} → ${money(totals.spend * days)} · expected ${outcomeName} ${fmtNum(totals.baselineResults * days)} → ${fmtNum(totals.expectedResults * days)} · expected ${metricName} ${money(totals.baselineCpr)} → ${money(totals.expectedCpr)}`)}</p>
        <div className="operations-action-form">
          <label>{tr("실행 예정일", "Planned date")}<input type="date" required value={plannedDate} onChange={event => setPlannedDate(event.target.value)} /></label>
          <label className="ops-plan-save__check"><input type="checkbox" checked={done} onChange={event => setDone(event.target.checked)} />{tr("이미 광고 계정에 반영했습니다", "Already applied in the ad account")}</label>
          {done && <label>{tr("실제 실행일", "Actual execution date")}<input type="date" required max={today} value={executedDate} onChange={event => setExecutedDate(event.target.value)} /></label>}
          <label className="operations-action-form__wide">{tr("메모 (선택)", "Note (optional)")}<textarea value={note} maxLength={500} onChange={event => setNote(event.target.value)} /></label>
        </div>
        <p><strong>{tr("예상과 실제 비교", "Compare expected and actual")} {due}</strong> · {tr(`같은 캠페인·통화·성과 기준으로 실행일부터 ${days}일 전체 데이터가 필요합니다.`, `Needs complete data for ${days} days from execution, with the same campaigns, currency and outcome basis.`)}</p>
        {isDemo && <p role="status">{tr("데모에서는 계획을 미리 봅니다. 내 데이터의 계획 저장은 로그인과 Pro(7일 체험 포함)가 필요합니다.", "Preview the plan in the demo. Saving plans for your own data requires sign-in and Pro, including the 7-day trial.")}</p>}
        {error && <p role="alert">{error}</p>}
        <div className="operations-loop__buttons"><button className="btn primary" type="submit" disabled={isDemo}>{tr("프로젝트에 저장", "Save to project")}</button><button className="btn ghost" type="button" onClick={onClose}>{tr("닫기", "Close")}</button></div>
      </form>
    </ModalDialog>
    {records && <ReviewSaveDialog locale={locale} records={records} onClose={() => { if (saved.current) onClose(); else setRecords(null); }} onSaved={() => { saved.current = true; }} />}
  </>;
}
