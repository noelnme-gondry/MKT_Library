"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import CsvUploader from "@/components/CsvUploader";
import JourneyProgress from "@/components/ds/JourneyProgress";
import { trackProductEvent } from "@/lib/analytics";
import AssistantWorkspace from "@/components/assistant/AssistantWorkspace";
import BasisCurrencyToggleBar from "@/components/dashboard/BasisCurrencyToggleBar";
import { useAppStore } from "@/store/useDataStore";
import { idToPath } from "@/lib/routeMap";
import { inferMappedDateCadence } from "@/lib/data-import/inferDateCadence";
import { TOOL_REQUIRED_FIELDS } from "@/utils/csvConstants";
import { toolIndexEntry } from "@/lib/toolIndex";
import { getSampleJourney } from "@/lib/sampleJourney";

const COPY = {
  ko: {
    eyebrow: "DATA ANALYSIS",
    mappingTitle: "컬럼을 확인해 주세요",
    mappingDeck: "이 파일에서 찾은 역할입니다. 필요한 열만 고친 뒤 결과를 열어 주세요.",
    mappingAction: "확인하고 결과 가져오기",
    running: "분석을 준비하고 있습니다",
    insight: "아하!",
    resultsTitle: "분석 결과",
    resultsDeck: "이 파일로 지금 확인할 수 있는 판단을 순서대로 보여드립니다. 상세 화면은 필요한 분석만 여세요.",
    noDataTitle: "분석할 데이터를 먼저 올려 주세요",
    noDataDeck: "파일은 브라우저 안에서만 읽고, 이 화면에서 매핑과 결과를 이어서 보여드립니다.",
    backHome: "내 데이터로 시작",
    collapse: "접기",
    expand: "펼치기",
    openTool: "해당 분석으로 가기",
    sharedControls: "모든 효율 분석에 같이 적용",
    cadence: "날짜 해석",
    cadenceLabels: { daily: "일별 · 주간 분석은 자동 집계", weekly: "주간 그대로 사용", monthly: "월간 그대로 사용", irregular: "불규칙 간격 · 상세 확인 필요", unknown: "판정할 날짜 부족" },
    scope: "한 번 읽은 원본에서 안전하게 계산한 핵심 판단과 차트를 먼저 보여드립니다. 고급 모형과 추가 진단만 상세 분석에서 이어집니다.",
  },
  en: {
    eyebrow: "DATA ANALYSIS",
    mappingTitle: "Check your columns",
    mappingDeck: "These are the roles found in your file. Fix only what is needed, then open the results.",
    mappingAction: "Confirm and open results",
    running: "Preparing your analysis",
    insight: "Aha!",
    resultsTitle: "analysis results",
    resultsDeck: "See the decisions this file can support in order, then open only the detailed analysis you need.",
    noDataTitle: "Upload your data to begin",
    noDataDeck: "Your file is read only in this browser. Mapping and results continue here.",
    backHome: "Start with my data",
    collapse: "Collapse",
    expand: "Expand",
    openTool: "Open this analysis",
    sharedControls: "Applies to all efficiency analyses",
    cadence: "Date cadence",
    cadenceLabels: { daily: "Daily · weekly analyses auto-aggregate", weekly: "Weekly as provided", monthly: "Monthly as provided", irregular: "Irregular · review needed", unknown: "Not enough dates" },
    scope: "See the key decisions and charts that can be computed safely from one read of the source. Only advanced models and extra diagnostics continue in detailed analyses.",
  },
};

export default function DochiResultWorkspace({ locale = "ko" }) {
  const C = COPY[locale] || COPY.ko;
  const storeCsvData = useAppStore((state) => state.csvData);
  const setGroupAnalyzed = useAppStore((state) => state.setGroupAnalyzed);
  const handoffCsvToRoute = useAppStore((state) => state.handoffCsvToRoute);
  const setDochiAnalysisSession = useAppStore((state) => state.setDochiAnalysisSession);
  const dochiAnalysisSession = useAppStore((state) => state.dochiAnalysisSession);
  // 도구를 열 때 그 도구용으로 다시 매핑한 사본을 넘긴다. 뒤로 돌아오면 슬라이스가 그 사본이라
  // 결과 화면이 원본을 못 알아보고 컬럼 확인부터 다시 물었다(2026-09-24). 이 화면이 넘긴 사본이면
  // 원본으로 되돌려 읽는다 — 새 업로드는 세션을 비우므로 여기에 걸리지 않는다.
  const csvData = dochiAnalysisSession?.handoffs?.includes(storeCsvData) ? dochiAnalysisSession.sourceData : storeCsvData;
  const isAnalyzed = useAppStore((state) => state.isGroupAnalyzed("dochi-result"));
  const sample = getSampleJourney(csvData);
  const router = useRouter();
  const hasRememberedResult = dochiAnalysisSession?.sourceData?.raw === csvData?.raw
    && dochiAnalysisSession?.sourceData?.mapping === csvData?.mapping;
  const initialPhase = hasRememberedResult || (sample && isAnalyzed) ? "results" : "mapping";
  const [phaseState, setPhaseState] = useState(() => ({ raw: csvData.raw, mapping: csvData.mapping, value: initialPhase }));
  const phase = phaseState.raw === csvData.raw && phaseState.mapping === csvData.mapping ? phaseState.value : initialPhase;
  const setPhase = value => setPhaseState({ raw: csvData.raw, mapping: csvData.mapping, value });
  const [mappingStage, setMappingStage] = useState("legacy");
  const timersRef = useRef([]);
  const hasPreparedData = Boolean(csvData?.raw?.length && csvData?.headers?.length);
  const cadence = inferMappedDateCadence(csvData);
  const mappedFields = new Set(Object.values(csvData?.mapping || {}));
  const canReviewWeekly = mappedFields.has("campaign_name") && TOOL_REQUIRED_FIELDS["5-2"].every(field => typeof field === "string" ? mappedFields.has(field) : field.oneOf.some(key => mappedFields.has(key)));

  useEffect(() => () => timersRef.current.forEach((timer) => window.clearTimeout(timer)), []);

  const openResults = () => {
    trackProductEvent("dochi_mapping_confirmed", { tool_id: "start-gate", source: "dochi", placement: "dochi_mapping", locale });
    setGroupAnalyzed("dochi-result");
    setPhase("running");
    const timer = window.setTimeout(() => setPhase("results"), 0);
    timersRef.current.push(timer);
  };
  const openTool = useCallback((toolId, prepared = csvData) => {
    const session = useAppStore.getState().dochiAnalysisSession;
    setDochiAnalysisSession({ ...(session || {}), sourceData: session?.sourceData || csvData, handoffs: [...(session?.handoffs || []), prepared] });
    handoffCsvToRoute(toolId, prepared);
    const path = idToPath(toolId);
    router.push(locale === "en" ? `/en${path}` : path);
  }, [csvData, handoffCsvToRoute, locale, router, setDochiAnalysisSession]);
  const rememberAvailableAnalyses = useCallback((eligibility) => {
    const analyses = eligibility
      .filter((result) => result.status !== "blocked")
      .map(({ toolId, status, recommendationReason }) => ({ toolId, status, recommendationReason }));
    const session = useAppStore.getState().dochiAnalysisSession;
    setDochiAnalysisSession({ sourceData: csvData, analyses, handoffs: session?.sourceData === csvData ? session.handoffs || [] : [] });
  }, [csvData, setDochiAnalysisSession]);

  if (!hasPreparedData) {
    return <section className="dochi-result-empty" aria-labelledby="dochi-result-empty-title">
      <span>{C.eyebrow}</span>
      <h1 id="dochi-result-empty-title">{C.noDataTitle}</h1>
      <p>{C.noDataDeck}</p>
      <Link className="ab-button" href={locale === "en" ? "/en/start" : "/start"}>{C.backHome}</Link>
    </section>;
  }

  return <section className="dochi-result-workspace" data-phase={phase} aria-labelledby="dochi-result-title">
    <JourneyProgress stage={phase === "mapping" ? "prepare" : "analyze"} locale={locale} placement="dochi_result" />
    {phase === "running" && <p role="status">{C.running}</p>}
    {phase === "mapping" && <>
      <header className="dochi-result-workspace__header">
        <span>{C.eyebrow}</span>
        <h1 id="dochi-result-title">{C.mappingTitle}</h1>
        <p>{C.mappingDeck}</p>
      </header>
      <CsvUploader
        toolId="start-gate"
        analyticsPlacement="dochi_mapping"
        locale={locale}
        showMappingReview
        collapseMappingReview={false}
        mappingReviewStage={mappingStage}
        mappingReviewActionLabel={C.mappingAction}
        mappingReviewFallbackLabel={locale === "en" ? "Review additional column matches" : "추가 컬럼 연결 확인"}
        onMappingReviewNeedsSemanticFallback={() => setMappingStage("semantic")}
        onMappingReviewConfirmed={openResults}
      />
    </>}
    {phase === "results" && <>
      <header className="dochi-result-workspace__header is-results">
        <div className="dochi-result-workspace__intro"><h1 id="dochi-result-title">{C.resultsTitle}</h1></div>
        {/* 입력 요약은 한 줄 — 상자 세 개(샘플·데이터·공통 설정)가 결과보다 먼저 자리를 차지했다. */}
        <p className={`dochi-result-workspace__summary${sample ? " sample-journey-scope" : ""}`} aria-label={locale === "en" ? "Data summary" : "입력 요약"}>
          <strong title={csvData.fileName}>{sample ? `${locale === "en" ? "Sample data" : "샘플 데이터"} · ${sample.channel}` : csvData.fileName}</strong>
          <span className="tnum">{csvData.raw.length.toLocaleString()}{locale === "en" ? " rows" : "행"}</span>
          {sample ? <span className="tnum">{sample.period.currentStart} – {sample.period.currentEnd} {locale === "en" ? "vs" : "vs"} {sample.period.previousStart} – {sample.period.previousEnd}</span> : null}
          <span>{C.cadenceLabels[cadence.cadence]}</span>
          {sample ? <Link href={locale === "en" ? "/en/start" : "/start"}>{locale === "en" ? "Use my data" : "내 데이터로 바꾸기"}</Link> : null}
        </p>
        {/* 자동 기준 전환 같은 고지가 여기 뜨므로 접지 않는다 — 상자만 벗는다. */}
        <div className="dochi-result-workspace__global-controls"><strong>{C.sharedControls}</strong><BasisCurrencyToggleBar locale={locale} /></div>
      </header>
      <AssistantWorkspace csvData={csvData} locale={locale} getTitle={(id) => toolIndexEntry(id, locale)?.name} onOpenTool={openTool} onEligibilityChange={rememberAvailableAnalyses} autoStart showContextHeader={false} sampleMode={Boolean(sample)} />
      <section className="dochi-weekly-bridge" aria-labelledby="dochi-weekly-title">
        <div><h2 id="dochi-weekly-title">{locale === "en" ? "Turn this data into your next marketing project" : "이 데이터를 다음 마케팅 프로젝트로"}</h2><p>{locale === "en" ? "Compare periods against your KPI target, inspect campaigns and prepare a report with your next decision. Your uploaded file comes with you." : "목표 대비 성과와 캠페인별 변화를 검토하고, 다음 결정이 담긴 보고서를 만드세요. 지금 올린 파일을 그대로 이어갑니다."}</p>
          {!canReviewWeekly && <p>{locale === "en" ? "Map date, campaign, spend and conversions or installs to make it a project." : "날짜·캠페인·비용과 전환 또는 설치 열을 연결하면 프로젝트로 만들 수 있습니다."}</p>}
        </div><button type="button" className="btn primary" disabled={!canReviewWeekly} onClick={() => { trackProductEvent("review_entry_clicked", { tool_id: "weekly-review", source: "dochi", placement: "dochi_result", data_continuity: "same_data", locale }); handoffCsvToRoute("5-2", csvData); router.push(locale === "en" ? "/en/weekly-review#weekly-performance" : "/weekly-review#weekly-performance"); }}>{locale === "en" ? "Make it my next marketing project" : "다음 마케팅 프로젝트로 만들기"}</button>
      </section>
    </>}
  </section>;
}
