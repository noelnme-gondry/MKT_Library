"use client";
import { useRef, useState } from "react";
import ModalDialog from "@/components/ds/ModalDialog";
import ReviewSaveDialog from "@/components/ReviewSaveDialog";
import { useAppStore } from "@/store/useDataStore";
import { useReviewDraftGuard, confirmReviewExit } from "@/lib/project/reviewDraftGuard";
import { OPERATION_ACTION_KINDS, readOperationAction } from "@/lib/operations/actionContract";
import { createOperationRecord } from "@/lib/operations/operationLoop";
import { shiftDate } from "@/lib/operations/changeHistory";
import { CommaNumberInput } from "./marketingResponseModel";

export default function OperationsActionEditor({ seed, record, groups, metric, currency, today, sourceThrough, locale, isDemo, onClose, parentDecisionId }) {
  const tr = (ko, en) => locale === "en" ? en : ko;
  const existing = readOperationAction(record?.operationAction);
  const [draft, setDraft] = useState(() => ({ kind: "investigate", target: groups[0]?.target, plannedDate: today, executedDate: "", state: "planned",
    beforeBudget: "", afterBudget: "", creative: "", reviewDays: 7, metric, currency, source: "manual", note: "", ...seed, ...existing, beforeBudget: existing ? existing.beforeBudget : seed?.source === "recommendation" ? "" : seed?.beforeBudget ?? "", target: existing?.target || seed?.target || groups[0]?.target }));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(null);
  const [error, setError] = useState("");
  const saved = useRef(false);
  useReviewDraftGuard(dirty);
  const update = patch => { setDraft(value => ({ ...value, ...patch })); setDirty(true); };
  const close = () => { if (confirmReviewExit(useAppStore.getState().activeProjectId, locale)) onClose(); };
  const prepared = createOperationRecord({ draft, locale, today, sourceThrough, parentDecisionId });
  const chosen = groups.find(group => JSON.stringify(group.target) === JSON.stringify(draft.target));
  const dates = draft.state === "executed" ? draft.executedDate : draft.plannedDate;
  const due = /^\d{4}-\d{2}-\d{2}$/.test(dates) ? shiftDate(dates, Number(draft.reviewDays) || 7) : "—";
  return <>
    <ModalDialog open={!saving} onClose={close} ariaLabel={tr("운영 액션 정하기", "Define an operating action")} overlayClassName="tutorial-overlay" panelClassName="decision-editor-panel">
      <form onSubmit={event => { event.preventDefault(); if (prepared) { setSaving(prepared); setError(""); } else setError(tr("대상·날짜·예산을 확인해 주세요. 실행일은 오늘 이후로 기록할 수 없습니다.", "Check the target, dates and budget. Execution cannot be recorded in the future.")); }}>
        <h2>{tr("운영 액션 정하기", "Define an operating action")}</h2>
        <p>{tr("계획과 실제 실행을 구분해 기록합니다. 광고 계정의 설정은 이 화면에서 바뀌지 않습니다.", "Record the plan separately from actual execution. This screen does not change settings in your ad account.")}</p>
        {seed?.kind === "budget" && seed.source === "recommendation" && <p>{tr("변경 전 예산은 확인한 설정값을 직접 입력하세요. 제안의 기준은 관측된 하루 평균 지출이며 설정 예산과 다를 수 있습니다.", "Enter the confirmed previous budget setting. Proposals start from observed average daily spend, which may differ from the configured budget.")}</p>}
        <div className="operations-action-form">
          <label>{tr("대상", "Target")}<select required value={chosen?.id || ""} disabled={!!record} onChange={event => update({ target: groups.find(group => group.id === event.target.value)?.target })}>
            {!chosen && <option value="">{existing ? record.actionTarget : tr("대상 선택", "Select target")}</option>}
            {groups.map(group => <option key={group.id} value={group.id}>{group.name} · {[group.target.country, group.target.platform, group.target.channel, group.target.source].filter(Boolean).join(" · ")}</option>)}
          </select></label>
          <label>{tr("할 일", "Action")}<select value={draft.kind} disabled={!!record} onChange={event => update({ kind: event.target.value })}>{Object.entries(OPERATION_ACTION_KINDS).map(([key, labels]) => <option key={key} value={key}>{labels[locale === "en" ? 1 : 0]}</option>)}</select></label>
          {draft.kind.startsWith("creative") && <label>{tr("소재 이름 / ID", "Creative name / ID")}<input value={draft.creative} maxLength={160} required onChange={event => update({ creative: event.target.value })} /></label>}
          {draft.kind === "creative_replace" && <label>{tr("교체할 새 소재 이름 / ID", "Replacement creative name / ID")}<input value={draft.replacementCreative || ""} maxLength={160} required={draft.state === "executed"} onChange={event => update({ replacementCreative: event.target.value })} /></label>}
          {draft.kind === "budget" && <><label>{tr(`변경 전 하루 예산 (${draft.currency}, 선택)`, `Previous daily budget (${draft.currency}, optional)`)}<CommaNumberInput allowDecimals value={draft.beforeBudget ?? ""} onCommit={value => update({ beforeBudget: value })} /></label>
            <label>{tr(`변경 후 하루 예산 (${draft.currency})`, `New daily budget (${draft.currency})`)}<CommaNumberInput allowDecimals value={draft.afterBudget ?? ""} onCommit={value => update({ afterBudget: value })} /></label></>}
          <label>{tr("상태", "State")}<select value={draft.state} onChange={event => update({ state: event.target.value })}><option value="planned">{tr("계획", "Planned")}</option><option value="executed">{tr("실행함", "Executed")}</option><option value="cancelled">{tr("취소함", "Cancelled")}</option></select></label>
          <label>{tr("계획일", "Planned date")}<input type="date" required value={draft.plannedDate} onChange={event => update({ plannedDate: event.target.value })} /></label>
          {draft.state === "executed" && <label>{tr("실제 실행일", "Actual execution date")}<input type="date" required max={today} value={draft.executedDate} onChange={event => update({ executedDate: event.target.value })} /></label>}
          <label>{tr("전후 관찰 일수", "Days before and after")}<input type="number" min="1" max="90" required value={draft.reviewDays} onChange={event => update({ reviewDays: event.target.value })} /></label>
          <label className="operations-action-form__wide">{tr("실행 메모 (선택)", "Execution note (optional)")}<textarea value={draft.note} maxLength={500} onChange={event => update({ note: event.target.value })} /></label>
        </div>
        <p><strong>{tr("다음 검토", "Next review")} {due}</strong> · {tr("동일 대상·통화·성과 기준, 전후 매일의 관측 필요", "Same target, currency and outcome basis; observations needed for every day")}</p>
        {draft.kind.startsWith("creative") && <p className="operations-chart__caption">{tr("소재 액션의 CPRR 개선·악화 수치는 예측하지 않습니다.", "CPRR gains or losses from creative actions are not predicted.")}</p>}
        {isDemo && <p role="status">{tr("데모에서는 계획을 미리 봅니다. 내 데이터의 액션 저장은 로그인과 Pro(7일 체험 포함)가 필요합니다.", "Preview the plan in the demo. Saving actions for your own data requires sign-in and Pro, including the 7-day trial.")}</p>}
        {error && <p role="alert">{error}</p>}
        <div className="operations-loop__buttons"><button className="btn primary" type="submit" disabled={isDemo || !draft.target}>{tr("액션 저장", "Save action")}</button><button className="btn ghost" type="button" onClick={close}>{tr("닫기", "Close")}</button></div>
      </form>
    </ModalDialog>
    {saving && <ReviewSaveDialog locale={locale} record={saving} onClose={() => { if (saved.current) onClose(); else setSaving(null); }}
      onSaved={() => { saved.current = true; setDirty(false); }}
      onConfirm={record ? async () => {
        const state = useAppStore.getState();
        if (state.decisionRecords.find(item => item.id === record.id)?.updatedAt !== record.updatedAt) throw new Error("SAVE_CONTEXT_CHANGED");
        await state.commitDecisionRecord(record.id, { ...saving, parentDecisionId: record.parentDecisionId,
          actual: record.actual, learning: record.learning, episodes: record.episodes, status: saving.operationAction === record.operationAction ? record.status : "pending" });
        setDirty(false); onClose();
      } : undefined} />}
  </>;
}
