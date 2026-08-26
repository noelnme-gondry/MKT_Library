"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import Papa from "papaparse";
import { trackProductEvent } from "@/lib/analytics";
import { assessDecisionOutcome, decisionMetricDirection, getDecisionReviewBucket, normalizeDecisionReviewRows, serializeDecisionReviewCsv, serializeDecisionReviewIcs, toLocalDecisionDate } from "@/lib/decisionReview";
import { DECISION_REVIEW_OPEN_EVENT } from "@/lib/decisionReviewUi";
import { latestDecisionDataDate } from "@/lib/decisionComparableActual";
import { createDecisionComparisonScope } from "@/lib/decisionComparisonScope";
import { buildDatasetContinuitySnapshot, serializeDatasetContinuitySnapshot } from "@/lib/dataContinuity";
import { useAppStore } from "@/store/useDataStore";
import { downloadCalendar, downloadCsv } from "@/utils/download";

function nextWeekDate() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return toLocalDecisionDate(date);
}

function createDraft(prefill = {}, defaults = {}) {
  const source = prefill && typeof prefill === "object" && !Array.isArray(prefill) ? prefill : {};
  const text = (value) => typeof value === "string" ? value : String(value ?? "");
  return {
    conclusion: text(source.conclusion),
    action: text(source.action),
    hypothesis: text(source.hypothesis),
    metric: text(source.metric),
    targetDirection: ["higher", "lower", "neutral"].includes(text(source.targetDirection)) ? text(source.targetDirection) : "",
    comparisonKind: text(source.comparisonKind),
    forecastPeriod: text(source.forecastPeriod),
    forecastTarget: text(source.forecastTarget),
    forecastPlatform: text(source.forecastPlatform),
    forecastValue: text(source.forecastValue),
    forecastLower: text(source.forecastLower),
    forecastUpper: text(source.forecastUpper),
    forecastSourceThrough: text(source.forecastSourceThrough),
    baseline: text(source.baseline),
    baselineDate: /^\d{4}-\d{2}-\d{2}$/.test(text(source.baselineDate)) ? text(source.baselineDate) : (defaults.baselineDate || ""),
    comparisonWindowDays: String(Number(source.comparisonWindowDays) || defaults.comparisonWindowDays || 7),
    reviewQuestion: text(source.reviewQuestion),
    sourcePeriod: text(source.sourcePeriod),
    reviewDate: /^\d{4}-\d{2}-\d{2}$/.test(text(source.reviewDate)) ? text(source.reviewDate) : nextWeekDate(),
  };
}

function reviewDateCue(value, locale) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return locale === "en" ? "Review date" : "검토 예정일";
  const target = new Date(`${value}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (days === 0) return locale === "en" ? "Review today" : "오늘 검토";
  if (days > 0) return locale === "en" ? `Review in ${days} day${days === 1 ? "" : "s"}` : `${days}일 뒤 검토`;
  return locale === "en" ? `${Math.abs(days)} day${days === -1 ? "" : "s"} overdue` : `${Math.abs(days)}일 지남`;
}

function formatReviewDate(value, locale) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return "—";
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ko-KR", {
    month: "short",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

const COPY = {
  ko: {
    summary: "다음 검토 약속 만들기",
    closeEditor: "편집 접기",
    suggestedAction: "추천 행동",
    emptyAction: "결과에서 실행할 행동을 정하세요",
    helper: "현재 결론을 한 가지 행동으로 바꾸고, 검토일에 실제 결과와 배운 점을 이어서 기록하세요.",
    privacySession: "현재 브라우저 세션에서 도구 간 공유됩니다. 새로고침 뒤에도 보려면 아래 저장을 직접 켜세요.",
    privacySaved: "결정 요약과 직접 올린 원본 파일을 이 기기에 최대 90일 저장 중입니다. 서버로 전송하지 않으며, 저장 화면에서 언제든 지울 수 있습니다.",
    persistence: "이 기기에 결정 요약 저장",
    persistenceHint: "이 브라우저에만 저장되고 서버로 전송되지 않습니다. 직접 입력하거나 결과에서 채운 채널·캠페인·소재·행동·분석 요소명과 요약 수치가 기록에 남습니다(공용 기기라면 켜지 마세요). 끄면 저장본은 제거되고 현재 세션 기록은 유지됩니다.",
    persistenceError: "브라우저 저장소를 사용할 수 없어 저장을 켜지 못했습니다. CSV로 내보내 보관해 주세요.",
    saved: (date) => `결정 저장됨 · 다음 검토 ${date}`,
    persistencePrompt: "다음 주에도 이 결정을 다시 보시겠어요?",
    persistencePromptHint: "켜두면 다음 주에 이어서 볼 수 있습니다. 지금은 새로고침하거나 페이지를 닫으면 기록이 사라집니다.",
    keepOnDevice: "이 기기에 저장",
    exportNow: "CSV로 내보내기",
    keepSession: "이번만 세션 유지",
    addCalendar: "검토일을 캘린더에 추가",
    calendarShort: "캘린더",
    promptPrivacy: "채널·캠페인·소재명과 요약 수치가 기록에 남을 수 있습니다. 공용 기기에서는 저장을 켜지 마세요. 캘린더 파일에는 결정 내용이 포함되지 않습니다.",
    sourceConclusion: "현재 분석 결론",
    sourcePeriod: "분석 기간",
    action: "무엇을 바꿀까요?",
    actionPlaceholder: "예: Meta 캠페인 예산을 20% 줄인다",
    hypothesis: "왜 효과가 날까요?",
    hypothesisPlaceholder: "예: 빈도 과다 캠페인을 줄이면 CPA가 안정된다",
    metric: "검증 지표",
    metricPlaceholder: "예: CPA, ROAS, 전환수",
    targetDirection: "무엇이 개선인가요?",
    directionUnset: "방향 선택 · 변화량만 표시",
    directionHigher: "높아지면 개선",
    directionLower: "낮아지면 개선",
    directionNeutral: "방향 판정 안 함",
    directionHint: "CPA·ROAS 등은 자동 제안되며 언제든 바꿀 수 있습니다.",
    forecastSnapshot: "다음 CSV와 자동 대조",
    forecastRange: "참고범위",
    forecastSourceThrough: "예측 기준 데이터",
    baseline: "현재 기준값 (선택)",
    baselineDate: "기준값 데이터 기준일",
    comparisonWindow: "비교 기간 (일)",
    comparisonHint: "기준일 다음 날부터 같은 길이의 데이터가 모두 들어오면 검토일에 실제값 후보를 만듭니다.",
    reviewQuestion: "검토일에 답할 질문",
    reviewQuestionPlaceholder: "예: CPA가 목표 이하로 회복됐는가?",
    reviewDate: "검토 예정일",
    add: "다음 검토로 저장",
    export: "CSV 내보내기",
    import: "CSV 불러오기",
    pending: "검토 대기",
    overdue: "기한 지남",
    today: "오늘 검토",
    upcoming: "검토 예정",
    unscheduled: "검토일 없음",
    reviewed: "검토 완료",
    actual: "실제 결과",
    actualPlaceholder: "예: CPA 4,980원",
    learning: "배운 점 / 다음 조치",
    learningPlaceholder: "예: 절감 예산은 검색 캠페인으로 이동",
    saveReview: "검토 반영",
    remove: "삭제",
    empty: "이 도구에서 남긴 결정이 없습니다. 위 추천을 필요한 만큼만 고쳐 다음 검토로 저장하세요.",
    importError: "읽을 수 있는 결정 기록 행이 없습니다. 내보낸 CSV 형식인지 확인해 주세요.",
    imported: (count) => `${count}개의 결정 기록을 불러왔습니다.`,
    error: "실행할 변경 내용을 먼저 적어 주세요.",
    ledger: "BASELINE → ACTUAL",
    change: "기준 대비",
    improved: "지표 개선",
    declined: "지표 악화",
    unchanged: "변화 없음",
    unscored: "방향 판정 보류",
    lowerHint: "낮을수록 좋은 지표",
    higherHint: "높을수록 좋은 지표",
    unscoredHint: "좋고 나쁨을 정하지 않고 변화량만 표시",
    openWeeklyReview: "주간 검토 열기 →",
  },
  en: {
    summary: "Schedule the next review",
    closeEditor: "Close editor",
    suggestedAction: "Suggested action",
    emptyAction: "Choose the action to take from this result",
    helper: "Turn this conclusion into one action, then return on the review date to log the outcome and learning.",
    privacySession: "Shared across tools for this browser session. Explicitly enable device storage below to keep it after a reload.",
    privacySaved: "Decision summaries and files you upload directly are stored on this device for up to 90 days. Nothing is sent to a server, and you can remove it at any time in Storage.",
    persistence: "Keep decision summaries on this device",
    persistenceHint: "Stored only in this browser and never sent to a server. Channel, campaign, creative, action, or analysis-element names and summary figures you enter—or accept from a result prefill—remain in the record (do not enable this on a shared device). Turning it off removes the stored copy while keeping this session's records.",
    persistenceError: "Browser storage is unavailable, so retention could not be enabled. Export a CSV to keep these records.",
    saved: (date) => `Decision saved · next review ${date}`,
    persistencePrompt: "Do you want to return to this decision next week?",
    persistencePromptHint: "Keep it on to pick this up next week. For now, this record disappears when you reload or close the page.",
    keepOnDevice: "Save on this device",
    exportNow: "Export CSV",
    keepSession: "Keep for this session",
    addCalendar: "Add review date to calendar",
    calendarShort: "Calendar",
    promptPrivacy: "Channel, campaign, creative names, and summary figures may remain in the record. Do not enable storage on a shared device. The calendar file does not contain decision details.",
    sourceConclusion: "Current analysis conclusion",
    sourcePeriod: "Analysis period",
    action: "What will change?",
    actionPlaceholder: "e.g. Reduce Meta campaign budget by 20%",
    hypothesis: "Why should it work?",
    hypothesisPlaceholder: "e.g. Reducing high-frequency campaigns stabilizes CPA",
    metric: "Metric to review",
    metricPlaceholder: "e.g. CPA, ROAS, conversions",
    targetDirection: "What counts as improvement?",
    directionUnset: "Choose a direction · show change only",
    directionHigher: "Higher is better",
    directionLower: "Lower is better",
    directionNeutral: "Do not judge direction",
    directionHint: "CPA, ROAS, and other clear metrics are suggested automatically and can be changed.",
    forecastSnapshot: "Match with the next CSV",
    forecastRange: "Reference range",
    forecastSourceThrough: "Forecast data through",
    baseline: "Current baseline (optional)",
    baselineDate: "Baseline data through",
    comparisonWindow: "Comparison window (days)",
    comparisonHint: "On the review date, an actual candidate appears after the full same-length window following the baseline is available.",
    reviewQuestion: "Question to answer on review day",
    reviewQuestionPlaceholder: "e.g. Did CPA return below target?",
    reviewDate: "Review date",
    add: "Save for next review",
    export: "Export CSV",
    import: "Import CSV",
    pending: "Review pending",
    overdue: "Overdue",
    today: "Review today",
    upcoming: "Upcoming",
    unscheduled: "No review date",
    reviewed: "Reviewed",
    actual: "Actual outcome",
    actualPlaceholder: "e.g. CPA 4,980 KRW",
    learning: "Learning / next action",
    learningPlaceholder: "e.g. Move saved budget to search",
    saveReview: "Save review",
    remove: "Remove",
    empty: "No decision from this tool yet. Edit the suggestion as needed, then save it for the next review.",
    importError: "No usable decision rows found. Check that this is an exported decision-review CSV.",
    imported: (count) => `Imported ${count} decision ${count === 1 ? "record" : "records"}.`,
    error: "Add the action you plan to take first.",
    ledger: "BASELINE → ACTUAL",
    change: "vs baseline",
    improved: "Metric improved",
    declined: "Metric declined",
    unchanged: "No change",
    unscored: "Direction not scored",
    lowerHint: "Lower is better for this metric",
    higherHint: "Higher is better for this metric",
    unscoredHint: "Shows the change without calling it better or worse",
    openWeeklyReview: "Open weekly review →",
  },
};

export default function DecisionReview({ toolId, locale = "ko", decisionPrefill = null, decisionPrefillKey = "", sourcePath = "" }) {
  const t = COPY[locale] || COPY.ko;
  const instanceId = useId();
  const detailsId = `decision-review-${toolId}-${instanceId.replace(/:/g, "")}`;
  const csvData = useAppStore((state) => state.csvData);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeDataGroup = useAppStore((state) => state.activeDataGroup);
  const dashboardFilter = useAppStore((state) => state.dashboardFilter);
  const latestDataDate = useMemo(() => latestDecisionDataDate(csvData?.canonicalData), [csvData?.canonicalData]);
  const draftDefaults = useMemo(() => ({ baselineDate: latestDataDate, comparisonWindowDays: 7 }), [latestDataDate]);
  const resolvedSourcePath = useMemo(() => {
    if (sourcePath) return sourcePath;
    const normalizedPath = (pathname || "/").replace(/^\/en(?=\/|$)/, "") || "/";
    const stage = searchParams?.get("stage");
    return stage ? `${normalizedPath}?stage=${stage}` : normalizedPath;
  }, [pathname, searchParams, sourcePath]);
  const [draft, setDraft] = useState(() => createDraft(decisionPrefill, draftDefaults));
  const [isDraftDirty, setIsDraftDirty] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [savedDecision, setSavedDecision] = useState(null);
  const [isPersistencePromptOpen, setIsPersistencePromptOpen] = useState(false);
  const detailsRef = useRef(null);
  const actionInputRef = useRef(null);
  const importRef = useRef(null);
  const appliedPrefillKey = useRef(`${toolId}:${decisionPrefillKey}`);
  const draftToolId = useRef(toolId);
  const allRecords = useAppStore((state) => state.decisionRecords);
  const records = allRecords.filter((record) => record.toolId === toolId);
  const isPersistenceEnabled = useAppStore((state) => state.decisionPersistenceEnabled);
  const isPersistencePromptSeen = useAppStore((state) => state.decisionPersistencePromptSeen);
  const markPersistencePromptSeen = useAppStore((state) => state.markDecisionPersistencePromptSeen);
  const setDecisionPersistenceEnabled = useAppStore((state) => state.setDecisionPersistenceEnabled);
  const addDecisionRecord = useAppStore((state) => state.addDecisionRecord);
  const importDecisionRecords = useAppStore((state) => state.importDecisionRecords);
  const updateDecisionRecord = useAppStore((state) => state.updateDecisionRecord);
  const removeDecisionRecord = useAppStore((state) => state.removeDecisionRecord);

  useEffect(() => {
    const target = detailsRef.current;
    if (!target) return undefined;
    const openFromExternalAction = (event) => {
      const source = event.detail?.source || "external";
      setIsOpen(true);
      trackProductEvent("decision_review_opened", {
        tool_id: toolId,
        source,
        placement: source === "tool_assist_rail"
          ? "tool_assist_rail"
          : "result_action_card",
        locale,
      });
      const revealEditor = () => {
        if (!target.isConnected) return;
        const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
        const focusTarget = actionInputRef.current;
        focusTarget?.scrollIntoView?.({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "center" });
        focusTarget?.focus({ preventScroll: true });
      };
      if (typeof window.requestAnimationFrame === "function") {
        window.requestAnimationFrame(() => window.requestAnimationFrame(revealEditor));
      } else {
        window.setTimeout(revealEditor, 0);
      }
    };
    target.addEventListener(DECISION_REVIEW_OPEN_EVENT, openFromExternalAction);
    return () => target.removeEventListener(DECISION_REVIEW_OPEN_EVENT, openFromExternalAction);
  }, [locale, toolId]);

  useEffect(() => {
    const nextKey = `${toolId}:${decisionPrefillKey}`;
    const hasToolChanged = draftToolId.current !== toolId;
    if (nextKey === appliedPrefillKey.current || (!hasToolChanged && isDraftDirty)) return;
    setDraft(createDraft(decisionPrefill, draftDefaults));
    appliedPrefillKey.current = nextKey;
    draftToolId.current = toolId;
    if (hasToolChanged) setIsDraftDirty(false);
  }, [decisionPrefill, decisionPrefillKey, draftDefaults, isDraftDirty, toolId]);

  const updateDraft = (key, value) => {
    setIsDraftDirty(true);
    setDraft((current) => ({ ...current, [key]: value }));
  };
  const addRecord = () => {
    if (!draft.action.trim()) {
      setMessage(t.error);
      return;
    }
    const savedRecord = {
      toolId,
      sourcePath: resolvedSourcePath,
      locale,
      createdAt: new Date().toISOString(),
      conclusion: draft.conclusion.trim(),
      action: draft.action.trim(),
      hypothesis: draft.hypothesis.trim(),
      metric: draft.metric.trim(),
      targetDirection: draft.targetDirection || decisionMetricDirection(draft.metric),
      comparisonKind: draft.comparisonKind,
      forecastPeriod: draft.forecastPeriod,
      forecastTarget: draft.forecastTarget,
      forecastPlatform: draft.forecastPlatform,
      forecastValue: draft.forecastValue,
      forecastLower: draft.forecastLower,
      forecastUpper: draft.forecastUpper,
      forecastSourceThrough: draft.forecastSourceThrough,
      baseline: draft.baseline.trim(),
      baselineDate: draft.baselineDate,
      comparisonWindowDays: draft.comparisonWindowDays,
      comparisonScope: createDecisionComparisonScope({ dataGroup: activeDataGroup, filter: dashboardFilter }),
      datasetSnapshot: serializeDatasetContinuitySnapshot(buildDatasetContinuitySnapshot(csvData?.canonicalData, {
        dataGroup: activeDataGroup,
        mapping: csvData?.mapping,
      })),
      reviewQuestion: draft.reviewQuestion.trim(),
      reviewDate: draft.reviewDate,
      sourcePeriod: draft.sourcePeriod.trim(),
      actual: "",
      learning: "",
    };
    addDecisionRecord(savedRecord);
    setSavedDecision(savedRecord);
    if (!isPersistenceEnabled && !isPersistencePromptSeen) {
      markPersistencePromptSeen();
      setIsPersistencePromptOpen(true);
    }
    setDraft(createDraft(decisionPrefill, draftDefaults));
    setIsDraftDirty(false);
    appliedPrefillKey.current = `${toolId}:${decisionPrefillKey}`;
    draftToolId.current = toolId;
    setMessage("");
    trackProductEvent("decision_record_added", { tool_id: toolId, source: "decision_review", placement: "result_action_card", locale });
  };

  const updateRecord = (id, key, value) => updateDecisionRecord(id, { [key]: value });

  const exportRecords = () => {
    if (!records.length) return;
    downloadCsv(serializeDecisionReviewCsv(records), `decision_review_${toolId || "tool"}`);
    trackProductEvent("decision_record_exported", { tool_id: toolId, source: "decision_review", placement: "result_action_card", locale });
  };

  const enablePersistenceFromPrompt = () => {
    const didUpdate = setDecisionPersistenceEnabled(true);
    if (didUpdate === false) {
      setMessage(t.persistenceError);
      return;
    }
    setIsPersistencePromptOpen(false);
    trackProductEvent("decision_persistence_changed", { state: "enabled", source: "post_save_prompt", locale });
  };

  const exportCalendar = (record = savedDecision || records[0]) => {
    const calendar = serializeDecisionReviewIcs(record, locale);
    if (!calendar) return;
    downloadCalendar(calendar, `decision_review_${toolId || "tool"}`);
    trackProductEvent("decision_review_reminder_exported", {
      tool_id: toolId,
      source: "post_save_prompt",
      placement: "result_action_card",
      download_type: "ics",
      locale,
    });
  };

  const importRecords = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const text = await file.text();
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: "greedy" });
    const imported = normalizeDecisionReviewRows(parsed.data, toolId);
    if (!imported.length) {
      setMessage(t.importError);
      return;
    }
    importDecisionRecords(imported, toolId);
    setMessage(t.imported(imported.length));
    trackProductEvent("decision_record_imported", { tool_id: toolId, source: "decision_review", placement: "result_action_card", locale });
  };

  return (
    <details
      ref={detailsRef}
      id={detailsId}
      className="decision-review"
      data-decision-review-tool={toolId}
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
    >
      <summary
        onClick={() => {
          if (!isOpen) trackProductEvent("decision_review_opened", { tool_id: toolId, source: "result_tape", placement: "result_action_card", locale });
        }}
      >
        <span className="decision-review__tape-main">
          <small>{t.suggestedAction}</small>
          <strong>{draft.action || t.emptyAction}</strong>
        </span>
        <span className="decision-review__tape-date">
          <small>{reviewDateCue(draft.reviewDate, locale)}</small>
          <strong>{formatReviewDate(draft.reviewDate, locale)}</strong>
        </span>
        <span className="decision-review__tape-cta">{isOpen ? t.closeEditor : t.summary}<b aria-hidden="true">{isOpen ? "↑" : "→"}</b></span>
        {records.length > 0 && <em>{records.length}</em>}
      </summary>
      <div className="decision-review__body">
        <p className="decision-review__helper">{t.helper}</p>
        <div className={`decision-review__persistence ${isPersistenceEnabled ? "is-enabled" : ""}`}>
          <label>
            <input
              type="checkbox"
              role="switch"
              checked={isPersistenceEnabled}
              onChange={(event) => {
                const enabled = event.target.checked;
                const didUpdate = setDecisionPersistenceEnabled(enabled);
                setMessage(enabled && didUpdate === false ? t.persistenceError : "");
                trackProductEvent("decision_persistence_changed", {
                  state: enabled && didUpdate !== false ? "enabled" : "disabled",
                  source: "decision_review",
                  locale,
                });
              }}
            />
            <span>{t.persistence}</span>
          </label>
          <small>{t.persistenceHint}</small>
        </div>
        <p className="decision-review__privacy">{isPersistenceEnabled ? t.privacySaved : t.privacySession}</p>

        {draft.conclusion && (
          <div className="decision-review__prefill">
            <span>{t.sourceConclusion}</span>
            <strong>{draft.conclusion}</strong>
            {draft.sourcePeriod && <small>{t.sourcePeriod} · {draft.sourcePeriod}</small>}
          </div>
        )}

        {draft.comparisonKind === "forecast_actual" && draft.forecastPeriod && (
          <div className="decision-review__forecast-ticket">
            <span>{t.forecastSnapshot}</span>
            <strong>{draft.forecastPeriod} · {draft.metric || draft.forecastTarget} {draft.baseline}</strong>
            {(draft.forecastLower || draft.forecastUpper) && <small>{t.forecastRange} · {draft.forecastLower || "—"}–{draft.forecastUpper || "—"}</small>}
            {draft.forecastSourceThrough && <small>{t.forecastSourceThrough} · {draft.forecastSourceThrough}</small>}
          </div>
        )}

        <div className="decision-review__form">
          <label className="decision-review__field decision-review__field--wide">
            <span>{t.action}</span>
            <input ref={actionInputRef} value={draft.action} onChange={(event) => updateDraft("action", event.target.value)} placeholder={t.actionPlaceholder} />
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
            <span>{t.targetDirection}</span>
            <select aria-label={t.targetDirection} value={draft.targetDirection || decisionMetricDirection(draft.metric)} onChange={(event) => updateDraft("targetDirection", event.target.value)}>
              <option value="">{t.directionUnset}</option>
              <option value="higher">{t.directionHigher}</option>
              <option value="lower">{t.directionLower}</option>
              <option value="neutral">{t.directionNeutral}</option>
            </select>
            <small>{t.directionHint}</small>
          </label>
          <label className="decision-review__field">
            <span>{t.baseline}</span>
            <input value={draft.baseline} onChange={(event) => updateDraft("baseline", event.target.value)} placeholder="—" />
          </label>
          <label className="decision-review__field">
            <span>{t.baselineDate}</span>
            <input type="date" value={draft.baselineDate} onChange={(event) => updateDraft("baselineDate", event.target.value)} />
          </label>
          <label className="decision-review__field">
            <span>{t.comparisonWindow}</span>
            <input type="number" min="1" max="60" value={draft.comparisonWindowDays} onChange={(event) => updateDraft("comparisonWindowDays", event.target.value)} />
            <small>{t.comparisonHint}</small>
          </label>
          <label className="decision-review__field">
            <span>{t.reviewDate}</span>
            <input type="date" value={draft.reviewDate} onChange={(event) => updateDraft("reviewDate", event.target.value)} />
          </label>
          <label className="decision-review__field decision-review__field--wide">
            <span>{t.reviewQuestion}</span>
            <input value={draft.reviewQuestion} onChange={(event) => updateDraft("reviewQuestion", event.target.value)} placeholder={t.reviewQuestionPlaceholder} />
          </label>
          <button type="button" className="btn primary decision-review__add" onClick={addRecord}>{t.add}</button>
        </div>

        {isPersistencePromptOpen && savedDecision && (
          <section className="decision-review__save-prompt" aria-labelledby={`${detailsId}-save-title`}>
            <div>
              <small>{t.saved(formatReviewDate(savedDecision.reviewDate, locale))}</small>
              <strong id={`${detailsId}-save-title`}>{t.persistencePrompt}</strong>
              <p>{t.persistencePromptHint}</p>
            </div>
            <div className="decision-review__save-prompt-actions">
              <button type="button" className="btn primary small" onClick={enablePersistenceFromPrompt}>{t.keepOnDevice}</button>
              <button type="button" className="btn small" onClick={() => { exportRecords(); setIsPersistencePromptOpen(false); }}>{t.exportNow}</button>
              <button type="button" className="btn small" onClick={() => exportCalendar()}>{t.addCalendar}</button>
              <button type="button" className="btn ghost small" onClick={() => setIsPersistencePromptOpen(false)}>{t.keepSession}</button>
            </div>
            <p className="decision-review__save-prompt-privacy">{t.promptPrivacy}</p>
          </section>
        )}

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
            {records.map((record) => {
              const bucket = getDecisionReviewBucket(record);
              const statusLabel = bucket === "reviewed" ? t.reviewed : t[bucket] || t.pending;
              const outcome = assessDecisionOutcome(record);
              const comparison = outcome.comparison;
              const targetDirection = record.targetDirection || decisionMetricDirection(record.metric);
              const outcomeHint = outcome.direction === "lower" ? t.lowerHint : outcome.direction === "higher" ? t.higherHint : t.unscoredHint;
              return (
              <article className="decision-review__record" key={record.id}>
                <div className="decision-review__record-head">
                  <div>
                    <strong>{record.action}</strong>
                    {record.hypothesis && <p>{record.hypothesis}</p>}
                    {record.reviewQuestion && <p className="decision-review__question">Q. {record.reviewQuestion}</p>}
                  </div>
                  <span className={`decision-review__status ${bucket}`}>{statusLabel}</span>
                </div>
                <div className="decision-review__comparison">
                  <span><small>{record.metric || "—"}</small>{record.baseline || "—"}</span>
                  <b>→</b>
                  <label>
                    <span className="sr-only">{t.actual} — {record.action}</span>
                    <input value={record.actual} onChange={(event) => updateRecord(record.id, "actual", event.target.value)} placeholder={t.actualPlaceholder} />
                  </label>
                </div>
                <div className="decision-review__direction-row">
                  <label>
                    <span>{t.targetDirection}</span>
                    <select aria-label={`${t.targetDirection} — ${record.action}`} value={targetDirection} onChange={(event) => updateRecord(record.id, "targetDirection", event.target.value)}>
                      <option value="">{t.directionUnset}</option>
                      <option value="higher">{t.directionHigher}</option>
                      <option value="lower">{t.directionLower}</option>
                      <option value="neutral">{t.directionNeutral}</option>
                    </select>
                  </label>
                  {comparison && <div className={`decision-review__outcome ${outcome.state}`}>
                    <span>{t[outcome.state]}</span>
                    <strong>{comparison.delta > 0 ? "+" : ""}{comparison.delta.toLocaleString(locale === "en" ? "en-US" : "ko-KR", { maximumFractionDigits: 2 })}{comparison.isPercentPoint ? (locale === "en" ? " pp" : "%p") : ""}</strong>
                    <small>{outcomeHint}</small>
                  </div>}
                </div>
                <div className="decision-review__record-footer">
                  <span>{record.reviewDate || "—"}</span>
                  <label>
                    <span className="sr-only">{t.learning} — {record.action}</span>
                    <input value={record.learning} onChange={(event) => updateRecord(record.id, "learning", event.target.value)} placeholder={t.learningPlaceholder} />
                  </label>
                  <button type="button" aria-label={`${record.action} — ${t.addCalendar}`} className="btn text" disabled={!record.reviewDate} onClick={() => exportCalendar(record)}>{t.calendarShort}</button>
                  <button type="button" aria-label={`${record.action} — ${t.remove}`} className="btn text decision-review__remove" onClick={() => removeDecisionRecord(record.id)}>{t.remove}</button>
                </div>
              </article>
              );
            })}
          </div>
        )}
      </div>
    </details>
  );
}
