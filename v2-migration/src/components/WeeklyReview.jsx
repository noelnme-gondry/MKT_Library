"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import {
  getDecisionReviewBucket,
  decisionNumericComparison,
  normalizeDecisionReviewRows,
  serializeDecisionReviewCsv,
  toLocalDecisionDate,
} from "@/lib/decisionReview";
import { localizedTool } from "@/lib/toolConnections";
import { trackProductEvent } from "@/lib/analytics";
import { findMeta, useAppStore } from "@/store/useDataStore";
import { downloadCsv, downloadText } from "@/utils/download";

const COPY = {
  ko: {
    eyebrow: "WEEKLY REVIEW",
    title: "이번 주 결정 인박스",
    deck: "분석 결과에서 저장한 행동을 검토일 순서로 모았습니다. 실제값과 배운 점을 남겨 다음 판단의 근거로 바꾸세요.",
    import: "결정 기록 CSV 불러오기",
    export: "수정한 CSV 내보내기",
    brief: "공유용 브리프 받기",
    empty: "아직 저장한 결정이 없습니다. 분석 결과의 ‘다음 검토 약속’에서 행동 하나를 저장하면 여기에 바로 나타납니다.",
    overdue: "기한 지남",
    today: "오늘 검토",
    upcoming: "예정",
    unscheduled: "검토일 없음",
    reviewed: "검토 완료",
    actual: "실제 결과",
    learning: "배운 점 / 다음 조치",
    remove: "삭제",
    imported: (count) => `${count}개의 결정 기록을 불러왔습니다.`,
    importError: "결정 기록을 찾지 못했습니다. 결과 카드에서 내보낸 CSV인지 확인해 주세요.",
    privacySession: "현재 세션에서만 유지됩니다. 새로고침 뒤에도 보려면 이 기기 저장을 직접 켜세요.",
    privacySaved: "결정 요약만 이 기기에 저장 중입니다. 원본 CSV·분석 행·파일명·차트 데이터는 저장하지 않습니다.",
    persistence: "이 기기에 결정 요약 저장",
    persistenceHint: "직접 입력하거나 결과에서 자동으로 채운 채널·캠페인·소재·행동·분석 요소명과 요약 수치는 기록에 남을 수 있습니다. 공용 기기에서는 켜지 마세요. 끄면 저장본만 제거되고 현재 세션 기록은 유지됩니다.",
    persistenceError: "브라우저 저장소를 사용할 수 없어 저장을 켜지 못했습니다. CSV로 내보내 보관해 주세요.",
    clear: "전체 기록 삭제",
    clearConfirm: "이 브라우저의 결정 기록을 모두 삭제할까요? 이 작업은 되돌릴 수 없습니다.",
    inboxSummary: "검토 현황",
    baseline: "기준",
    reviewDate: "검토일",
    noMetric: "지표 미입력",
    briefTitle: "주간 운영 브리프",
    briefPending: "검토 대기",
    briefReviewed: "검토 완료",
    hypothesis: "가설",
    conclusion: "당시 결론",
    reviewQuestion: "검토 질문",
    sourcePeriod: "분석 기간",
    change: "기준 대비 변화",
  },
  en: {
    eyebrow: "WEEKLY REVIEW",
    title: "This week’s decision inbox",
    deck: "Actions saved from analysis results are ordered by review date. Add the outcome and learning to turn each call into evidence.",
    import: "Import decision CSV",
    export: "Export updated CSV",
    brief: "Download share brief",
    empty: "No decisions saved yet. Save one action from a result card’s ‘next review’ section and it will appear here immediately.",
    overdue: "Overdue",
    today: "Review today",
    upcoming: "Upcoming",
    unscheduled: "No review date",
    reviewed: "Reviewed",
    actual: "Actual outcome",
    learning: "Learning / next action",
    remove: "Remove",
    imported: (count) => `Imported ${count} decision ${count === 1 ? "record" : "records"}.`,
    importError: "No decision records found. Check that this is a CSV exported from a result card.",
    privacySession: "Kept for this session only. Explicitly enable device storage to retain it after a reload.",
    privacySaved: "Only decision summaries are stored on this device. Source CSV rows, file names, and chart data are never included.",
    persistence: "Keep decision summaries on this device",
    persistenceHint: "Channel, campaign, creative, action, or analysis-element names and summary figures you enter—or accept from a result prefill—may remain in the record. Do not enable this on a shared device. Turning it off removes the stored copy while keeping this session's records.",
    persistenceError: "Browser storage is unavailable, so retention could not be enabled. Export a CSV to keep these records.",
    clear: "Delete all records",
    clearConfirm: "Delete every decision record in this browser? This cannot be undone.",
    inboxSummary: "Review status",
    baseline: "Baseline",
    reviewDate: "Review date",
    noMetric: "No metric set",
    briefTitle: "Weekly operating brief",
    briefPending: "Pending review",
    briefReviewed: "Reviewed",
    hypothesis: "Hypothesis",
    conclusion: "Original conclusion",
    reviewQuestion: "Review question",
    sourcePeriod: "Analysis period",
    change: "Change from baseline",
  },
};

function toolName(toolId, locale) {
  const meta = findMeta(toolId);
  return localizedTool(toolId, locale)?.title || (locale === "en" ? meta?.titleEn : meta?.title) || toolId || "—";
}

function comparisonLabel(comparison, locale) {
  if (!comparison) return "";
  const formatter = new Intl.NumberFormat(locale === "en" ? "en-US" : "ko-KR", { maximumFractionDigits: 2 });
  const sign = comparison.delta > 0 ? "+" : "";
  const unit = comparison.isPercentPoint ? (locale === "en" ? " pp" : "%p") : "";
  const ratio = comparison.changePct == null ? "" : ` · ${comparison.changePct > 0 ? "+" : ""}${(comparison.changePct * 100).toFixed(1)}%`;
  return `${sign}${formatter.format(comparison.delta)}${unit}${ratio}`;
}

export function buildBrief(records, t, locale) {
  const today = toLocalDecisionDate();
  const lines = [`# ${t.briefTitle}`, "", `- ${today}`, "", "## Decisions"];
  records.forEach((record) => {
    lines.push(`### ${toolName(record.toolId, locale)} — ${record.action}`);
    lines.push(`- ${t.reviewDate}: ${record.reviewDate || "—"}`);
    lines.push(`- ${t.baseline}: ${record.metric || t.noMetric} ${record.baseline || "—"}`);
    lines.push(`- ${getDecisionReviewBucket(record, today) === "reviewed" ? t.briefReviewed : t.briefPending}: ${record.actual || "—"}`);
    lines.push(`- ${t.learning}: ${record.learning || "—"}`);
    if (record.hypothesis) lines.push(`- ${t.hypothesis}: ${record.hypothesis}`);
    if (record.conclusion) lines.push(`- ${t.conclusion}: ${record.conclusion}`);
    if (record.reviewQuestion) lines.push(`- ${t.reviewQuestion}: ${record.reviewQuestion}`);
    if (record.sourcePeriod) lines.push(`- ${t.sourcePeriod}: ${record.sourcePeriod}`);
    lines.push("");
  });
  return `${lines.join("\n")}\n`;
}

export default function WeeklyReview({ locale = "ko" }) {
  const t = COPY[locale] || COPY.ko;
  const [message, setMessage] = useState("");
  const importRef = useRef(null);
  const hasTrackedInboxView = useRef(false);
  const records = useAppStore((state) => state.decisionRecords);
  const isPersistenceEnabled = useAppStore((state) => state.decisionPersistenceEnabled);
  const setDecisionPersistenceEnabled = useAppStore((state) => state.setDecisionPersistenceEnabled);
  const importDecisionRecords = useAppStore((state) => state.importDecisionRecords);
  const updateDecisionRecord = useAppStore((state) => state.updateDecisionRecord);
  const removeDecisionRecord = useAppStore((state) => state.removeDecisionRecord);
  const clearDecisionRecords = useAppStore((state) => state.clearDecisionRecords);
  const todayKey = toLocalDecisionDate();
  const sortedRecords = useMemo(() => [...records].sort((a, b) => {
    const weights = { overdue: 0, today: 1, unscheduled: 2, upcoming: 3, reviewed: 4 };
    const aWeight = weights[getDecisionReviewBucket(a, todayKey)];
    const bWeight = weights[getDecisionReviewBucket(b, todayKey)];
    return aWeight - bWeight || String(a.reviewDate).localeCompare(String(b.reviewDate));
  }), [records, todayKey]);
  const statusCounts = useMemo(() => sortedRecords.reduce((counts, record) => {
    const bucket = getDecisionReviewBucket(record, todayKey);
    counts[bucket] += 1;
    return counts;
  }, { overdue: 0, today: 0, upcoming: 0, unscheduled: 0, reviewed: 0 }), [sortedRecords, todayKey]);

  useEffect(() => {
    if (hasTrackedInboxView.current) return;
    hasTrackedInboxView.current = true;
    const dueCount = statusCounts.overdue + statusCounts.today;
    trackProductEvent("decision_inbox_viewed", {
      source: "weekly_review",
      result_state: records.length === 0 ? "empty" : dueCount > 0 ? "due" : "active",
      locale,
    });
  }, [locale, records.length, statusCounts.overdue, statusCounts.today]);

  const importRecords = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const parsed = Papa.parse(await file.text(), { header: true, skipEmptyLines: "greedy" });
    const imported = normalizeDecisionReviewRows(parsed.data);
    if (!imported.length) {
      setMessage(t.importError);
      return;
    }
    importDecisionRecords(imported);
    setMessage(t.imported(imported.length));
  };

  const updateRecord = (id, key, value) => {
    const current = records.find((record) => record.id === id);
    const wasReviewed = getDecisionReviewBucket(current, todayKey) === "reviewed";
    const next = current ? { ...current, [key]: value } : null;
    updateDecisionRecord(id, { [key]: value });
    if (!wasReviewed && next && getDecisionReviewBucket(next, todayKey) === "reviewed") {
      trackProductEvent("decision_review_completed", {
        tool_id: next.toolId,
        source: "weekly_review",
        result_state: "reviewed",
        locale,
      });
    }
  };

  return (
    <main id="main-content" className="page-inner weekly-review-page">
      <header className="weekly-review-page__head">
        <div className="weekly-review-page__eyebrow">{t.eyebrow}</div>
        <h1>{t.title}</h1>
        <p>{t.deck}</p>
      </header>

      <section className="weekly-review-page__summary" aria-label={t.inboxSummary}>
        {(["overdue", "today", "unscheduled", "upcoming", "reviewed"]).map((status) => (
          <div key={status} className={`weekly-review-page__summary-item ${status}`}>
            <span>{t[status]}</span>
            <strong>{statusCounts[status]}</strong>
          </div>
        ))}
      </section>

      <section className={`weekly-review-page__storage ${isPersistenceEnabled ? "is-enabled" : ""}`}>
        <div>
          <strong>{t.persistence}</strong>
          <p>{t.persistenceHint}</p>
        </div>
        <label>
          <input
            aria-label={t.persistence}
            type="checkbox"
            role="switch"
            checked={isPersistenceEnabled}
            onChange={(event) => {
              const enabled = event.target.checked;
              const didUpdate = setDecisionPersistenceEnabled(enabled);
              setMessage(enabled && didUpdate === false ? t.persistenceError : "");
            }}
          />
          <span aria-hidden="true" />
        </label>
      </section>

      <section className="weekly-review-page__toolbar" aria-label={t.title}>
        <button type="button" className="btn small" onClick={() => importRef.current?.click()}>{t.import}</button>
        <input ref={importRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={importRecords} />
        <button type="button" className="btn small" disabled={!records.length} onClick={() => downloadCsv(serializeDecisionReviewCsv(records), "weekly_decision_review")}>{t.export}</button>
        <button type="button" className="btn small" disabled={!records.length} onClick={() => downloadText(buildBrief(sortedRecords, t, locale), "weekly_operating_brief")}>{t.brief}</button>
        <button
          type="button"
          className="btn text weekly-review-page__clear"
          disabled={!records.length}
          onClick={() => {
            if (typeof window !== "undefined" && window.confirm(t.clearConfirm)) clearDecisionRecords();
          }}
        >
          {t.clear}
        </button>
        {message && <span role="status">{message}</span>}
      </section>
      <p className="weekly-review-page__privacy">{isPersistenceEnabled ? t.privacySaved : t.privacySession}</p>
      {sortedRecords.length === 0 ? <div className="weekly-review-page__empty">{t.empty}</div> : (
        <section className="weekly-review-page__ledger" aria-label={t.title}>
          {sortedRecords.map((record) => {
            const status = getDecisionReviewBucket(record, todayKey);
            const statusLabel = t[status];
            const comparison = decisionNumericComparison(record);
            return <article key={record.id} className="weekly-review-record">
              <div className="weekly-review-record__top">
                <span>{toolName(record.toolId, locale)}</span>
                <em className={`weekly-review-record__status ${status}`}>{statusLabel}</em>
              </div>
              <h2>{record.action}</h2>
              {record.conclusion && <p className="weekly-review-record__context"><span>{t.conclusion}</span>{record.conclusion}</p>}
              {record.hypothesis && <p>{record.hypothesis}</p>}
              {record.reviewQuestion && <div className="weekly-review-record__question"><span>{t.reviewQuestion}</span><strong>{record.reviewQuestion}</strong></div>}
              <div className="weekly-review-record__baseline">
                <span>{t.baseline}</span><strong>{record.metric || t.noMetric} · {record.baseline || "—"}</strong>
                {record.sourcePeriod && <><span>{t.sourcePeriod}</span><strong>{record.sourcePeriod}</strong></>}
              </div>
              {comparison && <div className="weekly-review-record__delta"><span>{t.change}</span><strong>{comparisonLabel(comparison, locale)}</strong></div>}
              <div className="weekly-review-record__fields">
                <label><span>{t.reviewDate}</span><input type="date" value={record.reviewDate} onChange={(event) => updateRecord(record.id, "reviewDate", event.target.value)} /></label>
                <label><span>{t.actual}</span><input aria-label={`${t.actual} — ${record.action}`} value={record.actual} onChange={(event) => updateRecord(record.id, "actual", event.target.value)} /></label>
                <label><span>{t.learning}</span><input aria-label={`${t.learning} — ${record.action}`} value={record.learning} onChange={(event) => updateRecord(record.id, "learning", event.target.value)} /></label>
              </div>
              <button type="button" aria-label={`${record.action} — ${t.remove}`} className="btn text" onClick={() => removeDecisionRecord(record.id)}>{t.remove}</button>
            </article>;
          })}
        </section>
      )}
    </main>
  );
}
