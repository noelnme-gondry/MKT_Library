"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";

import CsvUploader from "@/components/CsvUploader";
import DochiSprite from "@/components/assistant/DochiSprite";
import { useAppStore } from "@/store/useDataStore";
import { idToPath } from "@/lib/routeMap";

const Loading = () => <p className="dochi-result-loading">결과 화면을 여는 중…</p>;
const Dashboard = dynamic(() => import("@/components/Dashboard"), { ssr: false, loading: Loading });
const CampaignPvm = dynamic(() => import("@/components/tools/CampaignPvm"), { ssr: false, loading: Loading });
const MarketingEfficiency = dynamic(() => import("@/components/tools/MarketingEfficiency"), { ssr: false, loading: Loading });
const BudgetAllocation = dynamic(() => import("@/components/tools/BudgetAllocation"), { ssr: false, loading: Loading });

const COPY = {
  ko: {
    eyebrow: "DOCHI RESULT",
    mappingTitle: "컬럼을 확인해 주세요",
    mappingDeck: "이 파일에서 찾은 역할입니다. 필요한 열만 고친 뒤 결과를 열어 주세요.",
    mappingAction: "확인하고 결과 가져오기",
    running: "도치가 분석 화면을 가져오는 중",
    insight: "아하!",
    resultsTitle: "같은 데이터로 바로 보는 분석 결과",
    resultsDeck: "각 섹션은 원래 분석 도구와 같은 화면입니다. 필요한 것만 접고 펼칠 수 있어요.",
    noDataTitle: "먼저 도치에게 CSV를 맡겨 주세요",
    noDataDeck: "파일은 브라우저 안에서만 읽고, 이 화면에서 매핑과 결과를 이어서 보여드립니다.",
    backHome: "홈에서 CSV 올리기",
    collapse: "접기",
    expand: "펼치기",
    openTool: "해당 분석으로 가기",
    dashboard: "운영 대시보드",
    pvm: "캠페인 성과 변동",
    saturation: "캠페인 포화도 진단",
    allocation: "예산 배분 시뮬레이터",
  },
  en: {
    eyebrow: "DOCHI RESULT",
    mappingTitle: "Check your columns",
    mappingDeck: "These are the roles found in your file. Fix only what is needed, then open the results.",
    mappingAction: "Confirm and open results",
    running: "Dochi is bringing in the analysis views",
    insight: "Aha!",
    resultsTitle: "Analysis results from this same data",
    resultsDeck: "Each section is the original analysis-tool view. Collapse anything you do not need.",
    noDataTitle: "Give Dochi a CSV first",
    noDataDeck: "Your file is read only in this browser. Mapping and results continue here.",
    backHome: "Upload a CSV from home",
    collapse: "Collapse",
    expand: "Expand",
    openTool: "Open this analysis",
    dashboard: "Operations dashboard",
    pvm: "Campaign performance variance",
    saturation: "Campaign saturation analysis",
    allocation: "Budget allocation",
  },
};

const TOOL_VIEWS = [
  { id: "5-2", key: "dashboard", Component: Dashboard, open: true },
  { id: "5-21", key: "pvm", Component: CampaignPvm },
  { id: "5-22", key: "saturation", Component: MarketingEfficiency },
  { id: "5-3", key: "allocation", Component: BudgetAllocation },
];

function DochiJourney({ label, insight }) {
  return <div className="dochi-journey is-running" aria-hidden="true">
    <div className="dochi-journey__scene">
      <div className="dochi-journey__data-tag"><span>CSV</span><i /><i /><i /></div>
      <div className="dochi-journey__mascot"><DochiSprite pose="delivery" direction="right" /></div>
      <div className="dochi-journey__insight">
        <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 7a13 13 0 0 0-8 23.2c1.8 1.4 2.8 3.4 2.8 5.6h10.4c0-2.2 1-4.2 2.8-5.6A13 13 0 0 0 24 7Z" /><path d="M19 40h10M20.5 44h7" /></svg>
        <strong>{insight}</strong>
      </div>
    </div>
    <p>{label}</p>
  </div>;
}

function ToolView({ id, title, Component, locale, open = false, collapseLabel, expandLabel, openToolLabel }) {
  const [hasOpened, setHasOpened] = useState(open);
  const [isOpen, setIsOpen] = useState(open);
  const router = useRouter();
  const openTool = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const path = idToPath(id);
    router.push(locale === "en" ? `/en${path}` : path);
  };
  const togglePanel = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    if (nextOpen) setHasOpened(true);
  };
  return <details className="dochi-result-tool" open={isOpen} onToggle={(event) => {
    const nextOpen = event.currentTarget.open;
    setIsOpen(nextOpen);
    if (nextOpen) setHasOpened(true);
  }}>
    <summary>
      <strong>{title}</strong>
      <span className="dochi-result-tool__actions">
        <button type="button" onClick={togglePanel}>{isOpen ? collapseLabel : expandLabel}</button>
        <button type="button" className="dochi-result-tool__open" onClick={openTool}>{openToolLabel} <span aria-hidden="true">↗</span></button>
      </span>
    </summary>
    {hasOpened && <div className="dochi-result-tool__view"><Component locale={locale} /></div>}
  </details>;
}

export default function DochiResultWorkspace({ locale = "ko" }) {
  const C = COPY[locale] || COPY.ko;
  const csvData = useAppStore((state) => state.csvData);
  const setGroupAnalyzed = useAppStore((state) => state.setGroupAnalyzed);
  const [phase, setPhase] = useState("mapping");
  const [mappingStage, setMappingStage] = useState("legacy");
  const timersRef = useRef([]);
  const hasPreparedData = Boolean(csvData?.raw?.length && csvData?.headers?.length);

  useEffect(() => () => timersRef.current.forEach((timer) => window.clearTimeout(timer)), []);

  const openResults = () => {
    const hasReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    setGroupAnalyzed("dochi-result");
    setPhase("running");
    const timer = window.setTimeout(() => setPhase("results"), hasReducedMotion ? 0 : 1100);
    timersRef.current.push(timer);
  };

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
      <header className="dochi-result-workspace__header">
        <span>{C.eyebrow}</span>
        <h1 id="dochi-result-title">{C.resultsTitle}</h1>
        <p>{C.resultsDeck}</p>
      </header>
      <div className="dochi-result-tools">
        {TOOL_VIEWS.map(({ id, key, Component, open }) => <ToolView key={id} id={id} title={C[key]} Component={Component} locale={locale} open={open} collapseLabel={C.collapse} expandLabel={C.expand} openToolLabel={C.openTool} />)}
      </div>
    </>}
  </section>;
}
