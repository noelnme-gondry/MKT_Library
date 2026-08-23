"use client";

import { useEffect, useRef, useState } from "react";

import CsvUploader from "@/components/CsvUploader";
import AssistantWorkspace from "@/components/assistant/AssistantWorkspace";
import { DochiChartBundle } from "@/components/assistant/DochiHandoffMotion";
import DochiSprite from "@/components/assistant/DochiSprite";
import { IA, useAppStore } from "@/store/useDataStore";
import { trItemTitle } from "@/lib/enNavCopy";

const COPY = {
  ko: {
    label: "도치 박사 데이터 접수처",
    greeting: "안녕하세요, 도치예요.",
    prompt: "CSV 하나를 올려 주세요. 읽고 바로 결과를 가져올게요.",
    privacy: "데이터는 브라우저 안에서만 읽습니다.",
    importing: "파일을 읽고 있어요.",
    mappingTitle: "컬럼만 확인해 주세요",
    mappingDeck: "확인하면 도치가 실제 분석 결과를 이 화면으로 가져옵니다.",
    running: "분석 결과를 가져오는 중",
    results: "도치가 가져온 실제 분석 결과",
    resultsDeck: "대시보드부터 실행 가능한 분석 결과를 펼쳤습니다. 각 결과는 접을 수 있습니다.",
    heading: "도치에게 데이터 맡기기",
  },
  en: {
    label: "Dochi, data intake guide",
    greeting: "Hi, I’m Dochi.",
    prompt: "Upload one CSV. I’ll read it and bring back the results.",
    privacy: "Your data is read only in this browser.",
    importing: "Reading your file.",
    mappingTitle: "Please check the columns",
    mappingDeck: "Confirm them and Dochi will bring actual analysis results onto this page.",
    running: "Bringing back analysis results",
    results: "Actual analysis results Dochi brought back",
    resultsDeck: "The dashboard runs first, followed by every runnable analysis. You can collapse each result.",
    heading: "Give your data to Dochi",
  },
};

function DochiJourney({ label }) {
  return <div className="dochi-journey is-running" aria-hidden="true">
    <div className="dochi-journey__route-grid" />
    <div className="dochi-journey__runner dochi-journey__runner--crossing"><DochiSprite pose="run" direction="right" /></div>
    <div className="dochi-journey__runner dochi-journey__runner--delivery"><DochiSprite pose="delivery" direction="left" /><DochiChartBundle /></div>
    <p>{label}</p>
  </div>;
}

export default function DochiAssistant({ locale = "ko" }) {
  const copy = COPY[locale] || COPY.ko;
  const startMyData = useAppStore((state) => state.startMyData);
  const csvData = useAppStore((state) => state.csvData);
  const [phase, setPhase] = useState("welcome");
  const timersRef = useRef([]);
  const resultsRef = useRef(null);

  useEffect(() => {
    const timers = timersRef.current;
    startMyData();
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [startMyData]);

  useEffect(() => {
    if (phase !== "results") return undefined;
    const frame = window.requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ block: "start" }));
    return () => window.cancelAnimationFrame(frame);
  }, [phase]);

  const beginImport = () => setPhase("importing");
  const showMapping = () => setPhase("mapping");
  const recoverFromImportFailure = () => setPhase("welcome");
  const beginJourney = () => {
    const hasReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    setPhase("running");
    const timer = window.setTimeout(() => setPhase("results"), hasReducedMotion ? 0 : 1850);
    timersRef.current.push(timer);
  };
  const getTitle = (toolId) => {
    const meta = IA.flatMap((group) => group.items).find((item) => item.id === toolId);
    return meta ? trItemTitle(toolId, locale, meta.title) : toolId;
  };

  if (phase === "mapping") {
    return <section className="dochi-home-mapping" aria-labelledby="dochi-home-mapping-title">
      <header><span>DOCHI CHECK</span><h2 id="dochi-home-mapping-title">{copy.mappingTitle}</h2><p>{copy.mappingDeck}</p></header>
      <CsvUploader toolId="start-gate" locale={locale} showMappingReview showMappingCoach onPrepared={showMapping} onImportFailed={recoverFromImportFailure} onMappingReviewConfirmed={beginJourney} />
    </section>;
  }

  if (phase === "results") {
    return <section className="dochi-home-results" ref={resultsRef} aria-labelledby="dochi-home-results-title">
      <details open>
        <summary><span>DOCHI RESULTS</span><h2 id="dochi-home-results-title">{copy.results}</h2><i>{locale === "en" ? "Collapse" : "접기"}</i></summary>
        <p>{copy.resultsDeck}</p>
        <AssistantWorkspace csvData={csvData} locale={locale} getTitle={getTitle} autoStart presentation="embedded" />
      </details>
    </section>;
  }

  const status = phase === "importing" ? copy.importing : null;

  return (
    <section className="dochi-home-assistant" data-phase={phase} aria-label={copy.label}>
      <div className="dochi-home-assistant__speech" aria-live="polite">
        <p className="dochi-home-assistant__hello">{copy.greeting}</p>
        <p>{status || copy.prompt}</p>
        <CsvUploader toolId="start-gate" locale={locale} entryVariant="dochi" sheetInitiallyOpen onImportStart={beginImport} onPrepared={showMapping} onImportFailed={recoverFromImportFailure} />
        <small>{copy.privacy}</small>
      </div>
      <div className="dochi-home-assistant__stage" aria-hidden="true"><DochiSprite /></div>
      {phase === "running" && <DochiJourney label={copy.running} />}
      <h2 className="sr-only">{copy.heading}</h2>
    </section>
  );
}
