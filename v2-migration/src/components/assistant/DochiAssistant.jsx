"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import CsvUploader from "@/components/CsvUploader";
import DochiSprite from "@/components/assistant/DochiSprite";
import { useAppStore } from "@/store/useDataStore";

const COPY = {
  ko: {
    label: "도치 박사 데이터 접수처",
    greeting: "안녕하세요, 도치예요.",
    prompt: "CSV 하나를 올려 주세요. 읽고 바로 결과를 가져올게요.",
    privacy: "데이터는 브라우저 안에서만 읽습니다.",
    importing: "파일을 읽고 있어요.",
    heading: "도치에게 데이터 맡기기",
    savedPrompt: (count) => `이 기기에 저장된 작업 ${count}개를 찾았어요. 이어서 보거나 새 CSV를 올릴 수 있어요.`,
    resume: "저장된 분석 이어보기",
  },
  en: {
    label: "Dochi, data intake guide",
    greeting: "Hi, I’m Dochi.",
    prompt: "Upload one CSV. I’ll read it and bring back the results.",
    privacy: "Your data is read only in this browser.",
    importing: "Reading your file.",
    heading: "Give your data to Dochi",
    savedPrompt: (count) => `I found ${count} saved dataset${count === 1 ? "" : "s"} on this device. Continue one or upload a new CSV.`,
    resume: "Continue a saved analysis",
  },
};

export default function DochiAssistant({ locale = "ko" }) {
  const copy = COPY[locale] || COPY.ko;
  const router = useRouter();
  const startMyData = useAppStore((state) => state.startMyData);
  const savedDatasets = useAppStore((state) => state.workspaceDatasetSummaries);
  const [phase, setPhase] = useState("welcome");

  useEffect(() => {
    startMyData();
  }, [startMyData]);

  const beginImport = () => setPhase("importing");
  const openResultWorkspace = () => {
    setPhase("welcome");
    router.push(locale === "en" ? "/en/dochi-result" : "/dochi-result");
  };
  const recoverFromImportFailure = () => setPhase("welcome");
  const status = phase === "importing"
    ? copy.importing
    : savedDatasets.length
      ? copy.savedPrompt(savedDatasets.length)
      : null;

  return (
    <section className="dochi-home-assistant" data-phase={phase} aria-label={copy.label}>
      <div className="dochi-home-assistant__speech" aria-live="polite">
        <p className="dochi-home-assistant__hello">{copy.greeting}</p>
        <p>{status || copy.prompt}</p>
        {phase !== "importing" && savedDatasets.length > 0 && <button type="button" className="dochi-home-assistant__resume" onClick={() => router.push(locale === "en" ? "/en/storage" : "/storage")}>{copy.resume} →</button>}
        <CsvUploader toolId="start-gate" locale={locale} entryVariant="dochi" sheetInitiallyOpen onImportStart={beginImport} onPrepared={openResultWorkspace} onImportFailed={recoverFromImportFailure} />
        <small>{copy.privacy}</small>
        <span className="dochi-home-assistant__speech-tail" aria-hidden="true">
          <svg viewBox="0 0 54 40" preserveAspectRatio="none"><path d="M0 1L52 20L0 39Z" /></svg>
        </span>
      </div>
      <div className="dochi-home-assistant__stage" aria-hidden="true"><DochiSprite /></div>
      <h2 className="sr-only">{copy.heading}</h2>
    </section>
  );
}
