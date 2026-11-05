"use client";
import { useId, useMemo, useRef, useState } from "react";
import { OPERATION_ACTION_KINDS } from "@/lib/operations/actionContract";
import { buildOperationQueue, OPERATION_QUEUE_STATES, operationQueuePage, operationTargetKey } from "@/lib/operations/actionQueue";
import { fmtCurrency } from "@/utils/format";
import OperationsChangeComparison from "./OperationsChangeComparison";

export default function OperationsActionQueue({ items, today, locale, currency, metricName, isDemo, onEdit, onReview, onFollowup, concurrent }) {
  const en = locale === "en", tr = (ko, english) => en ? english : ko;
  const queue = useMemo(() => buildOperationQueue(items, today), [items, today]);
  // 사용자가 상태를 고르기 전에는 매 렌더 기록에서 파생한다 — 빈 큐로 마운트된 뒤 첫 기록이 생겨도 그 기록이 보이게.
  const [chosenBucket, setBucket] = useState(null);
  const bucket = chosenBucket ?? (queue.some(item => item.bucket === "review") ? "review" : queue.some(item => item.bucket === "progress") ? "progress" : "done");
  const [target, setTarget] = useState("all"), [page, setPage] = useState(1), [selectedId, setSelectedId] = useState(null);
  const id = useId(), detailRef = useRef(null), listRef = useRef(null);
  const current = operationQueuePage(queue, { bucket, target, page });
  const selected = current.visible.find(item => item.id === selectedId) || current.visible[0];
  const targets = [...new Map(queue.map(item => [operationTargetKey(item.action.target), item.name])).entries()];
  const money = (value, unit = currency) => Number.isFinite(value) ? fmtCurrency(value, { currency: unit, precise: true }) : tr("미확인", "Unverified");
  const kindLabel = kind => OPERATION_ACTION_KINDS[kind][en ? 1 : 0];
  const summary = item => item.action.kind === "budget" ? `${money(item.action.beforeBudget, item.action.currency || currency)} → ${money(item.action.afterBudget, item.action.currency || currency)} / ${tr("일", "day")}`
    : [item.action.creative, item.action.replacementCreative].filter(Boolean).join(" → ") || kindLabel(item.action.kind);
  const status = item => item.action.state === "cancelled" ? tr("취소", "Cancelled") : item.bucket === "done" ? tr("검토 완료", "Reviewed")
      : item.action.state === "planned" ? tr("실행 대기", "Planned") : item.bucket === "review"
        ? item.review.state === "ready" ? (item.due < today ? tr("검토일 지남", "Overdue") : tr("오늘 검토", "Review today")) : tr("데이터 확인 필요", "Check data")
        : tr("관측 대기", "Observing");
  const choose = item => { setSelectedId(item.id); requestAnimationFrame(() => { detailRef.current?.focus(); if (window.innerWidth <= 1000) detailRef.current?.scrollIntoView?.({ block: "start" }); }); };
  // 기록이 하나도 없으면 상태 칩·필터·빈 목록을 그리지 않는다. 제안은 위 예산안·소재 목록에 있다.
  if (!queue.length) return <section className="operations-queue operations-queue--empty" aria-label={tr("액션과 검토를 한곳에서", "Actions and reviews in one place")}>
    <p className="operations-queue__empty" role="status">{isDemo
      ? tr("예시에서는 액션이 저장되지 않습니다. 내 데이터에서 위 실행안의 ‘액션 정하기’로 기록하면 실행일과 다음 검토가 여기에 쌓입니다.", "Actions are not saved in the sample. With your data, use “Plan action” in the plan above; execution dates and reviews then appear here.")
      : tr("아직 기록한 액션이 없습니다. 위 실행안이나 소재에서 ‘액션 정하기’를 누르면 실행일과 다음 검토가 여기에 쌓입니다.", "No recorded actions yet. Use “Plan action” in the plan or creatives above; execution dates and reviews then appear here.")}</p>
  </section>;
  return <section className="operations-queue" aria-label={tr("액션과 검토를 한곳에서", "Actions and reviews in one place")}>
    <div className="operations-queue__toolbar">
      <div className="operations-queue__states" role="group" aria-label={tr("액션 진행 상태", "Action status")}>
        {OPERATION_QUEUE_STATES.map(state => <button key={state.id} type="button" aria-pressed={bucket === state.id} onClick={() => { setBucket(state.id); setPage(1); setSelectedId(null); }}>{state[en ? "en" : "ko"]}<b>{queue.filter(item => item.bucket === state.id && (target === "all" || operationTargetKey(item.action.target) === target)).length}</b></button>)}
      </div>
      <label className="operations-queue__filter"><span>{tr("액션 대상", "Action target")}</span><select value={target} onChange={event => { setTarget(event.target.value); setPage(1); setSelectedId(null); }}><option value="all">{tr("모든 캠페인·채널", "All campaigns and channels")}</option>{targets.map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label>
    </div>
    <div className="operations-queue__workbench">
      <div className="operations-queue__list" ref={listRef} tabIndex={-1}>
        <p className="operations-queue__count">{OPERATION_QUEUE_STATES.find(state => state.id === bucket)[en ? "en" : "ko"]} <strong>{tr(`${current.total}건`, `${current.total} items`)}</strong><span>{tr("액션별 묶음", "Grouped by action")}</span></p>
        {!current.total && <p className="operations-queue__empty" role="status">{tr("이 상태에 해당하는 액션이 없습니다. 다른 상태를 선택하거나 직접 액션을 기록하세요.", "No actions in this state. Choose another state or record an action.")}</p>}
        {current.groups.map(([kind, entries]) => <section className="operations-queue__group" key={kind} aria-labelledby={`${id}-${kind}`}>
          <h3 id={`${id}-${kind}`}><span>{kindLabel(kind)}</span><b>{tr(`${current.groupCounts[kind]}건`, `${current.groupCounts[kind]} items`)}</b></h3>
          {entries.map(item => <button key={item.id} type="button" className="operations-queue__choice" aria-pressed={selected?.id === item.id} aria-controls={`${id}-detail`} onClick={() => choose(item)}>
            <span className="operations-queue__row"><strong>{item.name}</strong><small data-attention={item.bucket === "review"}>{status(item)}</small></span>
            <span>{summary(item)}</span>
            <small>{item.action.state === "executed" ? tr(`실행 ${item.action.executedDate}`, `Executed ${item.action.executedDate}`) : tr(`계획 ${item.action.plannedDate}`, `Planned ${item.action.plannedDate}`)} · {tr("검토", "Review")} {item.due}</small>
          </button>)}
        </section>)}
        {current.pages > 1 && <div className="operations-queue__pagination"><span>{tr(`전체 ${current.total}건 중 ${current.start === current.end ? current.start : `${current.start}–${current.end}`}번째`, `${current.start}–${current.end} of ${current.total} items`)}</span><button type="button" className="btn ghost" aria-label={tr("이전 액션 목록", "Previous actions")} disabled={current.page === 1} onClick={() => { setPage(current.page - 1); setSelectedId(null); }}>‹</button><button type="button" className="btn ghost" aria-label={tr("다음 액션 목록", "Next actions")} disabled={current.page === current.pages} onClick={() => { setPage(current.page + 1); setSelectedId(null); }}>›</button></div>}
      </div>
      <div className="operations-queue__detail" id={`${id}-detail`}>
        {selected ? <>
          <button type="button" className="btn ghost operations-queue__back" onClick={() => { listRef.current?.focus(); if (listRef.current) listRef.current.scrollTop = 0; listRef.current?.scrollIntoView?.({ block: "start" }); }}>{tr("← 목록으로", "← Back to list")}</button>
          <p className="operations-queue__eyebrow">{kindLabel(selected.action.kind)} · {status(selected)}</p>
          <h3 tabIndex={-1} ref={detailRef}>{selected.name}</h3><p>{summary(selected)}</p>
          <>
            <dl className="operations-queue__dates"><div><dt>{tr("계획", "Planned")}</dt><dd>{selected.action.plannedDate || "—"}</dd></div><div><dt>{tr("실제 실행", "Executed")}</dt><dd>{selected.action.executedDate || tr("미실행", "Not executed")}</dd></div><div><dt>{tr("검토일", "Review date")}</dt><dd>{selected.due || "—"}</dd></div></dl>
            {selected.action.note && <p>{selected.action.note}</p>}
            {selected.record.parentDecisionId && <p>{tr("이전 검토에 연결된 후속 액션입니다.", "This action follows a previous review.")}</p>}
            {selected.bucket === "done" ? <><p>{selected.record.actual}</p><p>{selected.record.learning}</p></>
              : selected.action.state === "executed" ? selected.review.state === "waiting" ? <p role="status">{tr("검토일까지 관측을 기다립니다.", "Waiting for observations until the review date.")}</p>
                : selected.review.state === "scope" ? <p role="status">{tr("기록 당시의 통화·성과 기준과 현재 데이터가 다릅니다. 같은 기준의 데이터를 준비한 뒤 검토하세요.", "The record and current data use different currency or outcome definitions. Load data with the same definitions before reviewing.")}</p>
                : <OperationsChangeComparison comparison={selected.review.comparison} {...{ currency, metricName, locale, isDemo }} concurrent={concurrent(selected.action.target, selected.review.comparison, selected.id)} />
                : <p>{tr("아직 실행하지 않은 계획입니다. 실제 실행일을 기록하면 그날부터 다음 검토일을 계산합니다.", "This plan has not been executed. Recording the actual date schedules the next review from that date.")}</p>}
            {selected.review.followup && <p>{tr("증액 뒤 지출과 단가가 함께 올랐습니다. 이전 예산으로의 원복을 검토하세요. 인과 효과는 미확인입니다.", "Spend and unit cost rose after the increase. Review a return to the previous budget; causality is unverified.")}</p>}
            <div className="operations-loop__buttons"><button type="button" className="btn ghost" onClick={() => onEdit(selected.record)}>{selected.action.state === "planned" ? tr("실행 기록", "Record execution") : tr("기록 수정", "Edit record")}</button>
              {selected.bucket === "review" && <button type="button" className="btn primary" disabled={selected.review.state !== "ready"} onClick={() => onReview(selected)}>{tr("전후 검토", "Review before/after")}</button>}
              {selected.bucket === "done" && selected.action.state !== "cancelled" && <button type="button" className="btn primary" onClick={() => onFollowup(selected)}>{tr("후속 액션", "Follow-up")}</button>}
            </div>
          </>
        </> : <p className="operations-queue__empty">{tr("액션을 선택하면 실행 내용, 관측 결과, 다음 검토를 함께 확인할 수 있습니다.", "Select an action to see its execution, observations and next review.")}</p>}
      </div>
    </div>
  </section>;
}
