"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import CsvUploader from "@/components/CsvUploader";
import DochiSprite from "@/components/assistant/DochiSprite";
import AssistantWorkspace from "@/components/assistant/AssistantWorkspace";
import BasisCurrencyToggleBar from "@/components/dashboard/BasisCurrencyToggleBar";
import { useAppStore } from "@/store/useDataStore";
import { idToPath } from "@/lib/routeMap";
import { inferMappedDateCadence } from "@/lib/data-import/inferDateCadence";

const COPY = {
  ko: {
    eyebrow: "DOCHI RESULT",
    mappingTitle: "컬럼을 확인해 주세요",
    mappingDeck: "이 파일에서 찾은 역할입니다. 필요한 열만 고친 뒤 결과를 열어 주세요.",
    mappingAction: "확인하고 결과 가져오기",
    running: "도치가 분석 화면을 가져오는 중",
    insight: "아하!",
    resultsTitle: "도치 결과함",
    resultsDeck: "이 파일로 지금 확인할 수 있는 판단을 순서대로 보여드립니다. 상세 화면은 필요한 분석만 여세요.",
    noDataTitle: "먼저 도치에게 CSV를 맡겨 주세요",
    noDataDeck: "파일은 브라우저 안에서만 읽고, 이 화면에서 매핑과 결과를 이어서 보여드립니다.",
    backHome: "홈에서 CSV 올리기",
    collapse: "접기",
    expand: "펼치기",
    openTool: "해당 분석으로 가기",
    sharedControls: "모든 효율 분석에 같이 적용",
    cadence: "날짜 해석",
    cadenceLabels: { daily: "일별 · 주간 분석은 자동 집계", weekly: "주간 그대로 사용", monthly: "월간 그대로 사용", irregular: "불규칙 간격 · 상세 확인 필요", unknown: "판정할 날짜 부족" },
    scope: "한 번 읽은 원본에서 안전하게 계산한 핵심 판단과 차트를 먼저 보여드립니다. 고급 모형과 추가 진단만 상세 분석에서 이어집니다.",
  },
  en: {
    eyebrow: "DOCHI RESULT",
    mappingTitle: "Check your columns",
    mappingDeck: "These are the roles found in your file. Fix only what is needed, then open the results.",
    mappingAction: "Confirm and open results",
    running: "Dochi is bringing in the analysis views",
    insight: "Aha!",
    resultsTitle: "Dochi results",
    resultsDeck: "See the decisions this file can support in order, then open only the detailed analysis you need.",
    noDataTitle: "Give Dochi a CSV first",
    noDataDeck: "Your file is read only in this browser. Mapping and results continue here.",
    backHome: "Upload a CSV from home",
    collapse: "Collapse",
    expand: "Expand",
    openTool: "Open this analysis",
    sharedControls: "Applies to all efficiency analyses",
    cadence: "Date cadence",
    cadenceLabels: { daily: "Daily · weekly analyses auto-aggregate", weekly: "Weekly as provided", monthly: "Monthly as provided", irregular: "Irregular · review needed", unknown: "Not enough dates" },
    scope: "See the key decisions and charts that can be computed safely from one read of the source. Only advanced models and extra diagnostics continue in detailed analyses.",
  },
};

function DochiJourney({ label, insight }) {
  return <div className="dochi-journey is-running" aria-hidden="true">
    <div className="dochi-journey__scene">
      <div className="dochi-journey__floor" />
      <div className="dochi-journey__books"><i /><i /><i /></div>
      <div className="dochi-journey__data-card"><span>DATA</span><i /><i /><i /></div>
      <div className="dochi-journey__chart-card"><span /><div><i /><i /><i /><i /></div><b /></div>
      <div className="dochi-journey__mascot"><DochiSprite pose="delivery" direction="right" /></div>
      <div className="dochi-journey__insight">
        <i /><i /><i /><i />
        <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 7a13 13 0 0 0-8 23.2c1.8 1.4 2.8 3.4 2.8 5.6h10.4c0-2.2 1-4.2 2.8-5.6A13 13 0 0 0 24 7Z" /><path d="M19 40h10M20.5 44h7" /></svg>
        <strong>{insight}</strong>
      </div>
    </div>
    <p>{label}</p>
  </div>;
}

export default function DochiResultWorkspace({ locale = "ko" }) {
  const C = COPY[locale] || COPY.ko;
  const csvData = useAppStore((state) => state.csvData);
  const setGroupAnalyzed = useAppStore((state) => state.setGroupAnalyzed);
  const handoffCsvToRoute = useAppStore((state) => state.handoffCsvToRoute);
  const setDochiAnalysisSession = useAppStore((state) => state.setDochiAnalysisSession);
  const dochiAnalysisSession = useAppStore((state) => state.dochiAnalysisSession);
  const router = useRouter();
  const hasRememberedResult = dochiAnalysisSession?.sourceData?.raw === csvData?.raw
    && dochiAnalysisSession?.sourceData?.mapping === csvData?.mapping;
  const [phase, setPhase] = useState(() => hasRememberedResult ? "results" : "mapping");
  const [mappingStage, setMappingStage] = useState("legacy");
  const timersRef = useRef([]);
  const hasPreparedData = Boolean(csvData?.raw?.length && csvData?.headers?.length);
  const cadence = inferMappedDateCadence(csvData);
  const mappedCount = new Set(Object.values(csvData?.mapping || {}).filter((value) => value && value !== "__ignore__")).size;

  useEffect(() => () => timersRef.current.forEach((timer) => window.clearTimeout(timer)), []);

  const openResults = () => {
    const hasReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    setGroupAnalyzed("dochi-result");
    setPhase("running");
    const timer = window.setTimeout(() => setPhase("results"), hasReducedMotion ? 0 : 1100);
    timersRef.current.push(timer);
  };
  const openTool = useCallback((toolId, prepared = csvData) => {
    handoffCsvToRoute(toolId, prepared);
    const path = idToPath(toolId);
    router.push(locale === "en" ? `/en${path}` : path);
  }, [csvData, handoffCsvToRoute, locale, router]);
  const rememberAvailableAnalyses = useCallback((eligibility) => {
    const analyses = eligibility
      .filter((result) => result.status !== "blocked")
      .map(({ toolId, status, recommendationReason }) => ({ toolId, status, recommendationReason }));
    setDochiAnalysisSession({ sourceData: csvData, analyses });
  }, [csvData, setDochiAnalysisSession]);

  if (!hasPreparedData) {
    return <section className="dochi-result-empty" aria-labelledby="dochi-result-empty-title">
      <span>{C.eyebrow}</span>
      <h1 id="dochi-result-empty-title">{C.noDataTitle}</h1>
      <p>{C.noDataDeck}</p>
      <Link className="ab-button" href={locale === "en" ? "/en" : "/"}>{C.backHome}</Link>
    </section>;
  }

  return <section className="dochi-result-workspace" data-phase={phase} aria-labelledby="dochi-result-title">
    {phase === "running" && <DochiJourney label={C.running} insight={C.insight} />}
    {phase === "mapping" && <>
      <header className="dochi-result-workspace__header">
        <span>{C.eyebrow}</span>
        <h1 id="dochi-result-title">{C.mappingTitle}</h1>
        <p>{C.mappingDeck}</p>
      </header>
      <CsvUploader
        toolId="start-gate"
        locale={locale}
        showMappingReview
        collapseMappingReview={false}
        mappingReviewStage={mappingStage}
        mappingReviewActionLabel={C.mappingAction}
        mappingReviewFallbackLabel={locale === "en" ? "Let Dochi complete the mapping" : "도치가 매핑 보완하기"}
        onMappingReviewNeedsSemanticFallback={() => setMappingStage("semantic")}
        onMappingReviewConfirmed={openResults}
      />
    </>}
    {phase === "results" && <>
      <header className="dochi-result-workspace__header is-results">
        <div className="dochi-result-workspace__intro"><span>{C.eyebrow}</span><h1 id="dochi-result-title">{C.resultsTitle}</h1><p>{C.resultsDeck}</p><small>{C.scope}</small></div>
        <dl className="dochi-result-workspace__context">
          <div><dt>{locale === "en" ? "Data" : "데이터"}</dt><dd title={csvData.fileName}>{csvData.fileName}</dd></div>
          <div><dt>{locale === "en" ? "Rows" : "행"}</dt><dd>{csvData.raw.length.toLocaleString()}</dd></div>
          <div><dt>{locale === "en" ? "Columns" : "컬럼"}</dt><dd>{csvData.headers.length.toLocaleString()}</dd></div>
          <div><dt>{locale === "en" ? "Mapped" : "표준 역할"}</dt><dd>{mappedCount}/{csvData.headers.length}</dd></div>
          <div><dt>{C.cadence}</dt><dd>{C.cadenceLabels[cadence.cadence]}</dd></div>
        </dl>
        <div className="dochi-result-workspace__global-controls"><strong>{C.sharedControls}</strong><BasisCurrencyToggleBar locale={locale} /></div>
      </header>
      <AssistantWorkspace csvData={csvData} locale={locale} onOpenTool={openTool} onEligibilityChange={rememberAvailableAnalyses} autoStart showContextHeader={false} />
    </>}
  </section>;
}
