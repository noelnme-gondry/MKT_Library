"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Papa from "papaparse";
import {
  assessDecisionOutcome,
  decisionReviewAgeBucket,
  decisionReviewFollowUpMode,
  getDecisionReviewBucket,
  decisionMetricDirection,
  normalizeDecisionReviewRows,
  serializeDecisionReviewCsv,
  serializeDecisionReviewIcs,
  summarizeDecisionOutcomes,
  toLocalDecisionDate,
} from "@/lib/decisionReview";
import { assessForecastActual } from "@/lib/forecastReview";
import { buildComparableDecisionActual } from "@/lib/decisionComparableActual";
import { buildDatasetContinuitySnapshot, classifyDatasetContinuity } from "@/lib/dataContinuity";
import { localizedTool } from "@/lib/toolConnections";
import { groupForRoute } from "@/lib/toolGroups";
import { trackProductEvent } from "@/lib/analytics";
import { findMeta, useAppStore } from "@/store/useDataStore";
import { downloadCsv, downloadText, downloadCalendar } from "@/utils/download";
import NewsletterSignup from "@/components/seo/NewsletterSignup";

const COPY = {
  ko: {
    eyebrow: "WEEKLY REVIEW",
    title: "이번 주 결정 인박스",
    deck: "분석 결과에서 저장한 행동을 검토일 순서로 모았습니다. 실제 결과와 배운 점을 남겨 다음 판단에 다시 쓰세요.",
    import: "결정 기록 CSV 불러오기",
    export: "수정한 CSV 내보내기",
    brief: "공유용 브리프 받기",
    reminder: "다음 검토일 캘린더에 추가",
    empty: "아직 저장한 결정이 없습니다. 분석 결과의 ‘다음 검토 약속’에서 행동 하나를 저장하면 여기에 바로 나타납니다.",
    emptyTitle: "첫 결정을 이렇게 쌓습니다",
    emptySteps: ["내 데이터로 분석 실행", "결과에서 행동·검토일 저장", "검토일에 실제 결과·배운 점 기록"],
    emptyStart: "내 데이터로 첫 분석",
    emptyDiagnose: "필요한 분석부터 진단",
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
    privacySaved: "결정 요약과 직접 올린 원본 파일을 이 기기에 마지막 사용 후 90일까지 저장 중입니다. 서버로 전송하지 않으며, 저장 화면에서 언제든 지울 수 있습니다.",
    persistence: "원본 파일과 결정 기록을 이 기기에 저장",
    persistenceHint: "직접 올린 CSV·XLSX 원본 파일과 결정 기록을 이 브라우저에 마지막 사용 후 90일까지 보관하며 서버로 전송하지 않습니다. 공용 기기라면 켜지 마세요. 끄면 저장본은 제거되고 현재 세션 기록은 유지됩니다.",
    persistenceError: "브라우저 저장소를 사용할 수 없어 저장을 켜지 못했습니다. CSV로 내보내 보관해 주세요.",
    clear: "전체 기록 삭제",
    clearConfirm: "이 브라우저의 결정 기록을 모두 삭제할까요? 이 작업은 되돌릴 수 없습니다.",
    clearAction: "삭제하기",
    cancel: "취소",
    inboxSummary: "검토 현황",
    baseline: "기준",
    baselineDate: "기준 데이터",
    comparisonWindow: "비교 기간",
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
    outcomeSummary: "지난 판단 결과",
    outcomeSummaryDeck: "기준값과 실제값이 숫자인 기록만 집계합니다. 목표 방향이 있을 때만 개선·악화를 판정합니다.",
    improved: "지표 개선",
    declined: "지표 악화",
    unchanged: "변화 없음",
    unscored: "방향 판정 보류",
    targetDirection: "무엇이 개선인가요?",
    directionUnset: "방향 선택 · 변화량만 표시",
    directionHigher: "높아지면 개선",
    directionLower: "낮아지면 개선",
    directionNeutral: "방향 판정 안 함",
    lowerHint: "낮을수록 좋은 지표 기준",
    higherHint: "높을수록 좋은 지표 기준",
    unscoredHint: "좋고 나쁨을 정하지 않고 변화량만 표시",
    actualPlaceholder: "예: 4,980 또는 15.2%",
    dataCandidate: "새 데이터 비교 후보",
    candidateReady: "기준일 다음 날부터 같은 기간의 데이터가 모두 쌓였습니다. 확인한 뒤 검토를 완료하세요.",
    candidateNotDue: "검토일 전에는 데이터를 실제 결과로 처리하지 않습니다.",
    candidateWaiting: "비교 기간의 데이터가 아직 없습니다. 이전 CSV의 마지막 기간은 실제 결과로 쓰지 않습니다.",
    candidateIncomplete: (days, total) => `같은 ${total}일 비교를 위해 ${days}일치 데이터가 더 필요합니다.`,
    candidateMissingBasis: "기준일과 지원 지표(CPA·CPI·ROAS)를 입력하면 같은 기간으로 자동 비교할 수 있습니다.",
    candidateMissingScope: "이전 기록에는 데이터 범위가 저장되지 않아 자동 비교하지 않습니다. 같은 범위에서 새 검토를 저장하세요.",
    candidateDatasetMismatch: "이 결정에 쓴 데이터가 이 기기에 없거나 범위가 달라 자동 비교하지 않습니다. 원본 도구에서 같은 범위의 데이터를 올려 확인하세요.",
    continuity: "업로드 데이터 확인",
    continuityDuplicate: "이전 판단과 같은 기간·같은 데이터입니다. 새 결과를 만들지 않고 기존 판단을 다시 엽니다.",
    continuityRevised: "같은 기간의 값이 이전 파일과 달라졌습니다. 수정된 마감 데이터일 수 있으니 기존 판단을 갱신해 확인하세요.",
    continuityNext: "다음 기간 데이터입니다. 지난 판단의 후속 기간으로 검토할 수 있습니다.",
    continuityGap: "이전 기간 뒤에 데이터 공백이 있습니다. 분석은 가능하지만 연속된 후속 검토로 읽지 않습니다.",
    continuityPartial: "이전 기간과 일부 겹칩니다. 잠정치·백필·수정 데이터일 수 있으니 비교 범위를 확인하세요.",
    continuityBackfill: "이전 판단보다 과거 기간 데이터입니다. 후속 결과가 아닌 별도 분석으로 처리합니다.",
    continuityChanged: "이전 판단과 컬럼 역할이 달라 자동 비교하지 않습니다.",
    continuityProvisional: "최근 기간이라 집계가 더 바뀔 수 있습니다.",
    candidatePeriod: "비교 기간",
    useCandidate: "이 값으로 검토하기",
    completeReview: "검토 완료로 저장",
    completeLocked: "검토일 전에는 완료할 수 없습니다.",
    outcome: "기준 대비 결과",
    forecastComparison: "예측 대조",
    forecastTicket: "예측 대조 약속",
    forecastPeriod: "예측 주차",
    forecastValue: "당시 예측",
    forecastRange: "참고범위",
    forecastPending: "새 실제값을 기다리는 중",
    forecastPendingHint: "마케팅 예측에 업데이트된 CSV를 올리면 같은 주차·타깃·플랫폼의 실제값만 찾아 제안합니다.",
    openForecast: "마케팅 예측에서 실제값 찾기 →",
    within_range: "참고범위 안",
    outside_range: "참고범위 밖",
    point_only: "예측 대조 완료",
    forecastError: "예측 대비 오차",
    withinRangeHint: "실제값이 저장 당시 참고범위 안에 있습니다.",
    outsideRangeHint: "실제값이 저장 당시 참고범위를 벗어났습니다. 원인과 구조변화를 함께 확인하세요.",
    pointOnlyHint: "저장된 참고범위가 없어 점예측과 실제값만 비교합니다.",
    openSource: "원본 도구 열기",
    followUpMethod: "다음 검토 방식",
    period_auto: "새 데이터 자동 대조",
    period_autoHint: "같은 범위의 CPA·CPI·ROAS 후속 기간을 모두 받으면 실제값 후보를 제안합니다.",
    period_setup: "자동 대조 설정 필요",
    period_setupHint: "기준일과 비교 범위를 채우면 같은 기간의 후속 데이터를 자동 대조할 수 있습니다.",
    forecast_auto: "예측 자동 대조",
    forecast_autoHint: "마케팅 예측에 새 CSV를 올리면 저장한 기간·타깃·플랫폼의 실제값만 제안합니다.",
    rerun_manual: "새 데이터 재분석 후 기록",
    rerun_manualHint: "VIF·ASA·증분 추정처럼 진단형 결과는 원본 도구에서 새 데이터를 다시 분석한 뒤 실제 결과와 배운 점을 기록합니다.",
  },
  en: {
    eyebrow: "WEEKLY REVIEW",
    title: "This week’s decision inbox",
    deck: "Actions saved from analysis results are ordered by review date. Add the outcome and learning to turn each call into evidence.",
    import: "Import decision CSV",
    export: "Export updated CSV",
    brief: "Download share brief",
    reminder: "Add next review to calendar",
    empty: "No decisions saved yet. Save one action from a result card’s ‘next review’ section and it will appear here immediately.",
    emptyTitle: "Build your first decision record",
    emptySteps: ["Run an analysis with your data", "Save an action and review date from the result", "Record the outcome and learning on the review date"],
    emptyStart: "Run my first analysis",
    emptyDiagnose: "Diagnose what to analyze",
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
    privacySaved: "Decision summaries and files you upload directly are stored on this device until 90 days after their last use. Nothing is sent to a server, and you can remove them at any time in Storage.",
    persistence: "Store source files and decision records on this device",
    persistenceHint: "Uploaded CSV/XLSX source files and decision records stay in this browser until 90 days after their last use and are never sent to a server. Do not enable this on a shared device. Turning it off removes persisted copies while keeping this session's records.",
    persistenceError: "Browser storage is unavailable, so retention could not be enabled. Export a CSV to keep these records.",
    clear: "Delete all records",
    clearConfirm: "Delete every decision record in this browser? This cannot be undone.",
    clearAction: "Delete records",
    cancel: "Cancel",
    inboxSummary: "Review status",
    baseline: "Baseline",
    baselineDate: "Baseline data through",
    comparisonWindow: "Comparison window",
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
    outcomeSummary: "Previous decision outcomes",
    outcomeSummaryDeck: "Only records with numeric baselines and actuals are counted. Better or worse is shown only when the target direction is known.",
    improved: "Metric improved",
    declined: "Metric declined",
    unchanged: "No change",
    unscored: "Direction not scored",
    targetDirection: "What counts as improvement?",
    directionUnset: "Choose a direction · show change only",
    directionHigher: "Higher is better",
    directionLower: "Lower is better",
    directionNeutral: "Do not judge direction",
    lowerHint: "Scored as a lower-is-better metric",
    higherHint: "Scored as a higher-is-better metric",
    unscoredHint: "Shows the change without calling it better or worse",
    actualPlaceholder: "e.g. 4,980 or 15.2%",
    dataCandidate: "New-data comparison candidate",
    candidateReady: "An equally long window after the baseline is ready. Confirm it before marking this review complete.",
    candidateNotDue: "Data is not treated as an actual outcome before the review date.",
    candidateWaiting: "The comparison window is not in the current data yet. The end of an older CSV is never used as the actual outcome.",
    candidateIncomplete: (days, total) => `${days} of ${total} comparable days are available; wait for the full window.`,
    candidateMissingBasis: "Add a baseline date and a supported metric (CPA, CPI, or ROAS) to compare the same window automatically.",
    candidateMissingScope: "This older record did not save its data scope, so it is not compared automatically. Save a new review from the same scope.",
    candidateDatasetMismatch: "The CSV currently open is not the dataset used for this decision, so it is not compared automatically.",
    continuity: "Uploaded-data check",
    continuityDuplicate: "This is the same period and same data as the prior decision. Reopen the existing decision instead of creating a new result.",
    continuityRevised: "Values changed for the same period. This may be revised final data, so review the prior decision against this update.",
    continuityNext: "This is the next period of data and can be reviewed as the follow-up to the prior decision.",
    continuityGap: "There is a gap after the prior period. Analysis remains available, but this is not read as a continuous follow-up review.",
    continuityPartial: "This file partly overlaps the prior period. It may be provisional, backfilled, or revised data; check the comparison range.",
    continuityBackfill: "This file predates the prior decision. It is treated as a separate historical analysis, not a follow-up outcome.",
    continuityChanged: "Column roles changed from the prior decision, so no automatic comparison is made.",
    continuityProvisional: "This is a recent period and its totals may still change.",
    candidatePeriod: "Comparison period",
    useCandidate: "Review with this value",
    completeReview: "Mark review complete",
    completeLocked: "This review cannot be completed before its review date.",
    outcome: "Outcome vs baseline",
    forecastComparison: "Forecast comparison",
    forecastTicket: "Forecast check-in",
    forecastPeriod: "Forecast period",
    forecastValue: "Original forecast",
    forecastRange: "Reference range",
    forecastPending: "Waiting for a new actual",
    forecastPendingHint: "Upload an updated CSV in Marketing Forecast to suggest only an actual with the same period, target, and platform.",
    openForecast: "Find the actual in Marketing Forecast →",
    within_range: "Inside reference range",
    outside_range: "Outside reference range",
    point_only: "Forecast compared",
    forecastError: "Error vs forecast",
    withinRangeHint: "The actual is inside the reference range saved with the forecast.",
    outsideRangeHint: "The actual is outside the saved reference range. Check drivers and regime changes before acting.",
    pointOnlyHint: "No reference range was saved, so only the point forecast and actual are compared.",
    openSource: "Open source tool",
    followUpMethod: "Next review method",
    period_auto: "Automatic new-data comparison",
    period_autoHint: "After a full matching CPA, CPI, or ROAS window is available in the same scope, we suggest an actual value.",
    period_setup: "Set up automatic comparison",
    period_setupHint: "Add a baseline date and comparison scope to compare an equally long follow-up window automatically.",
    forecast_auto: "Automatic forecast comparison",
    forecast_autoHint: "Upload a new CSV in Marketing Forecast to suggest only the actual for the saved period, target, and platform.",
    rerun_manual: "Rerun with new data, then record",
    rerun_manualHint: "For diagnostic results such as VIF, ASA, and incrementality, rerun the source tool with new data, then record the actual outcome and learning.",
  },
};

function toolName(toolId, locale) {
  const meta = findMeta(toolId);
  return localizedTool(toolId, locale)?.title || (locale === "en" ? meta?.titleEn : meta?.title) || toolId || "—";
}

function sourceToolHref(record, locale) {
  if (record?.sourcePath) return `${locale === "en" ? "/en" : ""}${record.sourcePath}`;
  return localizedTool(record?.toolId, locale)?.href || "";
}

function comparisonLabel(comparison, locale) {
  if (!comparison) return "";
  const formatter = new Intl.NumberFormat(locale === "en" ? "en-US" : "ko-KR", { maximumFractionDigits: 2 });
  const sign = comparison.delta > 0 ? "+" : "";
  const unit = comparison.isPercentPoint ? (locale === "en" ? " pp" : "%p") : "";
  const ratio = comparison.changePct == null ? "" : ` · ${comparison.changePct > 0 ? "+" : ""}${(comparison.changePct * 100).toFixed(1)}%`;
  return `${sign}${formatter.format(comparison.delta)}${unit}${ratio}`;
}

function forecastErrorLabel(assessment, locale) {
  if (!assessment || assessment.state === "incomplete") return "";
  const formatter = new Intl.NumberFormat(locale === "en" ? "en-US" : "ko-KR", { maximumFractionDigits: 2 });
  const sign = assessment.delta > 0 ? "+" : "";
  const ratio = assessment.errorPct == null ? "" : ` · ${assessment.errorPct > 0 ? "+" : ""}${(assessment.errorPct * 100).toFixed(1)}%`;
  return `${sign}${formatter.format(assessment.delta)}${ratio}`;
}

export function buildBrief(records, t, locale) {
  const today = toLocalDecisionDate();
  const lines = [`# ${t.briefTitle}`, "", `- ${today}`, "", "## Decisions"];
  records.forEach((record) => {
    lines.push(`### ${toolName(record.toolId, locale)} — ${record.action}`);
    lines.push(`- ${t.reviewDate}: ${record.reviewDate || "—"}`);
    lines.push(`- ${t.baseline}: ${record.metric || t.noMetric} ${record.baseline || "—"}`);
    lines.push(`- ${getDecisionReviewBucket(record, today) === "reviewed" ? t.briefReviewed : t.briefPending}: ${record.actual || "—"}`);
    const outcome = assessDecisionOutcome(record);
    const forecastAssessment = assessForecastActual(record);
    if (forecastAssessment && forecastAssessment.state !== "incomplete") {
      lines.push(`- ${t.forecastComparison}: ${t[forecastAssessment.state]} · ${forecastErrorLabel(forecastAssessment, locale)}`);
    } else if (outcome.comparison && t.outcome && t[outcome.state]) {
      lines.push(`- ${t.outcome}: ${t[outcome.state]} · ${comparisonLabel(outcome.comparison, locale)}`);
    }
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
  const [clearPending, setClearPending] = useState(false);
  const importRef = useRef(null);
  const hasTrackedInboxView = useRef(false);
  const records = useAppStore((state) => state.decisionRecords);
  const csvData = useAppStore((state) => state.csvData);
  const csvGroups = useAppStore((state) => state.csvGroups);
  const activeDataGroup = useAppStore((state) => state.activeDataGroup);
  const decisionSessionRecordIds = useAppStore((state) => state.decisionSessionRecordIds);
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
  // 캘린더 리마인더 대상 = 아직 검토하지 않은 것 중 검토일이 가장 이른 기록.
  // sortedRecords가 이미 overdue→today→unscheduled→upcoming→reviewed 순이라 앞에서 찾는다.
  const nextReviewRecord = useMemo(
    () => sortedRecords.find((record) => record.reviewDate && getDecisionReviewBucket(record, todayKey) !== "reviewed") || null,
    [sortedRecords, todayKey],
  );
  const statusCounts = useMemo(() => sortedRecords.reduce((counts, record) => {
    const bucket = getDecisionReviewBucket(record, todayKey);
    counts[bucket] += 1;
    return counts;
  }, { overdue: 0, today: 0, upcoming: 0, unscheduled: 0, reviewed: 0 }), [sortedRecords, todayKey]);
  const outcomeCounts = useMemo(() => summarizeDecisionOutcomes(sortedRecords), [sortedRecords]);
  const comparableCandidates = useMemo(() => new Map(records.map((record) => {
    // 주간 인박스는 여러 도구의 결정을 함께 보여준다. 현재 보고 있는 도구의
    // csvData만 쓰면 다른 그룹의 정상적인 후속 데이터까지 "CSV 불일치"로
    // 막히므로, 기록이 만들어진 도구 그룹의 브라우저 메모리만 대조한다.
    const recordGroup = groupForRoute(record.toolId);
    const slice = csvGroups?.[recordGroup] || (recordGroup === activeDataGroup ? csvData : null);
    return [record.id, buildComparableDecisionActual(record, {
      canonicalData: slice?.canonicalData,
      today: todayKey,
      dataGroup: recordGroup,
    })];
  })), [activeDataGroup, csvData, csvGroups, records, todayKey]);
  const continuityByRecord = useMemo(() => new Map(records.map((record) => {
    const recordGroup = groupForRoute(record.toolId);
    const slice = csvGroups?.[recordGroup] || (recordGroup === activeDataGroup ? csvData : null);
    const current = buildDatasetContinuitySnapshot(slice?.canonicalData, {
      dataGroup: recordGroup,
      mapping: slice?.mapping,
    });
    return [record.id, classifyDatasetContinuity(record.datasetSnapshot, current)];
  })), [activeDataGroup, csvData, csvGroups, records]);
  const forecastComparedCount = useMemo(() => sortedRecords.filter((record) => {
    const assessment = assessForecastActual(record);
    return assessment && assessment.state !== "incomplete";
  }).length, [sortedRecords]);

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

  const updateRecord = (id, key, value) => updateDecisionRecord(id, { [key]: value });

  const completeReview = (record, actual = record.actual, source = "weekly_review") => {
    if (!record || !record.reviewDate || record.reviewDate > todayKey || !String(actual || "").trim()) return;
    updateDecisionRecord(record.id, {
      actual: String(actual).trim(),
      status: "reviewed",
      reviewedAt: new Date().toISOString(),
    });
    trackProductEvent("decision_review_completed", {
      tool_id: record.toolId,
      source,
      result_state: "reviewed",
      days_since_decision: decisionReviewAgeBucket(record, { isSameSession: decisionSessionRecordIds.has(record.id) }),
      locale,
    });
  };

  return (
    <article className="page-inner weekly-review-page">
      <header className="weekly-review-page__head">
        <div className="weekly-review-page__eyebrow">{t.eyebrow}</div>
        <h1>{t.title}</h1>
        <p>{t.deck}</p>
      </header>

      {sortedRecords.length > 0 && <>
        <section className="weekly-review-page__summary" aria-label={t.inboxSummary}>
          {(["overdue", "today", "unscheduled", "upcoming", "reviewed"]).map((status) => (
            <div key={status} className={`weekly-review-page__summary-item ${status}`}>
              <span>{t[status]}</span>
              <strong>{statusCounts[status]}</strong>
            </div>
          ))}
        </section>

        <section className="weekly-review-page__outcomes" aria-label={t.outcomeSummary}>
          <div className="weekly-review-page__outcomes-copy">
            <strong>{t.outcomeSummary}</strong>
            <p>{t.outcomeSummaryDeck}</p>
            {forecastComparedCount > 0 && <em>{t.forecastComparison} · {forecastComparedCount}</em>}
          </div>
          <div className="weekly-review-page__outcomes-ledger">
            {(["improved", "declined", "unchanged", "unscored"]).map((state) => (
              <div key={state} className={`weekly-review-page__outcome-count ${state}`}>
                <span>{t[state]}</span>
                <strong>{outcomeCounts[state]}</strong>
              </div>
            ))}
          </div>
        </section>
      </>}

      {sortedRecords.length === 0 && <section className="weekly-review-page__empty" aria-labelledby="weekly-review-empty-title">
        <div>
          <span>START HERE</span>
          <h2 id="weekly-review-empty-title">{t.emptyTitle}</h2>
          <p>{t.empty}</p>
        </div>
        <ol>
          {t.emptySteps.map((step, index) => <li key={step}><b>{index + 1}</b><span>{step}</span></li>)}
        </ol>
        <div className="weekly-review-page__empty-actions">
          <Link className="btn primary" href={locale === "en" ? "/en/start" : "/start"}>{t.emptyStart}</Link>
          <Link className="btn ghost" href={locale === "en" ? "/en/diagnose" : "/diagnose"}>{t.emptyDiagnose}</Link>
        </div>
      </section>}

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
        <input ref={importRef} type="file" accept=".csv,text/csv" className="sr-only" aria-label={t.import} onChange={importRecords} />
        <button type="button" className="btn small" disabled={!records.length} onClick={() => downloadCsv(serializeDecisionReviewCsv(records), "weekly_decision_review")}>{t.export}</button>
        <button type="button" className="btn small" disabled={!records.length} onClick={() => downloadText(buildBrief(sortedRecords, t, locale), "weekly_operating_brief", "md", locale)}>{t.brief}</button>
        {/* 리마인더는 저장 직후 프롬프트에만 있어, 정작 원장을 검토하는 이 화면에서
            "다음 검토일을 캘린더에 넣기"가 불가능했다 → 툴바에 노출한다. */}
        <button
          type="button"
          className="btn small"
          disabled={!nextReviewRecord}
          onClick={() => {
            const calendar = serializeDecisionReviewIcs(nextReviewRecord, locale);
            if (!calendar) return;
            downloadCalendar(calendar, "decision_review_next");
            trackProductEvent("decision_review_reminder_exported", {
              source: "weekly_review",
              placement: "weekly_review_toolbar",
              download_type: "ics",
              locale,
            });
          }}
        >{t.reminder}</button>
        <button
          type="button"
          className="btn text weekly-review-page__clear"
          disabled={!records.length}
          onClick={() => setClearPending(true)}
        >
          {t.clear}
        </button>
        {message && <span role="status">{message}</span>}
      </section>
      {clearPending && <section className="weekly-review-page__clear-confirm" role="alertdialog" aria-labelledby="weekly-review-clear-title">
        <p id="weekly-review-clear-title">{t.clearConfirm}</p>
        <div>
          <button type="button" className="btn small" onClick={() => setClearPending(false)}>{t.cancel}</button>
          <button type="button" className="btn small primary" onClick={() => { clearDecisionRecords(); setClearPending(false); }}>{t.clearAction}</button>
        </div>
      </section>}
      <p className="weekly-review-page__privacy">{isPersistenceEnabled ? t.privacySaved : t.privacySession}</p>
      {sortedRecords.length > 0 && <section className="weekly-review-page__ledger" aria-label={t.title}>
          {sortedRecords.map((record) => {
            const status = getDecisionReviewBucket(record, todayKey);
            const statusLabel = t[status];
            const outcome = assessDecisionOutcome(record);
            const comparison = outcome.comparison;
            const targetDirection = record.targetDirection || decisionMetricDirection(record.metric);
            const outcomeHint = outcome.direction === "lower" ? t.lowerHint : outcome.direction === "higher" ? t.higherHint : t.unscoredHint;
            const forecastAssessment = assessForecastActual(record);
            const isForecastReview = Boolean(forecastAssessment);
            const forecastHint = forecastAssessment?.state === "within_range"
              ? t.withinRangeHint
              : forecastAssessment?.state === "outside_range"
                ? t.outsideRangeHint
              : t.pointOnlyHint;
            const comparableCandidate = comparableCandidates.get(record.id);
            const continuity = continuityByRecord.get(record.id);
            const sourceHref = sourceToolHref(record, locale);
            const followUpMode = decisionReviewFollowUpMode(record);
            const isPeriodComparison = followUpMode === "period_auto" || followUpMode === "period_setup";
            const isReviewDue = Boolean(record.reviewDate) && record.reviewDate <= todayKey;
            return <article key={record.id} className="weekly-review-record">
              <div className="weekly-review-record__top">
                {sourceHref ? <Link className="weekly-review-record__source" href={sourceHref}>{toolName(record.toolId, locale)} <span aria-hidden="true">→</span></Link> : <span>{toolName(record.toolId, locale)}</span>}
                <em className={`weekly-review-record__status ${status}`}>{statusLabel}</em>
              </div>
              <h2>{record.action}</h2>
              {record.conclusion && <p className="weekly-review-record__context"><span>{t.conclusion}</span>{record.conclusion}</p>}
              {record.hypothesis && <p>{record.hypothesis}</p>}
              {record.reviewQuestion && <div className="weekly-review-record__question"><span>{t.reviewQuestion}</span><strong>{record.reviewQuestion}</strong></div>}
              <div className="weekly-review-record__baseline">
                <span>{t.baseline}</span><strong>{record.metric || t.noMetric} · {record.baseline || "—"}</strong>
                {record.baselineDate && <><span>{t.baselineDate}</span><strong>{record.baselineDate} · {record.comparisonWindowDays || 7}{locale === "en" ? " days" : "일"}</strong></>}
                {record.sourcePeriod && <><span>{t.sourcePeriod}</span><strong>{record.sourcePeriod}</strong></>}
              </div>
              {isForecastReview && <div className="weekly-review-record__forecast-ticket">
                <div>
                  <span>{t.forecastTicket}</span>
                  <strong>{record.forecastPeriod} · {record.metric || record.forecastTarget}</strong>
                </div>
                <dl>
                  <div><dt>{t.forecastValue}</dt><dd>{record.baseline || record.forecastValue}</dd></div>
                  <div><dt>{t.forecastRange}</dt><dd>{record.forecastLower && record.forecastUpper ? `${record.forecastLower}–${record.forecastUpper}` : "—"}</dd></div>
                </dl>
                {forecastAssessment.state === "incomplete" && <div className="weekly-review-record__forecast-pending">
                  <span>{t.forecastPending}</span>
                  <p>{t.forecastPendingHint}</p>
                  <Link href={locale === "en" ? "/en/tools/marketing-forecast" : "/tools/marketing-forecast"}>{t.openForecast}</Link>
                </div>}
              </div>}
              {!isForecastReview && <label className="weekly-review-record__direction">
                <span>{t.targetDirection}</span>
                <select aria-label={`${t.targetDirection} — ${record.action}`} value={targetDirection} onChange={(event) => updateRecord(record.id, "targetDirection", event.target.value)}>
                  <option value="">{t.directionUnset}</option>
                  <option value="higher">{t.directionHigher}</option>
                  <option value="lower">{t.directionLower}</option>
                  <option value="neutral">{t.directionNeutral}</option>
                </select>
              </label>}
              {forecastAssessment && forecastAssessment.state !== "incomplete" ? <div className={`weekly-review-record__outcome forecast-${forecastAssessment.state}`}>
                <span>{t[forecastAssessment.state]}</span>
                <strong>{forecastErrorLabel(forecastAssessment, locale)}</strong>
                <small>{forecastHint}</small>
              </div> : comparison && <div className={`weekly-review-record__outcome ${outcome.state}`}>
                <span>{t[outcome.state]}</span>
                <strong>{comparisonLabel(comparison, locale)}</strong>
                <small>{outcomeHint}</small>
              </div>}
              <div className={`weekly-review-record__follow-up ${followUpMode}`}>
                <span>{t.followUpMethod}</span>
                <strong>{t[followUpMode]}</strong>
                <p>{t[`${followUpMode}Hint`]}</p>
              </div>
              {!isForecastReview && continuity && !["missing_previous_snapshot", "missing_current_snapshot"].includes(continuity.state) && <div className={`weekly-review-record__candidate continuity-${continuity.state}`}>
                <span>{t.continuity}</span>
                <p>{continuity.state === "duplicate"
                  ? t.continuityDuplicate
                  : continuity.state === "revised_period"
                    ? t.continuityRevised
                    : continuity.state === "next_period"
                      ? t.continuityNext
                      : continuity.state === "gap"
                        ? t.continuityGap
                        : continuity.state === "partial_overlap"
                          ? t.continuityPartial
                          : continuity.state === "historical_backfill"
                            ? t.continuityBackfill
                            : t.continuityChanged}</p>
                {continuity.maturity === "provisional" && <small>{t.continuityProvisional}</small>}
              </div>}
              {!isForecastReview && isPeriodComparison && status !== "reviewed" && comparableCandidate && <div className={`weekly-review-record__candidate ${comparableCandidate.state}`}>
                <span>{t.dataCandidate}</span>
                {comparableCandidate.state === "ready" ? <>
                  <strong>{comparableCandidate.actual}</strong>
                  <small>{t.candidatePeriod} · {comparableCandidate.comparisonStart}–{comparableCandidate.comparisonEnd}</small>
                  <p>{t.candidateReady}</p>
                  <button type="button" className="btn small" onClick={() => completeReview(record, comparableCandidate.actual, "comparable_data")}>{t.useCandidate}</button>
                </> : <p>{comparableCandidate.state === "not_due"
                  ? t.candidateNotDue
                  : comparableCandidate.state === "waiting_for_data"
                    ? t.candidateWaiting
                    : comparableCandidate.state === "incomplete_window"
                      ? t.candidateIncomplete(comparableCandidate.observedDays || 0, comparableCandidate.windowDays)
                      : comparableCandidate.state === "missing_scope"
                        ? t.candidateMissingScope
                        : comparableCandidate.state === "dataset_mismatch"
                          ? t.candidateDatasetMismatch
                      : t.candidateMissingBasis}</p>}
              </div>}
              {sourceHref && <Link className="weekly-review-record__source-link" href={sourceHref}>{t.openSource} <span aria-hidden="true">→</span></Link>}
              <div className="weekly-review-record__fields">
                <label><span>{t.reviewDate}</span><input type="date" value={record.reviewDate} onChange={(event) => updateRecord(record.id, "reviewDate", event.target.value)} /></label>
                <label><span>{t.actual}</span><input aria-label={`${t.actual} — ${record.action}`} value={record.actual} onChange={(event) => updateRecord(record.id, "actual", event.target.value)} placeholder={t.actualPlaceholder} /></label>
                <label><span>{t.learning}</span><input aria-label={`${t.learning} — ${record.action}`} value={record.learning} onChange={(event) => updateRecord(record.id, "learning", event.target.value)} /></label>
              </div>
              {status !== "reviewed" && <div className="weekly-review-record__complete">
                <button type="button" className="btn small primary" disabled={!isReviewDue || !record.actual.trim()} onClick={() => completeReview(record)}>{t.completeReview}</button>
                {!isReviewDue && <small>{t.completeLocked}</small>}
              </div>}
              <button type="button" aria-label={`${record.action} — ${t.remove}`} className="btn text" onClick={() => removeDecisionRecord(record.id)}>{t.remove}</button>
            </article>;
          })}
        </section>}
      {sortedRecords.length > 0 && <NewsletterSignup locale={locale} source="product" placement="weekly_review" />}
    </article>
  );
}
