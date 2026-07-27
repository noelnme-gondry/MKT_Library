"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import Papa from "papaparse";
import { trackProductEvent } from "@/lib/analytics";
import { normalizeDecisionReviewRows, serializeDecisionReviewCsv } from "@/lib/decisionReview";
import { downloadCsv } from "@/utils/download";

function nextWeekDate() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
}

function createDraft() {
  return { action: "", hypothesis: "", metric: "", baseline: "", reviewDate: nextWeekDate() };
}

function makeRecordId() {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `decision-${Date.now()}-${++fallbackRecordSequence}`;
}

const COPY = {
  ko: {
    summary: "결정 기록하기 — 다음 주 결과까지 연결",
    helper: "분석 결론을 실행 가능한 가설로 남기고, 다음 주 실제 결과를 같은 CSV에 기록하세요.",
    privacy: "이 기록은 이 화면의 메모리에만 있습니다. 보관하려면 CSV로 내보내세요.",
    action: "무엇을 바꿀까요?",
    actionPlaceholder: "예: Meta 캠페인 예산을 20% 줄인다",
    hypothesis: "왜 효과가 날까요?",
    hypothesisPlaceholder: "예: 빈도 과다 캠페인을 줄이면 CPA가 안정된다",
    metric: "검증 지표",
    metricPlaceholder: "예: CPA, ROAS, 전환수",
    baseline: "현재 기준값 (선택)",
    reviewDate: "검토 예정일",
    add: "결정 추가",
    export: "CSV 내보내기",
    import: "CSV 불러오기",
    pending: "검토 대기",
    reviewed: "검토 완료",
    actual: "실제 결과",
    actualPlaceholder: "예: CPA 4,980원",
    learning: "배운 점 / 다음 조치",
    learningPlaceholder: "예: 절감 예산은 검색 캠페인으로 이동",
    saveReview: "검토 반영",
    remove: "삭제",
    empty: "아직 남긴 결정이 없습니다. 결과를 보고 바로 한 가지 실행 가설을 남겨보세요.",
    importError: "읽을 수 있는 결정 기록 행이 없습니다. 내보낸 CSV 형식인지 확인해 주세요.",
    imported: (count) => `${count}개의 결정 기록을 불러왔습니다.`,
    error: "실행할 변경 내용을 먼저 적어 주세요.",
    ledger: "BASELINE → ACTUAL",
    openWeeklyReview: "주간 검토 열기 →",
  },
  en: {
    summary: "Log a decision — review the outcome next week",
    helper: "Turn this conclusion into a testable action, then log the actual outcome in the same CSV next week.",
    privacy: "This stays only in this screen's memory. Export a CSV to keep it.",
    action: "What will change?",
    actionPlaceholder: "e.g. Reduce Meta campaign budget by 20%",
    hypothesis: "Why should it work?",
    hypothesisPlaceholder: "e.g. Reducing high-frequency campaigns stabilizes CPA",
    metric: "Metric to review",
    metricPlaceholder: "e.g. CPA, ROAS, conversions",
    baseline: "Current baseline (optional)",
    reviewDate: "Review date",
    add: "Add decision",
    export: "Export CSV",
    import: "Import CSV",
    pending: "Review pending",
    reviewed: "Reviewed",
    actual: "Actual outcome",
    actualPlaceholder: "e.g. CPA 4,980 KRW",
    learning: "Learning / next action",
    learningPlaceholder: "e.g. Move saved budget to search",
    saveReview: "Save review",
    remove: "Remove",
    empty: "No decision logged yet. Turn this result into one concrete operating hypothesis.",
    importError: "No usable decision rows found. Check that this is an exported decision-review CSV.",
    imported: (count) => `Imported ${count} decision ${count === 1 ? "record" : "records"}.`,
    error: "Add the action you plan to take first.",
    ledger: "BASELINE → ACTUAL",
    openWeeklyReview: "Open weekly review →",
  },
};

let fallbackRecordSequence = 0;

export default function DecisionReview({ toolId, locale = "ko" }) {
  const t = COPY[locale] || COPY.ko;
  const [draft, setDraft] = useState(createDraft);
  const [records, setRecords] = useState([]);
  const [message, setMessage] = useState("");
  const importRef = useRef(null);

  const updateDraft = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  const addRecord = () => {
    if (!draft.action.trim()) {
      setMessage(t.error);
      return;
    }
    const record = {
      id: makeRecordId(),
      toolId,
      action: draft.action.trim(),
      hypothesis: draft.hypothesis.trim(),
      metric: draft.metric.trim(),
      baseline: draft.baseline.trim(),
      reviewDate: draft.reviewDate,
      actual: "",
      learning: "",
      status: "pending",
    };
    setRecords((current) => [record, ...current]);
    setDraft(createDraft());
    setMessage("");
    trackProductEvent("decision_record_added", { tool_id: toolId, source: "decision_review", placement: "result_action_card", locale });
  };

  const updateRecord = (id, key, value) => {
    setRecords((current) => current.map((record) => {
      if (record.id !== id) return record;
      const next = { ...record, [key]: value };
      next.status = next.actual.trim() || next.learning.trim() ? "reviewed" : "pending";
      return next;
    }));
  };

  const exportRecords = () => {
    if (!records.length) return;
    downloadCsv(serializeDecisionReviewCsv(records), `decision_review_${toolId || "tool"}`);
    trackProductEvent("decision_record_exported", { tool_id: toolId, source: "decision_review", placement: "result_action_card", locale });
  };

  const importRecords = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const text = await file.text();
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: "greedy" });
    const imported = normalizeDecisionReviewRows(parsed.data, toolId).map((record) => ({ ...record, id: makeRecordId() }));
    if (!imported.length) {
      setMessage(t.importError);
      return;
    }
    setRecords((current) => [...imported, ...current]);
    setMessage(t.imported(imported.length));
    trackProductEvent("decision_record_imported", { tool_id: toolId, source: "decision_review", placement: "result_action_card", locale });
  };

  return (
    <details className="decision-review">
      <summary>
        <span>{t.summary}</span>
        {records.length > 0 && <em>{records.length}</em>}
      </summary>
      <div className="decision-review__body">
        <p className="decision-review__helper">{t.helper}</p>
        <p className="decision-review__privacy">{t.privacy}</p>

        <div className="decision-review__form">
          <label className="decision-review__field decision-review__field--wide">
            <span>{t.action}</span>
            <input value={draft.action} onChange={(event) => updateDraft("action", event.target.value)} placeholder={t.actionPlaceholder} />
          </label>
          <label className="decision-review__field decision-review__field--wide">
            <span>{t.hypothesis}</span>
            <input value={draft.hypothesis} onChange={(event) => updateDraft("hypothesis", event.target.value)} placeholder={t.hypothesisPlaceholder} />
          </label>
          <label className="decision-review__field">
            <span>{t.metric}</span>
            <input value={draft.metric} onChange={(event) => updateDraft("metric", event.target.value)} placeholder={t.metricPlaceholder} />
          </label>
          <label className="decision-review__field">
            <span>{t.baseline}</span>
            <input value={draft.baseline} onChange={(event) => updateDraft("baseline", event.target.value)} placeholder="—" />
          </label>
          <label className="decision-review__field">
            <span>{t.reviewDate}</span>
            <input type="date" value={draft.reviewDate} onChange={(event) => updateDraft("reviewDate", event.target.value)} />
          </label>
          <button type="button" className="btn primary decision-review__add" onClick={addRecord}>{t.add}</button>
        </div>

        <div className="decision-review__actions">
          <button type="button" className="btn small" onClick={exportRecords} disabled={!records.length}>{t.export}</button>
          <button type="button" className="btn small" onClick={() => importRef.current?.click()}>{t.import}</button>
          <input ref={importRef} className="decision-review__file" type="file" accept=".csv,text/csv" onChange={importRecords} />
          {message && <span className="decision-review__message" role="status">{message}</span>}
          <Link className="decision-review__weekly-link" href={locale === "en" ? "/en/weekly-review" : "/weekly-review"}>{t.openWeeklyReview}</Link>
        </div>

        {records.length === 0 ? (
          <p className="decision-review__empty">{t.empty}</p>
        ) : (
          <div className="decision-review__ledger">
            <div className="decision-review__ledger-label">{t.ledger}</div>
            {records.map((record) => (
              <article className="decision-review__record" key={record.id}>
                <div className="decision-review__record-head">
                  <div>
                    <strong>{record.action}</strong>
                    {record.hypothesis && <p>{record.hypothesis}</p>}
                  </div>
                  <span className={`decision-review__status ${record.status}`}>{record.status === "reviewed" ? t.reviewed : t.pending}</span>
                </div>
                <div className="decision-review__comparison">
                  <span><small>{record.metric || "—"}</small>{record.baseline || "—"}</span>
                  <b>→</b>
                  <label>
                    <span className="sr-only">{t.actual}</span>
                    <input value={record.actual} onChange={(event) => updateRecord(record.id, "actual", event.target.value)} placeholder={t.actualPlaceholder} />
                  </label>
                </div>
                <div className="decision-review__record-footer">
                  <span>{record.reviewDate || "—"}</span>
                  <label>
                    <span className="sr-only">{t.learning}</span>
                    <input value={record.learning} onChange={(event) => updateRecord(record.id, "learning", event.target.value)} placeholder={t.learningPlaceholder} />
                  </label>
                  <button type="button" className="btn text decision-review__remove" onClick={() => setRecords((current) => current.filter((item) => item.id !== record.id))}>{t.remove}</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}
