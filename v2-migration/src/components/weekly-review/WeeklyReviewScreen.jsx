"use client";

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

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import CsvUploader from "@/components/CsvUploader";
import { useAppStore } from "@/store/useDataStore";
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
import WeeklyReview from "@/components/WeeklyReview";
import WeeklyReviewHandoverNotice from "@/components/weekly-review/WeeklyReviewHandoverNotice";
import { fmtPct } from "@/utils/format";

const COPY = {
  ko: {
    eyebrow: "WEEKLY REVIEW",
    title: "주간 리뷰",
    verdictHead: "이번 주 결론",
    whyHead: "왜 그랬나",
    lastHead: "지난 결정은 먹혔나",
    nextHead: "이번 주에 할 것",
    shareHead: "공유",
    historyToggle: (n) => `지난 결정 전체 보기 (${n}건)`,
    noData: "이번 주 데이터를 올려주세요.",
    noDataDeck: "2주치 캠페인 CSV를 올리면 이번 주와 지난주를 견주어 결론을 만듭니다.",
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
    settings: "기준·기간 설정",
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
    lastHead: "Did last week's decision work?",
    nextHead: "What to do this week",
    shareHead: "Share",
    historyToggle: (n) => `All past decisions (${n})`,
    noData: "Upload this week's data.",
    noDataDeck: "Upload two weeks of campaign CSV and we compare this week with last.",
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
    settings: "Metric & period",
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

export default function WeeklyReviewScreen({ locale = "ko" }) {
  const t = COPY[locale] || COPY.ko;
  const csvData = useAppStore((state) => state.csvData);
  const reviewSource = csvData.fileName?.startsWith("demo_") ? "demo" : "csv";
  const decisionRecords = useAppStore((state) => state.decisionRecords ?? EMPTY_RECORDS);
  const sessionDecisionIds = useAppStore((state) => state.decisionSessionRecordIds);
  const existingDecisionCount = decisionRecords.filter((record) => record.toolId !== "weekly-review" && !sessionDecisionIds.has(record.id)).length;
  const addDecisionRecord = useAppStore((state) => state.addDecisionRecord);
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
  useEffect(() => { setCurrentRouteId("weekly-review"); }, [setCurrentRouteId]);
  useEffect(() => {
    trackProductEventOnce("weekly_review_viewed", productEventKey(locale), { locale, tool_id: "weekly-review" });
  }, [locale]);

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
  const decisionContext = JSON.stringify([projectName, kpiMetric, basis, customPeriod, csvData.currency]);
  const isSavedDecisionCurrent = Boolean(savedDecision && savedDecision.raw === csvData.raw && savedDecision.context === decisionContext);
  useEffect(() => {
    let alive = true;
    (persistenceEnabled ? readReviewProject() : Promise.resolve(null)).then((saved) => {
      if (!alive) return;
      if (saved) {
        setProjectName(saved.name); setKpiMetric(saved.metric); setBasis(saved.basis); setTargetValue(saved.target); setTargetCurrency(saved.currency); setCustomPeriod(saved.period || null);
      }
      setProjectReady(true);
    });
    return () => { alive = false; };
  }, [persistenceEnabled]);

  const rows = useMemo(() => getMappedRows(csvData), [csvData]);
  const project = useMemo(() => ({ name: projectName, currency: csvData.currency, kpi: kpiFor(kpiMetric, basis), target: targetValue.trim() && Number.isFinite(Number(targetValue)) ? { value: Number(targetValue) } : null }), [projectName, csvData.currency, kpiMetric, basis, targetValue]);
  const targetCurrencyMatches = !targetCurrency || targetCurrency === csvData.currency || ["roas", "conversions"].includes(kpiMetric);
  const projectSetup = <details className="wr-settings">
    <summary>{locale === "en" ? "My weekly project" : "내 주간 프로젝트"}</summary>
    <label className="wr-field"><span>{locale === "en" ? "Project name" : "프로젝트 이름"}</span><input value={projectName} onChange={(event) => setProjectName(event.target.value)} maxLength={120} /></label>
    <label className="wr-field"><span>{locale === "en" ? "KPI target (optional)" : "KPI 목표 (선택)"}</span><input value={targetValue} onChange={(event) => { setTargetValue(event.target.value); setTargetCurrency(csvData.currency); }} inputMode="decimal" /></label>
    <p className="wr-note">{locale === "en" ? "One project on this device. Settings and campaign aggregates remain in your browser for up to 90 days. Mapping is remembered by the uploader. Delete them in Storage." : "이 기기에서 프로젝트 1개를 이어갑니다. 설정과 캠페인 집계는 브라우저에 최대 90일 보관하며, 매핑은 업로더가 기억합니다. 저장소 화면에서 삭제할 수 있습니다."}</p>
    <button type="button" className="btn" disabled={!persistenceEnabled || !targetCurrencyMatches} onClick={async () => {
      if (!targetCurrencyMatches) return;
      const result = await saveReviewProject({ name: projectName, metric: kpiMetric, basis, target: targetValue, period: customPeriod, currency: csvData?.currency }, { shouldSave: () => useAppStore.getState().decisionPersistenceEnabled === true });
      if (result.ok) setTargetCurrency(csvData.currency);
      setProjectStatus(result.ok ? (locale === "en" ? "Setup saved on this device." : "이 기기에 설정을 저장했습니다.") : (locale === "en" ? "Could not save. This session still works." : "저장하지 못했습니다. 현재 세션에서는 계속 사용할 수 있습니다."));
      if (result.ok) trackProductEvent("weekly_project_saved", { locale });
    }}>{locale === "en" ? "Save setup for next week" : "다음 주를 위해 설정 저장"}</button>
    {!persistenceEnabled && <p>{locale === "en" ? "Device storage is off. This session is not retained." : "기기 저장이 꺼져 있어 현재 세션만 유지됩니다."}</p>}
    {!targetCurrencyMatches && <p className="wr-notice">{locale === "en" ? "The saved target uses a different currency. Re-enter it in the declared source currency before saving or applying it." : "저장된 목표와 원본 통화가 다릅니다. 목표를 원본 통화로 다시 입력한 뒤 저장·적용하세요."}</p>}
    {projectStatus && <p role="status">{projectStatus}</p>}
    <Link href={locale === "en" ? "/en/storage" : "/storage"}>{locale === "en" ? "Storage settings" : "저장소 설정"}</Link>
  </details>;

  // 저장된 주간 기록을 읽어야 평소 변동 범위를 판정할 수 있다(§2.3).
  // 못 읽으면 빈 목록으로 떨어지고 리뷰는 크기·표본 두 축으로 계속 동작한다.
  useEffect(() => {
    let alive = true;
    (persistenceEnabled ? listStoredSnapshots() : Promise.resolve([])).then((list) => {
      if (alive) { setStoredSnapshots(list); setSnapshotsReady(true); }
    });
    return () => { alive = false; };
  }, [persistenceEnabled]);

  const review = useMemo(
    () => isAnalyzed ? runReview({ rows, storedSnapshots, decisionRecords, project, customPeriod }) : { ok: false, reason: "awaiting_analysis" },
    [isAnalyzed, rows, storedSnapshots, decisionRecords, project, customPeriod],
  );

  // 이번 기간 집계를 보관한다 — 다음 주의 "평소 범위"가 여기서 나온다.
  // 기기 저장을 끈 사용자에게는 쓰지 않는다.
  useEffect(() => {
    if (!review.ok || persistenceEnabled !== true) return;
    let alive = true;
    saveStoredSnapshot(review.previous, { shouldSave: () => useAppStore.getState().decisionPersistenceEnabled === true }).then(async (previous) => {
      if (!alive) return;
      const current = await saveStoredSnapshot(review.current, { shouldSave: () => useAppStore.getState().decisionPersistenceEnabled === true });
      if (alive) {
        setSnapshotStatus(previous.ok && current.ok ? "saved" : "failed");
        if (previous.ok && current.ok) setStoredSnapshots((existing) => {
          const next = mergeSnapshots(mergeSnapshots(existing, review.previous), review.current);
          const comparable = (list) => JSON.stringify(list.map(({ savedAt, ...snapshot }) => snapshot));
          return comparable(existing) === comparable(next) ? existing : next;
        });
      }
    });
    return () => { alive = false; };
  }, [review, persistenceEnabled]);

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
    trackProductEventOnce("weekly_review_completed", productEventKey(csvData.fileName, csvData.raw?.length, review.periods.current.start, review.periods.current.end, project.kpi.metric, locale), {
      locale, tool_id: "weekly-review", source: reviewSource,
      data_continuity: review.previousSource === "snapshot" ? "saved_snapshot" : "uploaded_periods",
      result_state: review.routing.status,
    });
  }, [review, csvData.fileName, csvData.raw, project.kpi.metric, locale, isAnalyzed, workspaceReady, snapshotsReady, projectReady, reviewSource]);

  const saveDecision = (recommendedLabel) => {
    const record = {
      toolId: "weekly-review",
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
    addDecisionRecord(record);
    trackProductEvent("weekly_decision_saved", { locale, tool_id: "weekly-review", source: reviewSource });
    setSavedDecision({ record, raw: csvData.raw, context: decisionContext });
  };

  if (!review.ok) {
    return (
      <article className="page-inner wr-screen">
        <WeeklyReviewHandoverNotice locale={locale} decisionCount={existingDecisionCount} />
        <header className="wr-screen__head">
          <div className="wr-screen__eyebrow">{t.eyebrow}</div>
          <h1>{t.title}</h1>
        </header>
        <section className="wr-screen__empty" aria-labelledby="wr-empty">
          <h2 id="wr-empty">{t.noData}</h2>
          <p>{t.noDataDeck}</p>
          {projectSetup}
      {persistenceEnabled && snapshotStatus === "failed" && <p className="wr-notice" role="status">{locale === "en" ? "The aggregate could not be saved. Keep a CSV covering both periods for your next review." : "집계를 저장하지 못했습니다. 다음 리뷰에는 비교할 두 기간의 CSV가 필요합니다."}</p>}
          {review.reason && REASON_TEXT[locale]?.[review.reason] && (
            <p className="wr-screen__reason">{REASON_TEXT[locale][review.reason]}</p>
          )}
          {workspaceReady ? <CsvUploader toolId="5-2" analyticsToolId="weekly-review" locale={locale} showMappingReview /> : <p role="status">{locale === "en" ? "Loading this device's saved workspace…" : "이 기기의 저장된 작업을 확인하고 있습니다…"}</p>}
          <Link href={locale === "en" ? "/en/start" : "/start"}>{t.goUpload}</Link>
        </section>
        <ReviewSettings
          t={t} locale={locale}
          kpiMetric={kpiMetric} setKpiMetric={setKpiMetric}
          basis={basis} setBasis={setBasis}
          customPeriod={customPeriod} setCustomPeriod={setCustomPeriod}
          periods={review.periods || null}
          historyWeeks={0}
        />
        <PastDecisions locale={locale} t={t} count={decisionRecords.length} />
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
    <article className="page-inner wr-screen">
      <WeeklyReviewHandoverNotice locale={locale} decisionCount={existingDecisionCount} />

      <header className="wr-screen__head">
        <div className="wr-screen__eyebrow">{t.eyebrow}</div>
        <h1>{t.title}</h1>
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
      {projectSetup}
      {persistenceEnabled && snapshotStatus === "failed" && <p className="wr-notice" role="status">{locale === "en" ? "The aggregate could not be saved. Keep a CSV covering both periods for your next review." : "집계를 저장하지 못했습니다. 다음 리뷰에는 비교할 두 기간의 CSV가 필요합니다."}</p>}
      <details><summary>{locale === "en" ? "Upload next week's CSV / review mapping" : "다음 주 CSV 올리기 / 매핑 확인"}</summary>{workspaceReady && <CsvUploader toolId="5-2" analyticsToolId="weekly-review" locale={locale} showMappingReview />}</details>
      {review.previousSource === "snapshot" && <p role="note">{locale === "en" ? "The comparison period uses a saved aggregate snapshot." : "지난 기간은 저장된 집계 스냅샷을 사용합니다."}</p>}

      <ReviewSettings
        t={t} locale={locale}
        kpiMetric={kpiMetric} setKpiMetric={setKpiMetric}
        basis={basis} setBasis={setBasis}
        customPeriod={customPeriod} setCustomPeriod={setCustomPeriod}
        periods={periods}
        historyWeeks={review.history?.[kpiMetric]?.length ?? 0}
      />

      {/* ── 1. 결론 ─────────────────────────────── */}
      <section className="wr-card" aria-labelledby="wr-verdict">
        <h2 className="wr-card__eyebrow" id="wr-verdict">{t.verdictHead}</h2>
        <div className="wr-verdict">
          <p className={`wr-verdict__big ${kpiAssessment?.significant ? (kpiAssessment.outcome === "worse" ? "is-bad" : "is-good") : "is-flat"}`}>
            {unknown ? t.unknown : quiet ? t.quiet : `${kpiMetric.toUpperCase()} ${pct(kpiAssessment.deltaPct)}`}
          </p>
          {!unknown && (
            <p className="wr-verdict__from">
              {kpiMetric === "roas" ? fmtPct(metrics.previous[kpiMetric]) : money(metrics.previous[kpiMetric])} → {kpiMetric === "roas" ? fmtPct(metrics.current[kpiMetric]) : money(metrics.current[kpiMetric])}
            </p>
          )}
          <p className="wr-note">{locale === "en" ? "Review thresholds are provisional operating heuristics, not a statistical significance or equivalence test. Observed changes do not prove that a decision caused them." : "확인 기준은 임시 운영 규칙이며 통계적 유의성·동등성 검정이 아닙니다. 관측된 변화가 결정의 인과효과를 증명하지는 않습니다."}</p>
          {project.target && <p className="wr-note">{locale === "en" ? "Declared KPI target (ROAS uses a ratio, e.g. 2 = 200%)" : "선언한 KPI 목표 (ROAS는 배수, 예: 2 = 200%)"}: {money(project.target.value)} {targetCurrency || csvData.currency || ""}</p>}
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

        <div className="wr-tablewrap">
          <table>
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

      {/* ── 2. 왜 (신호가 있을 때만) ───────────────── */}
      {!quiet && !unknown && variance?.ok && (
        <section className="wr-card" aria-labelledby="wr-why">
          <h2 className="wr-card__eyebrow" id="wr-why">{t.whyHead}</h2>

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

          <div className="wr-tablewrap">
            <table>
              <caption>{t.driversCaption}</caption>
              <thead>
                <tr>
                  <th scope="col">{locale === "en" ? "Campaign" : "캠페인"}</th>
                  <th scope="col">CPA</th>
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
          <h2 className="wr-card__eyebrow" id="wr-last">{t.lastHead}</h2>
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
          <h2 className="wr-card__eyebrow" id="wr-next">{t.nextHead}</h2>

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
                value={decision.goalDirection}
                onChange={(event) => setDecision((prev) => ({ ...prev, goalDirection: event.target.value }))}
              >
                <option value="up">{locale === "en" ? "Increase" : "증가"}</option>
                <option value="down">{locale === "en" ? "Decrease" : "감소"}</option>
                <option value="hold">{locale === "en" ? "Hold" : "유지"}</option>
              </select>
            </label>
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
            {project.target && <button type="button" className="btn" disabled={!targetCurrencyMatches} onClick={() => setDecision((prev) => ({ ...prev, goalMetric: kpiMetric, goalDirection: project.kpi.direction === LOWER_IS_BETTER ? "down" : "up", guardrailMetric: kpiMetric, guardrailOp: project.kpi.direction === LOWER_IS_BETTER ? "lte" : "gte", guardrailValue: targetValue }))}>{locale === "en" ? "Use project KPI and target" : "프로젝트 KPI·목표 적용"}</button>}
            {!decision.guardrailValue && <p className="wr-note">{t.guardHint}</p>}
            <button type="button" className="btn primary" onClick={() => saveDecision(recommended?.label || "")}>{t.save}</button>
            {isSavedDecisionCurrent && <><p className="wr-note" role="status">{t.saved} · {savedDecision.record.reviewDate}</p><button type="button" className="btn" onClick={() => downloadCalendar(serializeDecisionReviewIcs(savedDecision.record, locale), "weekly_review")}>{locale === "en" ? "Download review reminder (.ics)" : "다음 검토일 캘린더 받기 (.ics)"}</button></>}
          </div>
        </section>
      </details>

      {/* ── 5. 공유 ───────────────────────────────── */}
      <section className="wr-card" aria-labelledby="wr-share">
        <h2 className="wr-card__eyebrow" id="wr-share">{t.shareHead}</h2>
        <pre className="wr-report">{renderReportText(draft, { number: money })}</pre>
        <button type="button" className="btn" onClick={async () => {
          try {
            await navigator.clipboard.writeText(renderReportText(draft, { number: money }));
            setCopyStatus(locale === "en" ? "Copied." : "복사했습니다.");
            trackProductEvent("weekly_review_export", { locale, tool_id: "weekly-review", source: reviewSource, download_type: "clipboard", state: "completed" });
          } catch { setCopyStatus(locale === "en" ? "Copy failed. Select and copy the report text." : "복사하지 못했습니다. 보고서 본문을 선택해 복사해 주세요."); }
        }}>{locale === "en" ? "Copy for Slack / Notion" : "Slack / Notion용 복사"}</button>
        <button type="button" className="btn" onClick={() => { trackProductEvent("weekly_review_export", { locale, tool_id: "weekly-review", source: reviewSource, download_type: "print", state: "requested" }); window.print(); }}>{locale === "en" ? "Print / PDF" : "인쇄 / PDF"}</button>
        {copyStatus && <p role="status">{copyStatus}</p>}
      </section>

      <PastDecisions locale={locale} t={t} count={decisionRecords.length} />
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
    <details className="wr-settings">
      <summary>{t.settings}</summary>
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
          <select value={basis} onChange={(event) => setBasis(event.target.value)}>
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
                : periods
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
    </details>
  );
}

function PastDecisions({ locale, t, count }) {
  return (
    <details className="wr-history">
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
