"use client";

import React, { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { normalizeDecisionReviewRows, serializeDecisionReviewCsv } from "@/lib/decisionReview";
import { downloadCsv, downloadText } from "@/utils/download";

const TOOL_NAMES = {
  "5-2": ["운영 대시보드", "Operations dashboard"],
  "5-3": ["예산 배분", "Budget allocation"],
  "5-4": ["실험 분석", "Experiment analysis"],
  "5-18": ["마케팅 반응", "Marketing response"],
  "5-21": ["성과 변동 탐지", "Performance variance"],
  "5-22": ["캠페인 포화도", "Campaign saturation"],
  "5-23": ["증분 분석", "Incrementality"],
  "9-6": ["소재 분석", "Creative analysis"],
};

const COPY = {
  ko: {
    eyebrow: "WEEKLY REVIEW",
    title: "지난 판단을 다음 판단의 근거로",
    deck: "결과 카드에서 내보낸 결정 기록 CSV를 불러오세요. 원본 분석 데이터는 여기에도 저장하지 않습니다.",
    import: "결정 기록 CSV 불러오기",
    export: "수정한 CSV 내보내기",
    brief: "공유용 브리프 받기",
    empty: "아직 불러온 결정 기록이 없습니다. 분석 결과에서 실행 가설을 기록한 뒤 CSV로 내보내세요.",
    due: "오늘 검토",
    upcoming: "예정",
    reviewed: "검토 완료",
    actual: "실제 결과",
    learning: "배운 점 / 다음 조치",
    remove: "삭제",
    imported: (count) => `${count}개의 결정 기록을 불러왔습니다.`,
    importError: "결정 기록을 찾지 못했습니다. 결과 카드에서 내보낸 CSV인지 확인해 주세요.",
    privacy: "이 화면은 브라우저 메모리에서만 작동합니다. 수정한 내용은 CSV로 내보내야 보관됩니다.",
    baseline: "기준",
    reviewDate: "검토일",
    noMetric: "지표 미입력",
    briefTitle: "주간 운영 브리프",
    briefPending: "검토 대기",
    briefReviewed: "검토 완료",
    hypothesis: "가설",
  },
  en: {
    eyebrow: "WEEKLY REVIEW",
    title: "Turn last week’s call into this week’s evidence",
    deck: "Import a decision-record CSV exported from a result card. Source analysis data is not stored here either.",
    import: "Import decision CSV",
    export: "Export updated CSV",
    brief: "Download share brief",
    empty: "No decision records imported yet. Log one operating hypothesis from an analysis result, then export its CSV.",
    due: "Review today",
    upcoming: "Upcoming",
    reviewed: "Reviewed",
    actual: "Actual outcome",
    learning: "Learning / next action",
    remove: "Remove",
    imported: (count) => `Imported ${count} decision ${count === 1 ? "record" : "records"}.`,
    importError: "No decision records found. Check that this is a CSV exported from a result card.",
    privacy: "This screen runs only in browser memory. Export the updated CSV to keep your edits.",
    baseline: "Baseline",
    reviewDate: "Review date",
    noMetric: "No metric set",
    briefTitle: "Weekly operating brief",
    briefPending: "Pending review",
    briefReviewed: "Reviewed",
    hypothesis: "Hypothesis",
  },
};

let nextRecordSequence = 0;

function recordId() {
  nextRecordSequence += 1;
  return `review-${Date.now()}-${nextRecordSequence}`;
}

function isDue(reviewDate) {
  if (!reviewDate) return false;
  return reviewDate <= new Date().toISOString().slice(0, 10);
}

function toolName(toolId, locale) {
  const names = TOOL_NAMES[toolId];
  return names ? names[locale === "en" ? 1 : 0] : toolId || "—";
}

export function buildBrief(records, t, locale) {
  const today = new Date().toISOString().slice(0, 10);
  const lines = [`# ${t.briefTitle}`, "", `- ${today}`, "", "## Decisions"];
  records.forEach((record) => {
    lines.push(`### ${toolName(record.toolId, locale)} — ${record.action}`);
    lines.push(`- ${t.reviewDate}: ${record.reviewDate || "—"}`);
    lines.push(`- ${t.baseline}: ${record.metric || t.noMetric} ${record.baseline || "—"}`);
    lines.push(`- ${record.status === "reviewed" ? t.briefReviewed : t.briefPending}: ${record.actual || "—"}`);
    lines.push(`- ${t.learning}: ${record.learning || "—"}`);
    if (record.hypothesis) lines.push(`- ${t.hypothesis}: ${record.hypothesis}`);
    lines.push("");
  });
  return `${lines.join("\n")}\n`;
}

export default function WeeklyReview({ locale = "ko" }) {
  const t = COPY[locale] || COPY.ko;
  const [records, setRecords] = useState([]);
  const [message, setMessage] = useState("");
  const importRef = useRef(null);
  const sortedRecords = useMemo(() => [...records].sort((a, b) => {
    const aWeight = a.status === "reviewed" ? 2 : isDue(a.reviewDate) ? 0 : 1;
    const bWeight = b.status === "reviewed" ? 2 : isDue(b.reviewDate) ? 0 : 1;
    return aWeight - bWeight || String(a.reviewDate).localeCompare(String(b.reviewDate));
  }), [records]);

  const importRecords = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const parsed = Papa.parse(await file.text(), { header: true, skipEmptyLines: "greedy" });
    const imported = normalizeDecisionReviewRows(parsed.data).map((record) => ({ ...record, id: recordId() }));
    if (!imported.length) {
      setMessage(t.importError);
      return;
    }
    setRecords((current) => [...imported, ...current]);
    setMessage(t.imported(imported.length));
  };

  const updateRecord = (id, key, value) => setRecords((current) => current.map((record) => {
    if (record.id !== id) return record;
    const next = { ...record, [key]: value };
    next.status = next.actual.trim() || next.learning.trim() ? "reviewed" : "pending";
    return next;
  }));

  return (
    <main id="main-content" className="page-inner weekly-review-page">
      <header className="weekly-review-page__head">
        <div className="weekly-review-page__eyebrow">{t.eyebrow}</div>
        <h1>{t.title}</h1>
        <p>{t.deck}</p>
      </header>
      <section className="weekly-review-page__toolbar" aria-label={t.title}>
        <button type="button" className="btn primary" onClick={() => importRef.current?.click()}>{t.import}</button>
        <input ref={importRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={importRecords} />
        <button type="button" className="btn small" disabled={!records.length} onClick={() => downloadCsv(serializeDecisionReviewCsv(records), "weekly_decision_review")}>{t.export}</button>
        <button type="button" className="btn small" disabled={!records.length} onClick={() => downloadText(buildBrief(sortedRecords, t, locale), "weekly_operating_brief")}>{t.brief}</button>
        {message && <span role="status">{message}</span>}
      </section>
      <p className="weekly-review-page__privacy">{t.privacy}</p>
      {sortedRecords.length === 0 ? <div className="weekly-review-page__empty">{t.empty}</div> : (
        <section className="weekly-review-page__ledger" aria-label={t.title}>
          {sortedRecords.map((record) => {
            const status = record.status === "reviewed" ? "reviewed" : isDue(record.reviewDate) ? "due" : "upcoming";
            const statusLabel = status === "reviewed" ? t.reviewed : status === "due" ? t.due : t.upcoming;
            return <article key={record.id} className="weekly-review-record">
              <div className="weekly-review-record__top">
                <span>{toolName(record.toolId, locale)}</span>
                <em className={`weekly-review-record__status ${status}`}>{statusLabel}</em>
              </div>
              <h2>{record.action}</h2>
              {record.hypothesis && <p>{record.hypothesis}</p>}
              <div className="weekly-review-record__baseline"><span>{t.baseline}</span><strong>{record.metric || t.noMetric} · {record.baseline || "—"}</strong><span>{t.reviewDate}</span><strong>{record.reviewDate || "—"}</strong></div>
              <div className="weekly-review-record__fields">
                <label><span>{t.actual}</span><input value={record.actual} onChange={(event) => updateRecord(record.id, "actual", event.target.value)} /></label>
                <label><span>{t.learning}</span><input value={record.learning} onChange={(event) => updateRecord(record.id, "learning", event.target.value)} /></label>
              </div>
              <button type="button" className="btn text" onClick={() => setRecords((current) => current.filter((item) => item.id !== record.id))}>{t.remove}</button>
            </article>;
          })}
        </section>
      )}
    </main>
  );
}
