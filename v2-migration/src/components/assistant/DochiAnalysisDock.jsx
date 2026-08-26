"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import BrandMark from "@/components/BrandMark";
import { toolIndexEntry } from "@/lib/toolIndex";
import { idToPath } from "@/lib/routeMap";
import { useAppStore } from "@/store/useDataStore";
import { getDecisionReviewBucket } from "@/lib/decisionReview";

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
    hub: "도치 결과함 전체 보기",
    current: "지금 보는 분석",
    pending: (count) => `이 분석의 검토 대기 ${count}건`,
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
    hub: "Open all Dochi results",
    current: "Current analysis",
    pending: (count) => `${count} pending review${count === 1 ? "" : "s"} from this analysis`,
  },
};

export default function DochiAnalysisDock({ locale = "ko" }) {
  const C = COPY[locale] || COPY.ko;
  const router = useRouter();
  const session = useAppStore((state) => state.dochiAnalysisSession);
  const currentRouteId = useAppStore((state) => state.currentRouteId);
  const decisionRecords = useAppStore((state) => state.decisionRecords);
  const handoffCsvToRoute = useAppStore((state) => state.handoffCsvToRoute);
  const [isOpen, setIsOpen] = useState(false);
  const [preparingToolId, setPreparingToolId] = useState(null);
  const analyses = session?.analyses || [];
  const currentAnalysis = analyses.find((analysis) => analysis.toolId === currentRouteId);
  const pendingForCurrent = currentAnalysis
    ? decisionRecords.filter((record) => record.toolId === currentRouteId && getDecisionReviewBucket(record) !== "reviewed").length
    : 0;

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
      {currentAnalysis && <div className="dochi-analysis-dock__context">
        <span>{C.current}</span>
        <strong>{toolIndexEntry(currentRouteId, locale)?.name || currentRouteId}</strong>
        <small>{C.pending(pendingForCurrent)}</small>
      </div>}
      <button type="button" className="dochi-analysis-dock__hub" onClick={() => router.push(locale === "en" ? "/en/dochi-result" : "/dochi-result")}>{C.hub} →</button>
      <ul>
        {analyses.map((analysis) => {
          const entry = toolIndexEntry(analysis.toolId, locale);
          return <li key={analysis.toolId}>
            <button type="button" aria-current={analysis.toolId === currentRouteId ? "page" : undefined} onClick={() => openTool(analysis.toolId)} disabled={Boolean(preparingToolId)}>
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
