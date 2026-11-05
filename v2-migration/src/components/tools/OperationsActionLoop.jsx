"use client";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAppStore } from "@/store/useDataStore";
import { TOOL_GROUP } from "@/lib/toolGroups";
import { fmtCurrency, fmtPct } from "@/utils/format";
import { appendDecisionEpisode } from "@/lib/decisionReview";
import OperationsActionQueue from "./OperationsActionQueue";
import { compareOperationsChange } from "@/lib/operations/changeHistory";
import { reviewOperationRecord } from "@/lib/operations/operationLoop";
import { matchesOperationsTarget } from "@/lib/operations/operationsIdentity";
import AllocationResultWorkspace from "./AllocationResultWorkspace";
import OperationsActionEditor from "./OperationsActionEditor";
import OperationsChangeComparison from "./OperationsChangeComparison";
import OperationsForecastCheck, { forecastCheckText } from "./OperationsForecastCheck";
import ReviewSaveDialog from "@/components/ReviewSaveDialog";
import ModalDialog from "@/components/ds/ModalDialog";
import DataTable from "@/components/ds/DataTable";
import { useReviewDraftGuard, confirmReviewExit } from "@/lib/project/reviewDraftGuard";

const VIEWS = [{ id: "actions", ko: "실행과 다음 검토", en: "Execution & next review" }, { id: "history", ko: "전체 변화 이력", en: "Full change history" }, { id: "evidence", ko: "상세 데이터·내보내기", en: "Detailed data & export" }];
const EVENT_LABELS = { spend: ["지출 변화 후보", "Spend change candidate"], efficiency: ["단가 변화 후보", "Unit-cost change candidate"],
  budget_setting: ["예산 설정값 변화", "Budget setting changed"], creative_first: ["소재 첫 관측", "Creative first observed"],
  creative_absent: ["소재 지출 미관측", "Creative spend absent"], creative_return: ["소재 지출 재관측", "Creative spend resumed"] };
const STATES = { legacy: ["직접 기록 · 실행 미확인", "Manual record · execution unverified"], planned: ["실행 대기", "Planned"], cancelled: ["취소", "Cancelled"],
  waiting: ["관찰 중", "Observing"], ready: ["검토 가능", "Ready to review"], scope: ["통화·성과 기준 불일치", "Currency or outcome mismatch"],
  coverage: ["관측일 부족", "Missing observation days"], values: ["비용·성과 누락", "Missing spend or outcomes"], date: ["실행일 확인 필요", "Execution date required"] };
const localToday = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; };
const targetAsRow = target => ({ ...target, campaign_id: target.campaignId, campaign_name: target.campaign });

function ReviewObservation({ item, currency, metricName, locale, isDemo, concurrent, onClose, onFollowup }) {
  const tr = (ko, en) => locale === "en" ? en : ko;
  const headingRef = useRef(null);
  const close = () => { if (confirmReviewExit(useAppStore.getState().activeProjectId, locale)) onClose(); };
  const [learning, setLearning] = useState("");
  const [saving, setSaving] = useState(false);
  useReviewDraftGuard(!!learning && !saving);
  const c = item.review.comparison;
  const money = value => Number.isFinite(value) ? fmtCurrency(value, { currency, precise: true }) : tr("추정 불가", "Unavailable");
  const actual = c?.ok ? `${c.before.start}–${c.before.end} → ${c.after.start}–${c.after.end} · ${tr("일평균 지출", "Daily spend")} ${money(c.previous.cost / (c.previousDays || c.days))} → ${money(c.current.cost / c.days)} · ${metricName} ${money(c.previous.cpr)} → ${money(c.current.cpr)} · ${tr("관측 비교, 인과 효과 미확인", "Observed comparison; causal effect unverified")}${item.review.forecastCheck?.ok ? ` · ${forecastCheckText(item.review.forecastCheck, { metricName, currency, locale })}` : ""}` : "";
  return <>
    <ModalDialog open={!saving} onClose={close} initialFocusRef={headingRef} ariaLabel={tr("실행 후 검토", "Review after execution")} overlayClassName="tutorial-overlay" panelClassName="decision-editor-panel">
      <h2 ref={headingRef} tabIndex={-1}>{tr("실행 후 검토", "Review after execution")}</h2><p>{item.record.action}</p>
      <OperationsForecastCheck action={item.review.action} check={item.review.forecastCheck} metricName={metricName} locale={locale} />
      <OperationsChangeComparison comparison={c} {...{ currency, metricName, locale, isDemo, concurrent }} />
      {item.review.followup && <p>{tr("증액 뒤 지출과 단가가 함께 올랐습니다. 이전 예산으로의 원복을 검토할 수 있지만, 증액이 원인이라고 확정하지 않습니다.", "Spend and unit cost both rose after the increase. Consider reviewing the previous budget, without concluding the increase caused the change.")}</p>}
      <label className="operations-loop__note">{tr("검토 메모", "Review note")}<textarea value={learning} maxLength={1200} onChange={event => setLearning(event.target.value)} /></label>
      <div className="operations-loop__buttons"><button className="btn primary" disabled={!c?.ok || isDemo} onClick={() => setSaving(true)}>{tr("관측 결과 저장", "Save observation")}</button>
        <button className="btn ghost" onClick={() => { if (confirmReviewExit(useAppStore.getState().activeProjectId, locale)) onFollowup(item); }}>{item.review.followup ? tr("원복 검토 액션 정하기", "Plan a rollback review") : tr("후속 액션 정하기", "Plan follow-up")}</button><button className="btn ghost" onClick={close}>{tr("닫기", "Close")}</button></div>
    </ModalDialog>
    {saving && <ReviewSaveDialog locale={locale} onClose={() => setSaving(false)} onConfirm={async () => {
      const state = useAppStore.getState(), current = state.decisionRecords.find(record => record.id === item.record.id);
      if (!current || current.operationAction !== item.record.operationAction) throw new Error("SAVE_CONTEXT_CHANGED");
      await state.commitDecisionRecord(current.id, { ...appendDecisionEpisode(current, { actual, learning }), status: "reviewed" });
      onClose();
    }} />}
  </>;
}

export default function OperationsActionLoop({ brief, plan, history, signals, rows, metric, currency, locale, isDemo, evidence, overview, view, setView }) {
  const tr = (ko, en) => locale === "en" ? en : ko, lang = locale === "en" ? 1 : 0;
  const metricName = metric === "actions" ? "CPA" : "CPI", today = localToday();
  const observedHeadingRef = useRef(null);
  const records = useAppStore(state => state.decisionRecords);
  const [source, setSource] = useState("all"), [limit, setLimit] = useState(30);
  const [editor, setEditor] = useState(null), [selectedEvent, setSelectedEvent] = useState(null), [reviewing, setReviewing] = useState(null);
  const items = useMemo(() => (isDemo ? [] : records).filter(record => ["efficiency", "creative"].includes(TOOL_GROUP[record.toolId]) || record.operationAction)
    .map(record => ({ record, review: reviewOperationRecord(record, rows, { metric, currency, today }) })), [records, rows, metric, currency, today, isDemo]);
  const timeline = useMemo(() => [
    ...history.events.map(event => ({ ...event, label: EVENT_LABELS[event.kind][lang] })),
    ...items.map(item => ({ id: item.record.id, date: item.review.action?.executedDate && item.review.action.state === "executed" ? item.review.action.executedDate : item.record.baselineDate || item.record.createdAt?.slice(0, 10) || "",
      source: "manual", name: item.record.actionTarget, label: item.record.action, item })),
  ].filter(event => source === "all" || event.source === source).sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id)), [history.events, items, source, lang]);
  const comparison = useMemo(() => selectedEvent ? selectedEvent.comparison || compareOperationsChange(rows, { date: selectedEvent.date, target: selectedEvent.target, metric, days: history.rules.windowDays }) : null, [selectedEvent, rows, metric, history.rules.windowDays]);
  const overlapping = (target, comparison, exclude) => !comparison?.before ? 0 : history.events.filter(event => event.id !== exclude && event.date >= comparison.before.start && event.date <= comparison.after.end && matchesOperationsTarget(targetAsRow(event.target), target)).length
    + items.filter(item => item.record.id !== exclude && item.review.action?.state === "executed" && item.review.action.executedDate >= comparison.before.start && item.review.action.executedDate <= comparison.after.end && matchesOperationsTarget(targetAsRow(item.review.action.target), target)).length;
  const openNew = seed => setEditor({ seed: { ...seed, plannedDate: seed.plannedDate || today, executedDate: "", state: "planned" } });
  const followup = item => { setReviewing(null); setEditor({ seed: { ...(item.review.followup || item.review.action), state: "planned", plannedDate: today, executedDate: "", source: "manual", eventId: "" }, parentDecisionId: item.record.id }); };
  const money = value => Number.isFinite(value) ? fmtCurrency(value, { currency, precise: true }) : tr("추정 불가", "Unavailable");
  const signedPct = ratio => `${ratio > 0 ? "+" : ratio < 0 ? "−" : ""}${fmtPct(Math.abs(ratio))}`;
  // 직접 기록이 없으면 모든 행의 출처가 "관측"이라 출처 열·필터가 정보를 더하지 않는다.
  const hasManual = items.length > 0;
  const recordButtons = item => <div className="operations-loop__buttons">
    {item.review.action ? <><button className="btn ghost" onClick={() => setEditor({ record: item.record })}>{item.review.action.state === "planned" ? tr("실행 기록", "Record execution") : tr("기록 수정", "Edit record")}</button>
      {item.review.action.state === "executed" && <button className="btn ghost" onClick={() => setReviewing(item)}>{tr("전후 검토", "Review before/after")}</button>}
      {item.record.status === "reviewed" && <button className="btn ghost" onClick={() => followup(item)}>{tr("후속 액션", "Follow-up")}</button>}</>
      : <Link href={locale === "en" ? "/en/weekly-review" : "/weekly-review"}>{tr("기존 기록 보기", "Open existing record")}</Link>}
  </div>;
  const chooseFromEvidence = id => {
    if (id === "budget") { setView("actions"); requestAnimationFrame(() => { const heading = document.getElementById("ops-execution-title"); heading?.focus({ preventScroll: true }); heading?.scrollIntoView?.({ block: "start", behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ? "auto" : "smooth" }); }); }
    else if (id.startsWith("budget:")) { const row = brief.campaigns.find(row => row.id === id.slice(7)), amount = plan.items.find(row => row.id === id.slice(7)); openNew({ kind: "budget", source: "recommendation", target: row?.target, beforeBudget: amount?.current, afterBudget: amount?.budget, reviewDays: plan.horizonDays || 7, plannedDate: plan.planRange?.start, planContext: { mode: plan.mode, ...plan.planRange, totalBudget: plan.totalBudget * plan.horizonDays } }); }
    else if (id.startsWith("campaign:")) { const row = brief.campaigns.find(row => row.id === id.slice(9)); openNew({ kind: "investigate", target: row?.target }); }
    else { const row = brief.creatives.find(row => row.id === id.slice(9)), parent = brief.campaigns.find(campaign => campaign.id === row?.campaignId), signal = signals.find(item => item.entityId === row?.campaignId && item.creative === row?.creative); openNew({ kind: signal?.needsAction ? "creative_replace" : "investigate", target: parent?.target, creative: row?.creative }); }
  };
  return <section className="operations-loop" aria-label={tr("운영 액션 루프", "Operations action loop")}>
    {overview?.(chooseFromEvidence)}
    <header className="operations-loop__header"><div><h2 id="ops-execution-title" tabIndex={-1}>{tr("실행을 기록하고 결과를 검토하세요", "Record execution and review the outcome")}</h2>
      <p>{history.dates[0] || "—"} – {history.end || history.dates.at(-1) || "—"} · {tr(`전체 ${history.dates.length}개 관측 시점 · 변화 후보 ${history.events.length}건 · 저장한 기록 ${items.length}건`, `${history.dates.length} observations · ${history.events.length} change candidates · ${items.length} saved records`)}</p></div>
      <button className="btn ghost" onClick={() => openNew({})} disabled={!history.groups.size}>{tr("직접 액션 기록", "Record an action")}</button></header>
    <AllocationResultWorkspace value={view} onChange={setView} views={VIEWS} locale={locale} label={tr("운영 플래너 보기", "Operations planner views")} panels={{
      actions: <><OperationsActionQueue {...{ items, today, locale, currency, metricName, isDemo }}
        onEdit={record => setEditor({ record })} onReview={setReviewing} onFollowup={followup} concurrent={overlapping} />
      </>,
      history: <section className="operations-loop__section"><h3>{tr("업로드한 전체 기간의 변화", "Changes across the full uploaded history")}</h3>
        <p>{history.unit ? tr(`전체 이력에서 연속한 ${history.unit === "week" ? "두 주" : "두 달"}의 일평균 지출·단가가 ${history.rules.changeThreshold * 100}% 이상 달라진 지점을 확인합니다. 소재는 첫 관측과 한 집계 기간의 미관측을 찾습니다. 실제 투입·종료나 예산 변경으로 확정하지 않습니다.`, `Across the full history, compares consecutive ${history.unit === "week" ? "weeks" : "months"} for daily-average spend or unit-cost changes of at least ${history.rules.changeThreshold * 100}%. Creatives use first observation and one absent interval. These do not confirm launches, removals or budget interventions.`) : tr(`지출·단가는 모든 날짜에서 전후 ${history.rules.windowDays}일 평균의 ${history.rules.changeThreshold * 100}% 이상 변화 후보를 찾습니다. 동일 유형은 ${history.rules.windowDays}일 간격으로 묶습니다. 소재는 첫 지출과 ${history.rules.absentDays}일 연속 미관측을 확인합니다. 실제 투입·종료나 예산 변경으로 확정하지 않습니다.`, `Scans every date for spend or unit-cost changes of at least ${history.rules.changeThreshold * 100}% across ${history.rules.windowDays}-day windows. Same-type candidates are spaced ${history.rules.windowDays} days apart. Creatives use first spend and ${history.rules.absentDays} consecutive missing days. These do not confirm actual launches, removals or budget interventions.`)}</p>
        {history.unknownIntervals && <p role="status">{tr("일·주·월 집계가 섞였거나 날짜 형식을 확인할 수 없어 자동 변화 탐지를 보류했습니다. 집계 단위를 맞춰 주세요. 직접 저장한 기록은 계속 표시합니다.", "Automatic change detection is withheld because source intervals are mixed or unidentified. Use a consistent date format. Manually saved records remain visible.")}</p>}
        {hasManual && <label>{tr("변화 출처", "Change source")} <select value={source} onChange={event => { setSource(event.target.value); setLimit(30); }}><option value="all">{tr("모두", "All")}</option><option value="observed">{tr("데이터에서 관측", "Observed in data")}</option><option value="manual">{tr("사람이 기록", "Recorded by a person")}</option></select></label>}
        <DataTable ariaLabel={tr("전체 변화 목록", "Full change list")} rows={timeline.slice(0, limit)} rowKey={event => event.id} emptyText={tr("이 조건에서 발견한 변화나 저장 기록이 없습니다. 안정적이라는 판정은 아닙니다.", "No detected changes or saved records for this scope. This is not a stability verdict.")} columns={[
          { key: "date", label: tr("날짜", "Date") }, ...(hasManual ? [{ key: "source", label: tr("출처", "Source"), fmt: value => value === "observed" ? tr("관측", "Observed") : tr("직접 기록", "Manual") }] : []),
          { key: "label", label: tr("변화 · 대상", "Change · target"), fmt: (label, event) => <span className="operations-brief__entity"><strong>{label}</strong><small>{event.name}{event.creative ? ` · ${event.creative}` : ""}</small>{event.source === "observed" && <small>{[event.target.country, event.target.platform, event.target.channel, event.target.source].filter(Boolean).join(" · ")}</small>}{(event.beforeValue != null || event.change != null) && <small>{[event.beforeValue != null && `${money(event.beforeValue)} → ${money(event.afterValue)}`, event.change != null && signedPct(event.change)].filter(Boolean).join(" · ")}</small>}{event.item && <small>{STATES[event.item.review.state]?.[lang]}</small>}</span> },
          { key: "controls", label: tr("확인", "Inspect"), fmt: (_, event) => event.item ? recordButtons(event.item) : <button className="btn ghost" onClick={() => setSelectedEvent(event)}>{tr("전후 확인", "Compare")}</button> },
        ]} />
        {limit < timeline.length && <button className="btn ghost" onClick={() => setLimit(value => value + 30)}>{tr(`더 보기 (${Math.min(limit, timeline.length)}/${timeline.length})`, `Show more (${Math.min(limit, timeline.length)}/${timeline.length})`)}</button>}
        <p className="operations-chart__caption">{tr(`${history.scanned}개 비교 지점 검사 · 날짜가 유효하지 않은 ${history.invalidDates}행 제외. 최근/직전 기간 설정은 이 이력을 자르지 않습니다. 저장 기록은 현재 프로젝트 전체 기준입니다.`, `${history.scanned} comparison boundaries checked · ${history.invalidDates} rows excluded for invalid dates. Recent/prior period settings do not truncate this history. Saved records cover the current project.`)}</p>
      </section>,
      evidence: view === "evidence" ? evidence(chooseFromEvidence) : null,
    }} />
    {selectedEvent && <ModalDialog open initialFocusRef={observedHeadingRef} onClose={() => setSelectedEvent(null)} ariaLabel={tr("관측된 변화 확인", "Inspect observed change")} overlayClassName="tutorial-overlay" panelClassName="decision-editor-panel"><h2 ref={observedHeadingRef} tabIndex={-1}>{selectedEvent.label} · {selectedEvent.name}</h2>
      <OperationsChangeComparison {...{ comparison, currency, metricName, locale, isDemo }} concurrent={overlapping(selectedEvent.target, comparison, selectedEvent.id)} />
      <div className="operations-loop__buttons"><button className="btn primary" onClick={() => { openNew({ target: selectedEvent.target, kind: selectedEvent.kind.startsWith("creative") ? "creative_replace" : "investigate", creative: selectedEvent.creative || "", source: "observed", eventId: selectedEvent.id }); setSelectedEvent(null); }}>{tr("이 변화에 액션 연결", "Link an action to this change")}</button><button className="btn ghost" onClick={() => setSelectedEvent(null)}>{tr("닫기", "Close")}</button></div>
    </ModalDialog>}
    {editor && <OperationsActionEditor {...editor} groups={[...history.groups.values()]} {...{ metric, currency, today, locale, isDemo }} sourceThrough={history.end || history.dates.at(-1)} onClose={() => setEditor(null)} />}
    {reviewing && <ReviewObservation item={reviewing} {...{ currency, metricName, locale, isDemo }} concurrent={overlapping(reviewing.review.action.target, reviewing.review.comparison, reviewing.record.id)} onClose={() => setReviewing(null)} onFollowup={followup} />}
  </section>;
}
