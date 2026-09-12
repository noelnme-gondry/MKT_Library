"use client";
import { requirePaidExport } from "@/lib/subscription/paidExport";
import AccountArchive from "@/components/AccountArchive";
import ReviewSaveDialog from "@/components/ReviewSaveDialog";
import { AnalysisExportProvider } from "@/lib/analysis-export/AnalysisExportContext";
import { buildWeeklyReviewExport } from "@/lib/analysis-export/weeklyReviewExport";
import DownloadHub from "@/components/ds/DownloadHub";
import { isDemoData, decisionDataOrigin } from "@/lib/dataOrigin";

/**
 * Weekly Review — 주간 성과를 읽고 이번 주 행동 하나를 정하는 화면.
 *
 * 순수 모듈 7개(period · significance · snapshot · router · varianceBridge · decisionScore ·
 * reportDraft)를 순서대로 부르고 결과를 그린다. **여기에는 수학이 없다** — 계산은 전부 모듈이
 * 하고 화면은 그 결과와 사유를 문장으로 옮긴다.
 *
 * 화면이 지켜야 하는 것(명세 §4~§8):
 * - 결론이 먼저, 차트·표는 근거로 뒤에.
 * - 신호가 없으면 원인·행동 카드를 **접는다**. 그게 정상 경로다.
 * - "조용함"과 "판정 불가"를 다른 문장으로 쓴다.
 * - 분해에서 뺀 지출이 있으면 **반드시 고지한다**.
 * - 추천과 내 결정을 시각적으로 가른다. 저장되는 것은 언제나 사용자가 고른 값이다.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import CsvUploader from "@/components/CsvUploader";
import { computeAnalyzeSig, useAppStore } from "@/store/useDataStore";
import { getMappedRows } from "@/utils/dashboardAggregator";
import { LOWER_IS_BETTER } from "@/lib/weekly-review/significance";
import { DECISION_OUTCOME } from "@/lib/weekly-review/decisionScore";
import { serializeDecisionReviewIcs } from "@/lib/decisionReview";
import { downloadCalendar } from "@/utils/download";
import { createDecisionComparisonScope } from "@/lib/decisionComparisonScope";
import { DEFAULT_PROJECT, KPI_OPTIONS, kpiFor, runReview, nextReviewDate } from "@/lib/weekly-review/reviewPipeline";
import { mergeSnapshots, listStoredSnapshots, saveStoredSnapshot, readReviewProject, saveReviewProject } from "@/lib/weekly-review/snapshotStore";
import { outcomeLabel, buildReportDraft, describeAction, renderReportText } from "@/lib/weekly-review/reportDraft";
import { trackProductEvent, trackProductEventOnce, productEventKey } from "@/lib/analytics";
import JourneyProgress from "@/components/ds/JourneyProgress";
import WeeklyReview from "@/components/WeeklyReview";
import WeeklyReviewHandoverNotice from "@/components/weekly-review/WeeklyReviewHandoverNotice";
import { fmtPct } from "@/utils/format";
import { buildWorkspaceEvidence, parseReviewTarget, workspaceReportNotes, formatReviewMetric } from "@/lib/weekly-review/workspaceEvidence";
import WeeklyEvidencePanel from "./WeeklyEvidencePanel";
import WeeklyProjectSetup from "./WeeklyProjectSetup";
import WeeklyReportDocument from "./WeeklyReportDocument";

const COPY = {
  ko: {
    eyebrow: "WEEKLY REVIEW",
    title: "주간 리뷰",
    verdictHead: "이번 주 결론",
    whyHead: "왜 그랬나",
    lastHead: "지난 결정 이후의 관측",
    nextHead: "이번 주에 할 것",
    shareHead: "팀 공유 보고서",
    historyToggle: (n) => `지난 결정 전체 보기 (${n}건)`,
    noData: "이번 주 데이터를 올려주세요.",
    noDataDeck: "처음에는 비교할 두 기간의 캠페인 CSV를 올리세요. 이후에는 다음 기간 CSV와 이 기기에 저장한 집계로 비교하고, 지난 결정 이후의 변화를 검토합니다. 날짜·캠페인·비용·전환 또는 설치 열이 필요합니다.",
    goUpload: "데이터 올리기",
    quiet: "설정한 확인 기준을 넘는 변화가 없습니다.",
    unknown: "이번 기간의 핵심 지표를 잴 수 없었습니다.",
    metricsCaption: "지표",
    driversCaption: "캠페인별",
    recommend: "Growth Opt 추천",
    mine: "내 결정",
    save: "이 결정 저장",
    saved: "저장했습니다. 다음 주에 이 결정의 결과를 확인할 수 있습니다.",
    copy: "복사",
    kpiLabel: "핵심 지표",
    basisLabel: "전환 기준",
    basisActions: "가입·구매 등(actions)",
    basisInstalls: "설치(installs)",
    periodLabel: "비교 기간",
    periodAuto: "자동 (최신 날짜의 요일까지)",
    periodCustom: "직접 지정",
    curStart: "이번 시작", curEnd: "이번 끝",
    prevStart: "지난 시작", prevEnd: "지난 끝",
    lengthWarn: "기간 길이가 다릅니다. 변화율이 기간 차이 때문일 수 있습니다.",
    historyNote: (n) => `저장된 주간 기록 ${n}주 — 평소 변동 범위를 이 기록으로 판정합니다.`,
    historyNone: "비교 가능한 주간 기록이 없어 평소 변동 범위는 아직 모릅니다. 기기 저장이 켜져 있어야 다음 방문에도 기록이 남습니다.",
    goalLabel: "목표", guardLabel: "가드레일", amountLabel: "크기",
    guardHint: "가드레일을 비우면 다음 주에 자동으로 판정할 수 없습니다.",
  },
  en: {
    eyebrow: "WEEKLY REVIEW",
    title: "Weekly Review",
    verdictHead: "This week",
    whyHead: "Why",
    lastHead: "Observations after the last decision",
    nextHead: "What to do this week",
    shareHead: "Team review report",
    historyToggle: (n) => `All past decisions (${n})`,
    noData: "Upload this week's data.",
    noDataDeck: "Start with a campaign CSV covering both periods. Next time, compare the next period with an aggregate saved on this device and review changes after your decision. Include date, campaign, spend, and conversions or installs.",
    goUpload: "Upload data",
    quiet: "No change crossed the configured review criteria.",
    unknown: "This period's headline metric could not be measured.",
    metricsCaption: "Metrics",
    driversCaption: "By campaign",
    recommend: "Growth Opt suggests",
    mine: "My decision",
    save: "Save this decision",
    saved: "Saved. You can check the result of this decision next week.",
    copy: "Copy",
    kpiLabel: "Headline metric",
    basisLabel: "Conversion basis",
    basisActions: "Actions (signup, purchase…)",
    basisInstalls: "Installs",
    periodLabel: "Comparison period",
    periodAuto: "Automatic (through the latest weekday)",
    periodCustom: "Set manually",
    curStart: "This from", curEnd: "This to",
    prevStart: "Last from", prevEnd: "Last to",
    lengthWarn: "The two periods differ in length. The change may reflect that difference.",
    historyNote: (n) => `${n} weeks of saved history — the usual range is judged from these.`,
    historyNone: "No comparable history yet, so the usual range is unknown. Device storage must be on to keep records for your next visit.",
    goalLabel: "Goal", guardLabel: "Guardrail", amountLabel: "Size",
    guardHint: "Leave the guardrail empty and next week's review cannot score this decision.",
  },
};

// 셀렉터가 매 렌더 새 배열을 만들면 아래 useMemo가 매번 다시 돈다.
const EMPTY_RECORDS = [];

const ACTION_KINDS = [
  { id: "hold", ko: "유지", en: "Hold" },
  { id: "increase_budget", ko: "증액", en: "Increase" },
  { id: "decrease_budget", ko: "감액", en: "Decrease" },
  { id: "replace", ko: "교체", en: "Replace" },
  { id: "investigate", ko: "추가 확인", en: "Investigate" },
];

const REASON_TEXT = {
  ko: {
    change_too_small: "변화 폭이 작습니다.",
    within_normal_range: "최근 변동 범위 안입니다.",
    volume_too_low: "표본이 적어 판정하지 않았습니다.",
    no_volume: "전환 컬럼이 없어 표본을 확인하지 못했습니다.",
    no_value: "이번 또는 지난 기간의 지표를 계산할 수 없습니다.",
    no_previous_value: "지난 기간 값이 0이라 변화율을 만들 수 없습니다.",
    no_previous_data: "비교할 지난 기간 데이터가 없습니다.",
    no_dates: "날짜 컬럼을 읽지 못했습니다.",
    missing_campaign: "캠페인 열을 매핑하고, 캠페인명이 빈 행을 확인해 주세요.",
    snapshot_currency_mismatch: "저장된 기록의 통화가 다르거나 확인되지 않았습니다. 같은 통화의 2주치 CSV를 올려주세요.",
  },
  en: {
    change_too_small: "The change is small.",
    within_normal_range: "Within the recent range.",
    volume_too_low: "Too few conversions to judge.",
    no_volume: "No conversion column, so sample size is unknown.",
    no_value: "This or last period's metric could not be computed.",
    no_previous_value: "Last period was zero, so no percentage change exists.",
    no_previous_data: "No data for the comparison period.",
    no_dates: "Could not read a date column.",
    missing_campaign: "Map the campaign column and check rows with an empty campaign name.",
    snapshot_currency_mismatch: "The saved snapshot currency differs or is unknown. Upload both periods in the same currency.",
  },
};

function pct(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${value >= 0 ? "+" : "−"}${fmtPct(Math.abs(value))}`;
}

function money(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function WeeklyReviewScreen({ locale = "ko", embedded = false }) {
  const activeProjectId = useAppStore(state => state.activeProjectId);
  return <ProjectWeeklyReview key={activeProjectId} locale={locale} projectId={activeProjectId} embedded={embedded} />;
}

function ProjectWeeklyReview({ locale, projectId, embedded }) {
  const sheetRefreshRef = useRef(null);
  const [refreshingConnectedSheet, setRefreshingConnectedSheet] = useState(false);
  const t = COPY[locale] || COPY.ko;
  const csvData = useAppStore((state) => state.csvData);
  const reviewSource = isDemoData(csvData) ? "demo" : "csv";
  const decisionRecords = useAppStore((state) => state.decisionRecords ?? EMPTY_RECORDS);
  const sessionDecisionIds = useAppStore((state) => state.decisionSessionRecordIds);
  const existingDecisionCount = decisionRecords.filter((record) => record.toolId !== "weekly-review" && !sessionDecisionIds.has(record.id)).length;
  const [pendingSave, setPendingSave] = useState(null);
  const persistenceEnabled = useAppStore((state) => state.decisionPersistenceEnabled);
  const workspaceStatus = useAppStore((state) => state.workspaceRestoreStatus);
  const workspaceReady = !persistenceEnabled || ["ready", "failed"].includes(workspaceStatus);
  const isAnalyzed = useAppStore((state) => state.isGroupAnalyzed("5-2"));
  const setCurrentRouteId = useAppStore((state) => state.setCurrentRouteId);
  const [copyStatus, setCopyStatus] = useState("");
  const [projectName, setProjectName] = useState("");
  const [targetCurrency, setTargetCurrency] = useState(null);
  const [targetValue, setTargetValue] = useState("");
  const [snapshotStatus, setSnapshotStatus] = useState(null);
  const [projectStatus, setProjectStatus] = useState("");
  const [projectReady, setProjectReady] = useState(false);
  const viewRecorded = useRef(false);
  useEffect(() => { setCurrentRouteId("weekly-review"); }, [setCurrentRouteId]);
  useEffect(() => {
    if (!workspaceReady || viewRecorded.current) return;
    viewRecorded.current = trackProductEvent("weekly_review_viewed", { locale, tool_id: "weekly-review", visit_type: decisionRecords.length ? "with_history" : "without_history" });
  }, [locale, workspaceReady, decisionRecords.length]);

  const [kpiMetric, setKpiMetric] = useState(DEFAULT_PROJECT.kpi.metric);
  const [basis, setBasis] = useState(DEFAULT_PROJECT.kpi.basis);
  const [customPeriod, setCustomPeriod] = useState(null);
  const [storedSnapshots, setStoredSnapshots] = useState([]);
  const [snapshotsReady, setSnapshotsReady] = useState(false);
  const [decision, setDecision] = useState({
    actionKind: "hold", actionTarget: "", actionAmount: "",
    goalMetric: "conversions", goalDirection: "up",
    guardrailMetric: "cpa", guardrailOp: "lte", guardrailValue: "",
  });
  const [savedDecision, setSavedDecision] = useState(null);
  const [savedReport, setSavedReport] = useState(null);
  const decisionContext = JSON.stringify([projectName, kpiMetric, basis, customPeriod, csvData.currency]);
  const isSavedDecisionCurrent = Boolean(savedDecision && savedDecision.raw === csvData.raw && savedDecision.context === decisionContext);
  useEffect(() => {
    if (!workspaceReady) return;
    let alive = true;
    (persistenceEnabled ? readReviewProject(projectId) : Promise.resolve(null)).then((saved) => {
      if (!alive) return;
      if (saved) {
        setProjectName(saved.name); setKpiMetric(saved.metric); setBasis(saved.basis); setTargetValue(saved.target); setTargetCurrency(saved.currency); setCustomPeriod(saved.period || null);
      }
      setProjectReady(true);
    });
    return () => { alive = false; };
  }, [persistenceEnabled, projectId, workspaceReady]);

  const rows = useMemo(() => getMappedRows(csvData), [csvData]);
  const targetCurrencyMatches = !targetCurrency || targetCurrency === csvData.currency || ["roas", "conversions"].includes(kpiMetric);
  const parsedTarget = parseReviewTarget(targetValue);
  const targetInvalid = targetValue.trim() !== "" && parsedTarget === null;
  const targetUnitReady = parsedTarget === null || ["roas", "conversions"].includes(kpiMetric) || Boolean(csvData.currency);
  const project = useMemo(() => ({ name: projectName, currency: csvData.currency, kpi: kpiFor(kpiMetric, basis), target: parsedTarget !== null && targetCurrencyMatches ? { value: parsedTarget } : null }), [projectName, csvData.currency, kpiMetric, basis, parsedTarget, targetCurrencyMatches]);
  const changeProject = setter => value => { setter(value); setProjectStatus(locale === "en" ? "Unsaved changes · applied to this review." : "변경 사항 미저장 · 현재 리뷰에 적용 중입니다."); };
  const changeKpi = value => { changeProject(setKpiMetric)(value); setTargetValue(""); setTargetCurrency(null); };
  const changeBasis = value => { changeProject(setBasis)(value); setTargetValue(""); setTargetCurrency(null); };
  const changePeriod = value => { changeProject(setCustomPeriod)(value); setTargetValue(""); setTargetCurrency(null); };
  const projectSetup = (periods, historyWeeks, hasResult) => <WeeklyProjectSetup locale={locale} name={projectName} setName={changeProject(setProjectName)} target={targetValue} setTarget={value => { changeProject(setTargetValue)(value); setTargetCurrency(csvData.currency); }} metric={kpiMetric} currency={csvData.currency} canSave={projectReady && workspaceReady && persistenceEnabled && targetCurrencyMatches && targetUnitReady && !targetInvalid} targetInvalid={targetInvalid} status={projectStatus} persistenceEnabled={persistenceEnabled} hasResult={hasResult} onSave={async () => {
      if (!projectReady || !workspaceReady || !targetUnitReady || !targetCurrencyMatches || targetInvalid) return false;
      const result = await saveReviewProject({ name: projectName, metric: kpiMetric, basis, target: parsedTarget ?? "", period: customPeriod, currency: csvData?.currency }, { projectId, shouldSave: () => useAppStore.getState().decisionPersistenceEnabled === true && useAppStore.getState().activeProjectId === projectId });
      if (result.ok) setTargetCurrency(csvData.currency);
      setProjectStatus(result.ok ? (locale === "en" ? "Setup saved on this device." : "이 기기에 설정을 저장했습니다.") : (locale === "en" ? "Could not save. This session still works." : "저장하지 못했습니다. 현재 세션에서는 계속 사용할 수 있습니다."));
      if (result.ok) await useAppStore.getState().refreshProjects();
      if (result.ok) trackProductEvent("weekly_project_saved", { locale, tool_id: "weekly-review", source: reviewSource });
      else trackProductEvent("weekly_project_save_failed", { locale, tool_id: "weekly-review", source: reviewSource });
      return result.ok;
    }}>
    <ReviewSettings t={t} locale={locale} kpiMetric={kpiMetric} setKpiMetric={changeKpi} basis={basis} setBasis={changeBasis} customPeriod={customPeriod} setCustomPeriod={changePeriod} periods={periods} historyWeeks={historyWeeks} />
    {!targetCurrencyMatches && <p className="wr-notice">{locale === "en" ? "The saved target uses a different currency. Re-enter it in the declared source currency before saving or applying it." : "저장된 목표와 원본 통화가 다릅니다. 목표를 원본 통화로 다시 입력한 뒤 저장·적용하세요."}</p>}
  </WeeklyProjectSetup>;

  // 저장된 주간 기록을 읽어야 평소 변동 범위를 판정할 수 있다(§2.3).
  // 못 읽으면 빈 목록으로 떨어지고 리뷰는 크기·표본 두 축으로 계속 동작한다.
  useEffect(() => {
    if (!workspaceReady) return;
    let alive = true;
    (persistenceEnabled ? listStoredSnapshots(projectId) : Promise.resolve([])).then((list) => {
      if (alive) { setStoredSnapshots(list); setSnapshotsReady(true); }
    });
    return () => { alive = false; };
  }, [persistenceEnabled, projectId, workspaceReady]);

  const review = useMemo(
    () => isAnalyzed ? runReview({ rows, storedSnapshots, decisionRecords, project, customPeriod }) : { ok: false, reason: "awaiting_analysis" },
    [isAnalyzed, rows, storedSnapshots, decisionRecords, project, customPeriod],
  );
  const evidence = useMemo(() => buildWorkspaceEvidence(review, project), [review, project]);
  const resultEventKey = productEventKey(computeAnalyzeSig(csvData), review.periods?.current.start, review.periods?.current.end, project.kpi.metric, project.kpi.basis, locale);
  useEffect(() => {
    if (!review.ok || !workspaceReady || !snapshotsReady || !projectReady || typeof IntersectionObserver !== "function") return;
    const target = document.getElementById("wr-verdict");
    if (!target) return;
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      trackProductEventOnce("weekly_review_result_viewed", resultEventKey, { tool_id: "weekly-review", locale, source: reviewSource, result_state: review.routing.status });
      observer.disconnect();
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [resultEventKey, review.ok, review.routing?.status, reviewSource, locale, workspaceReady, snapshotsReady, projectReady]);

  // 이번 기간 집계를 보관한다 — 다음 주의 "평소 범위"가 여기서 나온다.
  // 기기 저장을 끈 사용자에게는 쓰지 않는다.
  useEffect(() => {
    if (!review.ok || persistenceEnabled !== true || reviewSource === "demo") return;
    let alive = true;
    saveStoredSnapshot(review.previous, { projectId, shouldSave: () => useAppStore.getState().decisionPersistenceEnabled === true && useAppStore.getState().activeProjectId === projectId }).then(async (previous) => {
      if (!alive) return;
      const current = await saveStoredSnapshot(review.current, { projectId, shouldSave: () => useAppStore.getState().decisionPersistenceEnabled === true && useAppStore.getState().activeProjectId === projectId });
      if (alive) {
        setSnapshotStatus(previous.ok && current.ok ? "saved" : "failed");
        trackProductEventOnce(previous.ok && current.ok ? "weekly_review_saved" : "weekly_review_save_failed", resultEventKey, { tool_id: "weekly-review", source: reviewSource, locale, state: "device" });
        if (previous.ok && current.ok) setStoredSnapshots((existing) => {
          const next = mergeSnapshots(mergeSnapshots(existing, review.previous), review.current);
          const comparable = (list) => JSON.stringify(list.map(({ savedAt, ...snapshot }) => snapshot));
          return comparable(existing) === comparable(next) ? existing : next;
        });
      }
    });
    return () => { alive = false; };
  }, [review, persistenceEnabled, resultEventKey, reviewSource, locale, projectId]);

  useEffect(() => {
    if (!workspaceReady || !snapshotsReady || !projectReady) return;
    if (!review.ok) {
      if (isAnalyzed && csvData.raw?.length) {
        trackProductEventOnce("weekly_review_blocked", productEventKey(csvData.fileName, csvData.raw.length, review.reason, locale), {
          locale, tool_id: "weekly-review", source: reviewSource,
          state: review.reason,
        });
      }
      return;
    }
    trackProductEventOnce("weekly_review_completed", resultEventKey, {
      locale, tool_id: "weekly-review", source: reviewSource,
      data_continuity: review.previousSource === "snapshot" ? "saved_snapshot" : "uploaded_periods",
      result_state: review.routing.status,
    });
  }, [review, csvData.fileName, csvData.raw, project.kpi.metric, locale, isAnalyzed, workspaceReady, snapshotsReady, projectReady, reviewSource, resultEventKey]);

  const saveDecision = (recommendedLabel) => {
    const record = {
      toolId: "weekly-review",
      dataOrigin: decisionDataOrigin(csvData),
      locale,
      action: [decision.actionTarget || recommendedLabel, decision.actionKind, decision.actionAmount]
        .filter(Boolean).join(" "),
      actionKind: decision.actionKind,
      actionTarget: decision.actionTarget || recommendedLabel || "",
      actionAmount: decision.actionAmount || "",
      goalMetric: decision.goalMetric,
      goalDirection: decision.goalDirection,
      guardrailMetric: decision.guardrailValue ? decision.guardrailMetric : "",
      guardrailOp: decision.guardrailValue ? decision.guardrailOp : "",
      guardrailValue: decision.guardrailValue,
      createdAt: new Date().toISOString(),
      baselineDate: review.periods?.current.end,
      comparisonScope: createDecisionComparisonScope({ dataGroup: "efficiency", filter: { dateStart: review.periods.current.start, dateEnd: review.periods.current.end }, weeklyReview: { basis: project.kpi.basis, currency: csvData.currency } }),
      sourcePeriod: `${review.periods?.current.start} ~ ${review.periods?.current.end}`,
      reviewDate: nextReviewDate(review.periods?.current.end),
      sourcePath: locale === "en" ? "/en/weekly-review" : "/weekly-review",
    };
    setPendingSave({ record, raw: csvData.raw, context: decisionContext });
  };

  if (!review.ok) {
    return (
      <article className="content wr-screen">
        <WeeklyReviewHandoverNotice locale={locale} decisionCount={existingDecisionCount} />
      {!embedded && <nav className="project-actions" aria-label={locale === "en" ? "Project navigation" : "프로젝트 탐색"}><Link className="btn" href={locale === "en" ? "/en/projects" : "/projects"}>{locale === "en" ? "Projects · backups" : "프로젝트 · 백업"}</Link><Link className="btn ghost" href={locale === "en" ? "/en/subscription" : "/subscription"}>{locale === "en" ? "Subscription guide" : "구독 안내"}</Link></nav>}
        {!embedded && <header className="wr-screen__head">
          <div className="wr-screen__eyebrow">{t.eyebrow}</div>
          <h1>{t.title}</h1>
        </header>}
        <JourneyProgress stage="prepare" locale={locale} placement="weekly_review" />
        <ReviewHistoryEntry count={decisionRecords.length} locale={locale} />
        <section className="wr-screen__empty wr-card" id="wr-upload" aria-labelledby="wr-empty">
          <h2 id="wr-empty">{t.noData}</h2>
          <p>{t.noDataDeck}</p>
      {persistenceEnabled && snapshotStatus === "failed" && <p className="wr-notice" role="status">{locale === "en" ? "The aggregate could not be saved. Keep a CSV covering both periods for your next review." : "집계를 저장하지 못했습니다. 다음 리뷰에는 비교할 두 기간의 CSV가 필요합니다."}</p>}
          {review.reason && REASON_TEXT[locale]?.[review.reason] && (
            <p className="wr-screen__reason">{REASON_TEXT[locale][review.reason]}</p>
          )}
          {workspaceReady ? <CsvUploader toolId="5-2" analyticsToolId="weekly-review" showToolGuide={false} locale={locale} showMappingReview /> : <p role="status">{locale === "en" ? "Loading this device's saved workspace…" : "이 기기의 저장된 작업을 확인하고 있습니다…"}</p>}
          {projectSetup(review.periods || null, 0, false)}
          <Link href={locale === "en" ? "/en/start" : "/start"}>{t.goUpload}</Link>
        </section>
        <ReviewLoop locale={locale} hasResult={false} />
        <PastDecisions locale={locale} t={t} count={decisionRecords.length} />
        <AccountArchive locale={locale} anchorId="account-archive" />
      </article>
    );
  }

  const { periods, routing, variance, lastDecision, metrics } = review;
  const kpiAssessment = routing.kpi;
  const quiet = routing.status === "quiet";
  const unknown = routing.status === "unknown";
  const driverLabel = (driver) => locale !== "en" ? driver.label : driver.isMerged ? "Other (small campaigns)" : driver.isRemainder ? `Remaining ${driver.remainderCount}` : driver.label;
  const recommended = variance?.ok ? variance.drivers.find((d) => !d.isRemainder && !d.isMerged) : null;

  const draft = buildReportDraft({
    locale,
    notes: [
      ...workspaceReportNotes(evidence, review, locale),
      `${kpiMetric.toUpperCase()} (${periods.previous.start} – ${periods.previous.end} → ${periods.current.start} – ${periods.current.end}): ${money(review.metrics.previous[kpiMetric])} → ${money(review.metrics.current[kpiMetric])}${kpiMetric === "roas" ? " (ratio)" : ""}`,
      locale === "en" ? "Provisional operating heuristics; not a significance, equivalence, or causal-effect test." : "임시 운영 규칙이며 통계적 유의성·동등성·인과효과 검정이 아닙니다.",
      `${locale === "en" ? "Declared source currency" : "선언된 원본 통화"}: ${csvData.currency || (locale === "en" ? "unconfirmed" : "미확인")}`,
      periods.warnings?.includes("length_mismatch") ? t.lengthWarn : "",
      variance?.ok ? `${locale === "en" ? `${kpiMetric.toUpperCase()} breakdown scope (previous → current)` : `${kpiMetric.toUpperCase()} 분해 범위 (지난 → 이번)`}: ${money(variance.cpa1)} → ${money(variance.cpa2)}; ${locale === "en" ? "efficiency / result mix" : "효율 / 결과 비중 변화"}: ${money(variance.split.efficiency)} / ${money(variance.split.mix)}` : "",
      variance?.ok && !variance.coversAllSpend ? `${locale === "en" ? "Excluded spend (previous / current); not a whole-account explanation" : "제외 지출 (지난 / 이번); 전체 계정의 설명이 아님"}: ${money(variance.excluded.cost1)} / ${money(variance.excluded.cost2)}` : "",
    ],
    project,
    period: periods.current,
    previousPeriod: periods.previous,
    routing,
    drivers: variance?.ok ? variance.drivers.filter((d) => !d.isRemainder).map((d) => ({ label: driverLabel(d), share: d.share })) : [],
    split: variance?.ok && variance.split.shares
      ? { efficiency: variance.split.shares.efficiency, mix: variance.split.shares.mix }
      : null,
    lastDecision,
    thisDecision: isSavedDecisionCurrent ? savedDecision.record : null,
  });

  return (
    <article className="content wr-screen">
      <WeeklyReviewHandoverNotice locale={locale} decisionCount={existingDecisionCount} />
      {!embedded && <nav className="project-actions" aria-label={locale === "en" ? "Project navigation" : "프로젝트 탐색"}><Link className="btn" href={locale === "en" ? "/en/projects" : "/projects"}>{locale === "en" ? "Projects · backups" : "프로젝트 · 백업"}</Link><Link className="btn ghost" href={locale === "en" ? "/en/subscription" : "/subscription"}>{locale === "en" ? "Subscription guide" : "구독 안내"}</Link></nav>}

      <header className={`wr-screen__head${embedded ? " wr-screen__head--embedded" : ""}`}>
        {!embedded && <><div className="wr-screen__eyebrow">{t.eyebrow}</div><h1>{t.title}</h1></>}
        <div className="wr-screen__period">
          <span>{periods.current.start} ~ {periods.current.end}</span>
          <span className="wr-screen__vs">vs</span>
          <span>{periods.previous.start} ~ {periods.previous.end}</span>
          {periods.partial && (
            <span className="wr-screen__badge">
              {locale === "en"
                ? `${customPeriod ? "Partial period" : "Partial week"} (${periods.current.days}d)${customPeriod ? " · custom comparison" : " · compared with the same weekdays"}`
                : `${customPeriod ? "부분 기간" : "부분 주"} (${periods.current.days}일)${customPeriod ? " · 지정 기간 비교" : " · 전주 같은 요일과 비교"}`}
            </span>
          )}
        </div>
      </header>
      <JourneyProgress stage={isSavedDecisionCurrent ? "review" : "analyze"} locale={locale} placement="weekly_review" />
      <ReviewHistoryEntry count={decisionRecords.length} locale={locale} />
      {projectSetup(periods, review.historyWeeks, true)}
      {persistenceEnabled && snapshotStatus === "failed" && <p className="wr-notice" role="status">{locale === "en" ? "The aggregate could not be saved. Keep a CSV covering both periods for your next review." : "집계를 저장하지 못했습니다. 다음 리뷰에는 비교할 두 기간의 CSV가 필요합니다."}</p>}
      {csvData.sheetUrl && <button className="btn primary" disabled={refreshingConnectedSheet || !workspaceReady} onClick={async () => { document.getElementById("wr-upload").open = true; setRefreshingConnectedSheet(true); try { await sheetRefreshRef.current.refreshSheet(); } finally { setRefreshingConnectedSheet(false); } }}>{refreshingConnectedSheet ? (locale === "en" ? "Fetching…" : "불러오는 중…") : (locale === "en" ? "Refresh connected sheet" : "연결한 시트로 이번 주 갱신")}</button>}
      <details className="wr-upload" id="wr-upload"><summary>{locale === "en" ? "Upload next week's CSV / review mapping" : "다음 주 CSV 올리기 / 매핑 확인"}</summary>{workspaceReady && <CsvUploader refreshRef={sheetRefreshRef} toolId="5-2" analyticsToolId="weekly-review" showToolGuide={false} locale={locale} showMappingReview />}</details>
      {review.previousSource === "snapshot" && <p role="note">{locale === "en" ? "The comparison period uses a saved aggregate snapshot." : "지난 기간은 저장된 집계 스냅샷을 사용합니다."}</p>}

      <nav className="wr-review-nav" aria-label={locale === "en" ? "Review sections" : "리뷰 순서"}>
        <a className="btn" href="#wr-verdict">{t.verdictHead}</a><a className="btn" href="#wr-evidence-title">{locale === "en" ? "Campaign evidence" : "캠페인 근거"}</a><a className="btn" href="#wr-next" onClick={() => { const section = document.getElementById("wr-next")?.closest("details"); if (section) section.open = true; }}>{locale === "en" ? "Next decision" : "다음 결정"}</a><a className="btn" href="#wr-share">{t.shareHead}</a>
      </nav>

      {/* ── 1. 결론 ─────────────────────────────── */}
      <section className="wr-card" aria-labelledby="wr-verdict">
        <h2 className="wr-card__title" id="wr-verdict">{t.verdictHead}</h2>
        <div className="wr-verdict">
          <p className={`wr-verdict__big ${kpiAssessment?.significant ? (kpiAssessment.outcome === "worse" ? "is-bad" : "is-good") : "is-flat"}`}>
            {unknown ? t.unknown : quiet ? t.quiet : `${kpiMetric.toUpperCase()} ${pct(kpiAssessment.deltaPct)}`}
          </p>
          {!unknown && (
            <p className="wr-verdict__from">
              {formatReviewMetric(metrics.previous[kpiMetric], kpiMetric, csvData.currency, locale)} → {formatReviewMetric(metrics.current[kpiMetric], kpiMetric, csvData.currency, locale)}
            </p>
          )}
          <p className="wr-note">{locale === "en" ? "Review thresholds are provisional operating heuristics, not a statistical significance or equivalence test. Observed changes do not prove that a decision caused them." : "확인 기준은 임시 운영 규칙이며 통계적 유의성·동등성 검정이 아닙니다. 관측된 변화가 결정의 인과효과를 증명하지는 않습니다."}</p>
          <p className="wr-note" data-currency-scope="declare">{locale === "en" ? "Declared source currency (no conversion)" : "선언된 원본 통화 (환산 없음)"}: {csvData.currency || (locale === "en" ? "unconfirmed" : "미확인")}</p>
          <p className="wr-verdict__basis">
            {REASON_TEXT[locale]?.[routing.reason] || ""}
            {kpiAssessment && !kpiAssessment.baselineKnown && (
              <> {locale === "en"
                ? "The usual range is not known yet — too few weeks."
                : "평소 변동 범위는 아직 모릅니다(비교 이력이 짧습니다)."}</>
            )}
          </p>
        </div>

        <div className="table-wrap wr-tablewrap" role="region" aria-label={t.metricsCaption} tabIndex={0}>
          <table className="data">
            <caption>{t.metricsCaption}</caption>
            <thead>
              <tr>
                <th scope="col">{locale === "en" ? "Metric" : "지표"}</th>
                <th scope="col">{locale === "en" ? "Last" : "지난"}</th>
                <th scope="col">{locale === "en" ? "This" : "이번"}</th>
                <th scope="col">{locale === "en" ? "Change" : "변화"}</th>
              </tr>
            </thead>
            <tbody>
              {metricRows(metrics, locale).map((row) => (
                <tr key={row.key} className={row.key === kpiMetric ? "is-kpi" : ""}>
                  <th scope="row">{row.label}</th>
                  <td className="num">{row.format(row.previous)}</td>
                  <td className="num">{row.format(row.current)}</td>
                  <td className="num">{pct(row.change)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <WeeklyEvidencePanel evidence={evidence} review={review} locale={locale} onChooseCampaign={label => {
        setDecision(prev => ({ ...prev, actionTarget: label, actionKind: "investigate" }));
        const section = document.getElementById("wr-next");
        const disclosure = section?.closest("details");
        if (disclosure) disclosure.open = true;
        window.requestAnimationFrame(() => document.getElementById("wr-decision-target")?.focus());
      }} />

      {/* ── 2. 왜 (신호가 있을 때만) ───────────────── */}
      {!quiet && !unknown && variance?.ok && (
        <section className="wr-card" aria-labelledby="wr-why">
          <h2 className="wr-card__title" id="wr-why">{t.whyHead}</h2>

          {variance.split.shares ? (
            <p className="wr-readout">
              {variance.split.lead === "efficiency"
                ? (locale === "en"
                  ? "The arithmetic efficiency contribution was larger than the result-mix contribution. This does not establish causation."
                  : "산술 분해에서 효율 항의 기여가 결과 비중 항보다 컸습니다. 인과관계 판정은 아닙니다.")
                : (locale === "en"
                  ? "The arithmetic result-mix contribution was larger than the efficiency contribution. This does not establish causation."
                  : "산술 분해에서 결과 비중 항의 기여가 효율 항보다 컸습니다. 인과관계 판정은 아닙니다.")}
              {" "}
              {locale === "en"
                ? `Efficiency ${pct(variance.split.shares.efficiency)}, result mix ${pct(variance.split.shares.mix)}.`
                : `효율 ${pct(variance.split.shares.efficiency)}, 결과 비중 변화 ${pct(variance.split.shares.mix)}.`}
            </p>
          ) : (
            <p className="wr-readout">
              {locale === "en"
                ? "Efficiency and mix moved in opposite directions and nearly cancelled out, so a percentage split would be misleading. Amounts only."
                : "효율과 믹스가 서로 반대로 움직여 거의 상쇄됐습니다. 비율로 나누면 오해를 부르므로 금액만 보여줍니다."}
            </p>
          )}

          {!variance.coversAllSpend && (
            <p className="wr-notice" role="note">
              {locale === "en"
                ? `Excluded from the breakdown: ${variance.excluded.cells.join(", ")} — previous spend ${money(variance.excluded.cost1)}, current spend ${money(variance.excluded.cost2)}. A period has spend but no conversions; this breakdown does not explain the whole account.`
                : `분해에서 제외: ${variance.excluded.cells.join(", ")} — 지난 지출 ${money(variance.excluded.cost1)}, 이번 지출 ${money(variance.excluded.cost2)}. 어느 한 기간에 지출은 있으나 전환이 없어 전체 계정의 변화를 설명하지 못합니다.`}
            </p>
          )}
          <p className="wr-note">{locale === "en" ? `Arithmetic ${kpiMetric.toUpperCase()} change within the included campaigns` : `포함된 캠페인 범위의 산술 ${kpiMetric.toUpperCase()} 변화`}: {money(variance.cpa1)} → {money(variance.cpa2)}; {locale === "en" ? "efficiency / result mix" : "효율 / 결과 비중 변화"}: {money(variance.split.efficiency)} / {money(variance.split.mix)}</p>

          <div className="table-wrap wr-tablewrap" role="region" aria-label={t.driversCaption} tabIndex={0}>
            <table className="data">
              <caption>{t.driversCaption}</caption>
              <thead>
                <tr>
                  <th scope="col">{locale === "en" ? "Campaign" : "캠페인"}</th>
                  <th scope="col">{kpiMetric.toUpperCase()}</th>
                  <th scope="col">{locale === "en" ? "Result share" : "결과 비중"}</th>
                  <th scope="col">{locale === "en" ? "Contribution" : "기여"}</th>
                </tr>
              </thead>
              <tbody>
                {variance.drivers.map((driver) => (
                  <tr key={driver.label}>
                    <th scope="row" className={driver.isRemainder ? "quiet" : ""}>{driverLabel(driver)}</th>
                    <td className="num">{driver.cpaChangePct === null ? "—" : pct(driver.cpaChangePct)}</td>
                    <td className="num quiet">{fmtPct(driver.s1)} → {fmtPct(driver.s2)}</td>
                    <td className="num">{driver.share === null ? money(driver.contribution) : fmtPct(driver.share)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="wr-note">
              {locale === "en"
                ? "“Result share” is the share of conversions, not of spend."
                : "“결과 비중”은 비용이 아니라 전환 건수의 비중입니다."}
            </p>
          </div>
        </section>
      )}

      {!quiet && !unknown && variance && !variance.ok && <p className="wr-notice">{locale === "en" ? "Campaign breakdown could not be identified. Check missing metrics and campaigns with spend but no conversions; no cause has been inferred." : "캠페인별 분해를 식별하지 못했습니다. 누락 지표와 지출은 있으나 전환이 없는 캠페인을 확인하세요. 원인을 추정해 채우지 않았습니다."}</p>}
      {/* ── 3. 지난 결정 (있을 때만) ───────────────── */}
      {lastDecision && (
        <section className="wr-card" aria-labelledby="wr-last">
          <h2 className="wr-card__title" id="wr-last">{t.lastHead}</h2>
          <p className="wr-decision__action">{describeAction(lastDecision.decision, locale)}</p>
          <p className={`wr-stamp is-${lastDecision.score.outcome.toLowerCase()}`}>
            {outcomeLabel(lastDecision.score.outcome, locale)}
          </p>
          {lastDecision.score.outcome === DECISION_OUTCOME.NO_EFFECT && (
            <p className="wr-note">
              {locale === "en"
                ? "This does not mean the decision had no effect — one week is not enough to rule it out."
                : "효과가 없다는 뜻은 아닙니다 — 1주 표본으로는 효과를 부정할 수 없습니다."}
            </p>
          )}
          {lastDecision.score.checks?.goal?.assessment && <p className="wr-note">{locale === "en" ? "Observed goal change" : "관측된 목표 지표 변화"}: {pct(lastDecision.score.checks.goal.assessment.deltaPct)}</p>}
          {lastDecision.score.checks?.guardrail && <p className="wr-note">{locale === "en" ? "Observed guardrail value / limit" : "관측된 가드레일 값 / 기준"}: {money(lastDecision.score.checks.guardrail.actual)} / {money(lastDecision.score.checks.guardrail.threshold)}</p>}
          {lastDecision.score.reason === "comparison_context_mismatch" && <p className="wr-note">{locale === "en" ? "The baseline dates, currency, conversion basis, or period lengths differ from the saved decision." : "저장 당시와 기준 기간·통화·전환 기준 또는 기간 길이가 달라 판정을 보류했습니다."}</p>}
          {lastDecision.score.outcome === DECISION_OUTCOME.UNSCORED && (
            <p className="wr-note">
              {locale === "en"
                ? "The recorded terms or available observations are insufficient to score this decision. A hold goal needs a predeclared equivalence margin."
                : "목표·가드레일 또는 관측 근거가 부족하여 판정할 수 없습니다. 유지 목표는 사전에 정한 동등성 범위가 필요합니다."}
            </p>
          )}
        </section>
      )}

      {/* ── 4. 이번 주에 할 것 ─────────────────────── */}
      <details open={!quiet && !unknown} className="wr-settings">
        <summary>{locale === "en" ? "Record my next decision" : "내 다음 결정 기록"}</summary>
        <section className="wr-card" aria-labelledby="wr-next">
          <h2 className="wr-card__title" id="wr-next">{t.nextHead}</h2>

          {recommended && (
            <div className="wr-reco">
              <p className="wr-reco__k">{t.recommend}</p>
              <p className="wr-reco__t">{recommended.label}</p>
              <p className="wr-reco__ev num">
                {kpiMetric.toUpperCase()} {pct(recommended.cpaChangePct)} · {recommended.share === null ? money(recommended.contribution) : fmtPct(recommended.share)}
              </p>
            </div>
          )}

          <div className="wr-mine">
            <p className="wr-mine__k">{t.mine}</p>
            <div className="wr-opts" role="group" aria-label={t.mine}>
              {ACTION_KINDS.map((kind) => (
                <button
                  key={kind.id}
                  type="button"
                  className="wr-opt"
                  aria-pressed={decision.actionKind === kind.id}
                  onClick={() => setDecision((prev) => ({ ...prev, actionKind: kind.id }))}
                >
                  {locale === "en" ? kind.en : kind.ko}
                </button>
              ))}
            </div>
            <label className="wr-field">
              <span>{locale === "en" ? "Target" : "대상"}</span>
              <input
                id="wr-decision-target"
                value={decision.actionTarget || recommended?.label || ""}
                onChange={(event) => setDecision((prev) => ({ ...prev, actionTarget: event.target.value }))}
              />
            </label>
            <label className="wr-field">
              <span>{t.amountLabel}</span>
              <input
                value={decision.actionAmount}
                placeholder="-10%"
                onChange={(event) => setDecision((prev) => ({ ...prev, actionAmount: event.target.value }))}
              />
            </label>
            <label className="wr-field">
              <span>{t.goalLabel}</span>
              <select
                value={decision.goalMetric}
                onChange={(event) => setDecision((prev) => ({ ...prev, goalMetric: event.target.value }))}
              >
                {KPI_OPTIONS.map((option) => <option key={option.metric} value={option.metric}>{locale === "en" ? option.en : option.ko}</option>)}
                <option value="spend">{locale === "en" ? "Spend" : "비용"}</option>
              </select>
              <select
                aria-label={locale === "en" ? "Goal direction" : "목표 방향"}
                aria-describedby={decision.goalDirection === "hold" ? "wr-hold-limit" : undefined}
                value={decision.goalDirection}
                onChange={(event) => setDecision((prev) => ({ ...prev, goalDirection: event.target.value }))}
              >
                <option value="up">{locale === "en" ? "Increase" : "증가"}</option>
                <option value="down">{locale === "en" ? "Decrease" : "감소"}</option>
                <option value="hold">{locale === "en" ? "Hold" : "유지"}</option>
              </select>
            </label>
            {decision.goalDirection === "hold" && <p className="wr-note" id="wr-hold-limit" role="status">{locale === "en" ? "A hold goal can be recorded, but automatic scoring is not supported: no acceptable range of change has been defined. Measurable guardrail results will still be shown." : "유지 목표는 기록할 수 있지만 자동 판정은 지원하지 않습니다. 어느 정도 변화까지 유지로 볼지 정해져 있지 않기 때문입니다. 계산 가능한 가드레일 결과는 별도로 보여드립니다."}</p>}
            <label className="wr-field">
              <span>{t.guardLabel}</span>
              <select
                value={decision.guardrailMetric}
                onChange={(event) => setDecision((prev) => ({ ...prev, guardrailMetric: event.target.value }))}
              >
                {KPI_OPTIONS.map((option) => <option key={option.metric} value={option.metric}>{locale === "en" ? option.en : option.ko}</option>)}
              </select>
              <select
                aria-label={locale === "en" ? "Guardrail operator" : "가드레일 비교"}
                value={decision.guardrailOp}
                onChange={(event) => setDecision((prev) => ({ ...prev, guardrailOp: event.target.value }))}
              >
                <option value="lte">≤</option>
                <option value="gte">≥</option>
              </select>
              <input
                aria-label={locale === "en" ? "Guardrail value" : "가드레일 값"}
                className="wr-field__num"
                value={decision.guardrailValue}
                placeholder="8.00"
                inputMode="decimal"
                onChange={(event) => setDecision((prev) => ({ ...prev, guardrailValue: event.target.value }))}
              />
            </label>
            {/* 가드레일을 강제하지 않는다 — 강제하면 아무 값이나 넣어 판정이 거짓이 된다. */}
            {project.target && <button type="button" className="btn" disabled={!targetCurrencyMatches} onClick={() => setDecision((prev) => ({ ...prev, goalMetric: kpiMetric, goalDirection: project.kpi.direction === LOWER_IS_BETTER ? "down" : "up", guardrailMetric: kpiMetric, guardrailOp: project.kpi.direction === LOWER_IS_BETTER ? "lte" : "gte", guardrailValue: String(parsedTarget) }))}>{locale === "en" ? "Use project KPI and target" : "프로젝트 KPI·목표 적용"}</button>}
            {!decision.guardrailValue && <p className="wr-note">{t.guardHint}</p>}
            <button type="button" className="btn primary" onClick={() => saveDecision(recommended?.label || "")}>{t.save}</button>
            {isSavedDecisionCurrent && <><AccountArchive record={savedDecision.record} locale={locale} /><p className="wr-note" role="status">{t.saved} · {savedDecision.record.reviewDate}</p><button type="button" className="btn" onClick={() => downloadCalendar(serializeDecisionReviewIcs(savedDecision.record, locale), "weekly_review")}>{locale === "en" ? "Download review reminder (.ics)" : "다음 검토일 캘린더 받기 (.ics)"}</button></>}
          </div>
        </section>
      </details>

      {/* ── 5. 공유 ───────────────────────────────── */}
      <ReviewLoop locale={locale} hasResult nextDate={isSavedDecisionCurrent ? savedDecision.record.reviewDate : null} />
      <section className="wr-card" aria-labelledby="wr-share">
        <h2 className="wr-card__title" id="wr-share">{t.shareHead}</h2>
        <p>{locale === "en" ? "The same periods, campaign evidence and saved decision, ready for your team review." : "검토한 기간·캠페인 근거·저장한 결정을 한 문서로 전달하세요."}</p>
        <WeeklyReportDocument text={renderReportText(draft, { number: money })} />
        <button type="button" className="btn primary" disabled={!persistenceEnabled || reviewSource === "demo"} onClick={() => setPendingSave({ report: { text: renderReportText(draft, { number: money }), period: periods.current, generatedAt: new Date().toISOString() }, raw: csvData.raw, context: decisionContext })}>{locale === "en" ? "Save report to project" : "프로젝트에 보고서 저장"}</button>
        {pendingSave && <ReviewSaveDialog locale={locale} record={pendingSave.record} report={pendingSave.report} onClose={() => setPendingSave(null)} onSaved={result => {
          if (result.record) {
            setSavedDecision({ record: result.record, raw: pendingSave.raw, context: pendingSave.context });
            trackProductEvent("weekly_decision_saved", { locale, tool_id: "weekly-review", source: reviewSource });
          } else {
            setSavedReport({ raw: pendingSave.raw, context: pendingSave.context, ok: true });
            trackProductEvent("weekly_report_saved", { locale, source: reviewSource });
          }
        }} />}
        {savedReport?.raw === csvData.raw && savedReport.context === decisionContext && <p role="status">{savedReport.ok ? (locale === "en" ? "Report saved." : "보고서를 저장했습니다.") : (locale === "en" ? "Save failed. Your analysis remains open; check device storage." : "저장하지 못했습니다. 분석은 유지됩니다. 기기 저장 상태를 확인해 주세요.")}{savedReport.ok && <> <Link href={locale === "en" ? "/en/projects" : "/projects"}>{locale === "en" ? "See it in Projects" : "보관함에서 확인"}</Link></>}</p>}
        <div className="wr-report-actions">
        <button type="button" className="btn" onClick={async () => {
          try {
            await navigator.clipboard.writeText(renderReportText(draft, { number: money }));
            setCopyStatus(locale === "en" ? "Copied." : "복사했습니다.");
            trackProductEvent("weekly_review_export", { locale, tool_id: "weekly-review", source: reviewSource, download_type: "clipboard", state: "completed" });
          } catch { setCopyStatus(locale === "en" ? "Copy failed. Select and copy the report text." : "복사하지 못했습니다. 보고서 본문을 선택해 복사해 주세요."); }
        }}>{locale === "en" ? "Copy for Slack / Notion" : "Slack / Notion용 복사"}</button>
        <button type="button" className="btn" onClick={() => { if (!requirePaidExport({ locale })) return; trackProductEvent("weekly_review_export", { locale, tool_id: "weekly-review", source: reviewSource, download_type: "print", state: "requested" }); window.print(); }}>{locale === "en" ? "Print / PDF" : "인쇄 / PDF"}</button>
        <AnalysisExportProvider value={{ buildPayload: () => buildWeeklyReviewExport({ csvData, evidence, review, text: renderReportText(draft, { number: money }), locale }) }}><DownloadHub toolId="weekly-review" locale={locale} label={locale === "en" ? "Download Word / Excel" : "Word / Excel 보고서 받기"} /></AnalysisExportProvider>
        </div>
        {copyStatus && <p role="status">{copyStatus}</p>}
      </section>

      <PastDecisions locale={locale} t={t} count={decisionRecords.length} />
      <AccountArchive locale={locale} anchorId="account-archive" />
    </article>
  );
}

/**
 * 기준·기간 설정. 자동 판정은 **제안**이고 사용자가 언제든 바꿀 수 있어야 한다 — 자동 비교가
 * 틀렸는데 고칠 방법이 없으면 리뷰 전체를 못 믿는다(§2.2b).
 * 접어 두는 이유는 P2다: 매주 바꾸는 값이 아니다.
 */
function ReviewSettings({
  t, locale, kpiMetric, setKpiMetric, basis, setBasis,
  customPeriod, setCustomPeriod, periods, historyWeeks,
}) {
  const manual = Boolean(customPeriod);
  const setField = (key, value) => setCustomPeriod((prev) => ({ ...(prev || {}), [key]: value }));

  return (
    <div className="wr-project-criteria">
      <div className="wr-settings__body">
        <label className="wr-field">
          <span>{t.kpiLabel}</span>
          <select value={kpiMetric} onChange={(event) => setKpiMetric(event.target.value)}>
            {KPI_OPTIONS.map((option) => (
              <option key={option.metric} value={option.metric}>{locale === "en" ? option.en : option.ko}</option>
            ))}
          </select>
        </label>

        <label className="wr-field">
          <span>{t.basisLabel}</span>
          <select value={kpiMetric === "cpi" ? "installs" : basis} disabled={kpiMetric === "cpi"} onChange={(event) => setBasis(event.target.value)}>
            <option value="actions">{t.basisActions}</option>
            <option value="installs">{t.basisInstalls}</option>
          </select>
        </label>

        <label className="wr-field">
          <span>{t.periodLabel}</span>
          <select
            value={customPeriod?.preset || (manual ? "custom" : "auto")}
            onChange={(event) => setCustomPeriod(
              event.target.value === "auto" ? null : event.target.value !== "custom"
                ? { preset: event.target.value }
                : periods?.current
                  ? { currentStart: periods.current.start, currentEnd: periods.current.end }
                  : {},
            )}
          >
            <option value="auto">{t.periodAuto}</option>
            <option value="custom">{t.periodCustom}</option>
            <option value="recent_seven">{locale === "en" ? "Latest 7 days vs previous 7" : "최근 7일 vs 직전 7일"}</option>
            <option value="month">{locale === "en" ? "This month vs last month (length may differ)" : "이번 달 vs 지난 달 (기간 길이 주의)"}</option>
            <option value="completed_week">{locale === "en" ? "Latest completed week" : "최근 완료 주 vs 그 전주"}</option>
          </select>
        </label>

        {manual && !customPeriod?.preset && (
          <div className="wr-settings__dates">
            {[["currentStart", t.curStart], ["currentEnd", t.curEnd],
              ["previousStart", t.prevStart], ["previousEnd", t.prevEnd]].map(([key, label]) => (
              <label className="wr-field" key={key}>
                <span>{label}</span>
                <input
                  type="date"
                  value={customPeriod?.[key] || ""}
                  onChange={(event) => setField(key, event.target.value)}
                />
              </label>
            ))}
          </div>
        )}

        {periods?.warnings?.includes("length_mismatch") && (
          <p className="wr-notice">{t.lengthWarn}</p>
        )}

        <p className="wr-note">
          {historyWeeks > 0 ? t.historyNote(historyWeeks) : t.historyNone}
        </p>
      </div>
    </div>
  );
}

function ReviewHistoryEntry({ count, locale }) {
  if (!count) return null;
  return <a className="wr-history-entry" href="#wr-history" onClick={() => {
    document.getElementById("wr-history").open = true;
    trackProductEvent("review_history_opened", { source: "weekly_review", placement: "review_header", locale });
  }}><strong>{locale === "en" ? `${count} saved decision${count === 1 ? "" : "s"}` : `저장한 결정 ${count}개`}</strong><span>{locale === "en" ? "Review outcomes and record the next action →" : "지난 결과를 확인하고 다음 행동 기록 →"}</span></a>;
}

function ReviewLoop({ locale, hasResult, nextDate }) {
  const en = locale === "en";
  const reveal = id => {
    const node = document.getElementById(id);
    const disclosure = node?.closest("details");
    if (disclosure) disclosure.open = true;
  };
  return <nav className="wr-loop" aria-label={en ? "Weekly review cycle" : "주간 검토 흐름"}>
    <ol>
      <li><strong>{en ? "1. Compare periods" : "1. 기간 비교"}</strong><p>{en ? "Bring this period and a comparable baseline." : "이번 데이터와 비교할 지난 기간을 준비합니다."}</p><a className="btn" href="#wr-upload" onClick={() => reveal("wr-upload")}>{hasResult ? (en ? "Upload the next period" : "다음 기간 데이터 올리기") : (en ? "Prepare comparison data" : "비교 데이터 준비")}</a></li>
      <li><strong>{en ? "2. Record a decision" : "2. 결정 기록"}</strong><p>{en ? "Save the action and conditions you will check." : "확인한 근거와 다음에 볼 조건을 저장합니다."}</p>{hasResult ? <a className="btn" href="#wr-next" onClick={() => reveal("wr-next")}>{en ? "Record this decision" : "이번 결정 기록"}</a> : <span className="wr-note">{en ? "Available after comparison" : "기간 비교 후 기록할 수 있습니다"}</span>}</li>
      <li><strong>{en ? "3. Review the next results" : "3. 다음 결과 검토"}</strong><p>{nextDate ? `${en ? "Next review" : "다음 검토일"}: ${nextDate}` : (en ? "Save a decision to set the next review date." : "결정을 저장하면 다음 검토일이 정해집니다.")}</p><a className="btn" href="#wr-history" onClick={() => reveal("wr-history")}>{en ? "See saved decisions" : "저장한 결정 확인"}</a></li>
    </ol>
  </nav>;
}

function PastDecisions({ locale, t, count }) {
  useEffect(() => {
    const reveal = () => { if (window.location.hash === "#wr-history") document.getElementById("wr-history").open = true; };
    reveal();
    window.addEventListener("hashchange", reveal);
    return () => window.removeEventListener("hashchange", reveal);
  }, []);
  return (
    <details className="wr-history" id="wr-history">
      <summary>{t.historyToggle(count)}</summary>
      <WeeklyReview locale={locale} embedded />
    </details>
  );
}

function metricRows(metrics, locale) {
  const change = (key) => {
    const prev = metrics.previous[key];
    const cur = metrics.current[key];
    if (prev === null || cur === null || prev === 0) return null;
    return (cur - prev) / Math.abs(prev);
  };
  const rows = [
    { key: "cpa", label: "CPA", format: money },
    { key: "cpi", label: "CPI", format: money },
    { key: "roas", label: "ROAS", format: (v) => (v === null ? "—" : fmtPct(v)) },
    { key: "cost", label: locale === "en" ? "Spend" : "비용", format: money },
    { key: "conversions", label: locale === "en" ? "Conversions" : "전환", format: money },
    { key: "ctr", label: "CTR", format: (v) => (v === null ? "—" : fmtPct(v)) },
    { key: "cvr", label: "CVR", format: (v) => (v === null ? "—" : fmtPct(v)) },
  ];
  return rows
    .map((row) => ({
      ...row,
      previous: metrics.previous[row.key],
      current: metrics.current[row.key],
      change: change(row.key),
    }))
    // 매핑되지 않은 지표는 행 자체를 만들지 않는다 — 빈 줄을 "확인했는데 없음"으로 읽지 않게.
    .filter((row) => Number.isFinite(row.previous) && Number.isFinite(row.current));
}
