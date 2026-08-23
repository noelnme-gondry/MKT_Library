"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import CsvUploader from "@/components/CsvUploader";
import { DOCHI_HANDOFF_KEY, DochiChartBundle } from "@/components/assistant/DochiHandoffMotion";
import DochiSprite from "@/components/assistant/DochiSprite";
import { useAppStore } from "@/store/useDataStore";

const COPY = {
  ko: {
    label: "도치 박사 데이터 접수처",
    greeting: "안녕하세요, 도치 박사예요!",
    prompt: "가지고 계신 CSV 파일 또는 전체 공개 스프레드시트 주소 하나만 주시면, 지금 가능한 분석을 전부 찾아올게요. 가능한 요약과 차트는 작업대에 가져오고, 고급 설정이 필요한 분석은 상세 화면으로 안내해 드려요!",
    privacy: "파일과 시트 데이터는 브라우저 안에서만 읽습니다.",
    reading: "좋아요. 파일을 들고 분석 가능한 도구를 찾으러 가는 중이에요.",
    sorting: "데이터를 읽었어요. 찾은 분석과 차트 화면을 작업대에 내려놓을게요.",
    heading: "도치에게 데이터 맡기기",
  },
  en: {
    label: "Dochi, data intake guide",
    greeting: "Hi, I’m Dochi!",
    prompt: "Give me a CSV file or one publicly shared spreadsheet link, and I’ll find every analysis it can support. I’ll bring every available summary and chart onto the workspace, then guide advanced analyses to their detailed views.",
    privacy: "Files and sheet data are read only in your browser.",
    reading: "Great. I’m carrying the file across the workspace to find the analyses it supports.",
    sorting: "The data is ready. I’m bringing the analysis map and chart views onto the workspace.",
    heading: "Give your data to Dochi",
  },
};

function DochiJourney({ phase }) {
  return <div className={`dochi-journey is-${phase}`} aria-hidden="true">
    <div className="dochi-journey__route-grid" />
    <div className="dochi-journey__runner dochi-journey__runner--left"><DochiSprite pose="run" direction="left" /></div>
    <div className="dochi-journey__runner dochi-journey__runner--back"><DochiSprite pose="back" /></div>
    <div className="dochi-journey__runner dochi-journey__runner--right"><DochiSprite pose="run" direction="right" /></div>
    <div className="dochi-journey__runner dochi-journey__runner--delivery"><DochiSprite pose="delivery" direction="left" /><DochiChartBundle /></div>
    <div className="dochi-journey__runner dochi-journey__runner--results"><DochiSprite pose="results" /></div>
    <div className="dochi-journey__curtain" />
  </div>;
}

export default function DochiAssistant({ locale = "ko" }) {
  const copy = COPY[locale] || COPY.ko;
  const router = useRouter();
  const startMyData = useAppStore((state) => state.startMyData);
  const [phase, setPhase] = useState("welcome");
  const journeyStartedRef = useRef(0);
  const timersRef = useRef([]);

  useEffect(() => {
    const timers = timersRef.current;
    startMyData();
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [startMyData]);

  const beginReading = () => {
    journeyStartedRef.current = Date.now();
    setPhase("reading");
  };
  const recoverFromImportFailure = () => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
    journeyStartedRef.current = 0;
    setPhase("welcome");
  };
  const finishReading = () => {
    const elapsed = Date.now() - journeyStartedRef.current;
    const hasReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const finishJourney = window.setTimeout(() => {
      setPhase("sorting");
      const openWorkspace = window.setTimeout(() => {
        try {
          window.sessionStorage.setItem(DOCHI_HANDOFF_KEY, JSON.stringify({ locale, startedAt: Date.now() }));
        } catch {
          // sessionStorage를 막은 브라우저에서도 분석 진입 자체는 계속한다.
        }
        router.push(locale === "en" ? "/en/start" : "/start");
      }, hasReducedMotion ? 100 : 1450);
      timersRef.current.push(openWorkspace);
    }, hasReducedMotion ? 0 : Math.max(0, 3200 - elapsed));
    timersRef.current.push(finishJourney);
  };
  const status = phase === "reading" ? copy.reading : phase === "sorting" ? copy.sorting : null;

  return (
    <section className="dochi-home-assistant" data-phase={phase} aria-label={copy.label}>
      <div className="dochi-home-assistant__speech" aria-live="polite">
        <p className="dochi-home-assistant__hello">{copy.greeting}</p>
        <p>{status || copy.prompt}</p>
        <div hidden={phase === "sorting"}>
          <CsvUploader toolId="start-gate" locale={locale} entryVariant="dochi" sheetInitiallyOpen onImportStart={beginReading} onPrepared={finishReading} onImportFailed={recoverFromImportFailure} />
        </div>
        <small>{copy.privacy}</small>
      </div>
      {phase === "welcome" ? <div className="dochi-home-assistant__stage" aria-hidden="true"><DochiSprite /></div> : <DochiJourney phase={phase} />}
      <h2 className="sr-only">{copy.heading}</h2>
    </section>
  );
}
