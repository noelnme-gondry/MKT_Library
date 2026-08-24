"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import BrandMark from "@/components/BrandMark";
import { toolIndexEntry } from "@/lib/toolIndex";
import { idToPath } from "@/lib/routeMap";
import { useAppStore } from "@/store/useDataStore";

const COPY = {
  ko: {
    trigger: "도치가 기억한 분석 열기",
    title: "도치가 기억한 분석",
    deck: "처음 확인한 CSV와 매핑을 그대로 사용합니다.",
    ready: "바로 보기",
    confirm_model: "모델 확인",
    confirm_design: "설계 확인",
    manual: "수동 설정",
    preparing: "도치가 자료를 꺼내고 있어요…",
  },
  en: {
    trigger: "Open analyses Dochi remembers",
    title: "Analyses Dochi remembers",
    deck: "Your original CSV and mapping stay with this session.",
    ready: "Open now",
    confirm_model: "Confirm model",
    confirm_design: "Confirm design",
    manual: "Manual setup",
    preparing: "Dochi is bringing your data over…",
  },
};

export default function DochiAnalysisDock({ locale = "ko" }) {
  const C = COPY[locale] || COPY.ko;
  const router = useRouter();
  const session = useAppStore((state) => state.dochiAnalysisSession);
  const handoffCsvToRoute = useAppStore((state) => state.handoffCsvToRoute);
  const [isOpen, setIsOpen] = useState(false);
  const [preparingToolId, setPreparingToolId] = useState(null);
  const analyses = session?.analyses || [];

  if (!session?.sourceData?.raw?.length || !analyses.length) return null;

  const openTool = (toolId) => {
    if (preparingToolId) return;
    setPreparingToolId(toolId);
    window.requestAnimationFrame(() => window.requestAnimationFrame(async () => {
      const { prepareAnalysisHandoff } = await import("@/lib/assistant/prepareAnalysisHandoff");
      const prepared = prepareAnalysisHandoff(session.sourceData, toolId);
      handoffCsvToRoute(toolId, prepared);
      router.push(locale === "en" ? `/en${idToPath(toolId)}` : idToPath(toolId));
    }));
  };

  return <aside className={`dochi-analysis-dock${isOpen ? " is-open" : ""}`} aria-label={C.title}>
    {isOpen && <section className="dochi-analysis-dock__panel" aria-label={C.title}>
      <header>
        <div><span>DOCHI</span><strong>{C.title}</strong></div>
        <small>{session.sourceData.fileName}</small>
      </header>
      <p>{C.deck}</p>
      <ul>
        {analyses.map((analysis) => {
          const entry = toolIndexEntry(analysis.toolId, locale);
          return <li key={analysis.toolId}>
            <button type="button" onClick={() => openTool(analysis.toolId)} disabled={Boolean(preparingToolId)}>
              <span><b>{entry?.name || analysis.toolId}</b><small>{entry?.question || analysis.recommendationReason}</small></span>
              <em>{preparingToolId === analysis.toolId ? C.preparing : C[analysis.status]}</em>
            </button>
          </li>;
        })}
      </ul>
    </section>}
    <button type="button" className="dochi-analysis-dock__trigger" aria-expanded={isOpen} aria-label={C.trigger} onClick={() => setIsOpen((value) => !value)}>
      <BrandMark size={58} className="dochi-analysis-dock__icon" />
      <span>{analyses.length}</span>
    </button>
  </aside>;
}
