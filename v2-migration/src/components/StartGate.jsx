"use client";
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IA, SECTIONS } from "@/store/useDataStore";
import { idToSlug, hasEnVersion } from "@/lib/routeMap";
import { trItemTitle, trGroupTitle } from "@/lib/enNavCopy";
import { useAppStore } from "@/store/useDataStore";
import CsvUploader from "@/components/CsvUploader";
import { trackProductEvent } from "@/lib/analytics";
import { prepareDatasetForTool } from "@/lib/data-import/prepareDatasetForTool";
import ToolIndex from "@/components/ds/ToolIndex";
import AssistantWorkspace from "@/components/assistant/AssistantWorkspace";
import { DOCHI_HANDOFF_KEY, DochiArrivalTransition } from "@/components/assistant/DochiHandoffMotion";

// "내 데이터로 분석 시작" 진입 게이트 — 데모 없이 어떤 분석부터 할지 고르는 페이지.
// 진입 시 demoDisabled=true(세션) → 어느 도구로 가도 데모 자동로드 없이 빈 업로드
// 화면. "예시부터 둘러보기"를 고르면 demoDisabled=false로 되돌리고 대시보드 데모로.
const ANALYSIS_SECTION = SECTIONS.find((s) => s.id === "analysis");
const OPS_GROUP_IDS = new Set(ANALYSIS_SECTION ? ANALYSIS_SECTION.groups : []);
const DATA_GUIDE_GROUP = "08";
const COPY = {
  ko: {
    eyebrow: "내 데이터 분석",
    title: "데이터를 올리면 첫 분석을 골라드립니다",
    deck: "CSV나 Google Sheets의 컬럼과 기간을 브라우저에서 확인해 지금 실행 가능한 분석만 보여줍니다. 도구를 미리 고를 필요 없습니다.",
    open: "이 분석 시작 →",
    indexTitle: "할 수 있는 분석 전체",
    indexDeck: "판단 단계별로 묶었습니다. 필요한 데이터가 무엇인지도 함께 적혀 있어요.",
    indexDeckWithData: "올리신 파일로 지금 바로 되는 분석을 진하게 표시했습니다. 흐린 것은 컬럼이 더 필요합니다.",
    directEyebrow: "파일 없이 바로",
    directTitle: "업로드하지 않고 시작할 수 있는 작업",
    calculatorTitle: "마케팅 지표 계산기",
    calculatorDesc: "LTV:CAC·ROAS·CPA·A/B 표본수를 숫자만 입력해 계산합니다.",
    calculatorCta: "지표 바로 계산",
    diagnoseLabel: "성과 문제 진단",
    diagnoseDesc: "세 가지 질문으로 원인 후보와 먼저 확인할 분석을 찾습니다.",
    diagnoseCta: "성과 문제 진단",
    brandTitle: "브랜딩 성과 측정",
    brandDesc: "대조군·일별 시계열·전후 데이터 중 준비된 수준에 맞춰 증분 측정 방식을 고릅니다.",
    brandCta: "브랜드 증분 분석",
  },
  en: {
    eyebrow: "Analyze my data",
    title: "Upload data. Get the right first analysis.",
    deck: "We inspect CSV or Google Sheets columns and date coverage in your browser, then show only the analyses you can run now. You do not need to choose a tool first.",
    open: "Start this →",
    indexTitle: "Every analysis you can run",
    indexDeck: "Grouped by the decision each one supports, with the columns it needs.",
    indexDeckWithData: "Analyses your file can run right now are shown in full; dimmed ones need more columns.",
    directEyebrow: "START WITHOUT A FILE",
    directTitle: "Tasks you can run without uploading data",
    calculatorTitle: "Marketing metric calculators",
    calculatorDesc: "Calculate LTV:CAC, ROAS, CPA, and A/B sample size from a few numbers.",
    calculatorCta: "Calculate a metric",
    diagnoseLabel: "Diagnose performance",
    diagnoseDesc: "Use three questions to find likely causes and the first analysis to check.",
    diagnoseCta: "Diagnose performance",
    brandTitle: "Measure brand-campaign lift",
    brandDesc: "Choose an incrementality design based on whether you have a control group, dated series, or only before/after data.",
    brandCta: "Analyze brand lift",
  },
};

export default function StartGate({ locale = "ko" }) {
  const C = COPY[locale] || COPY.ko;
  const router = useRouter();
  const startMyData = useAppStore((s) => s.startMyData);
  const csvData = useAppStore((s) => s.csvData);
  const handoffCsvToRoute = useAppStore((s) => s.handoffCsvToRoute);
  const [isDochiArrival, setIsDochiArrival] = useState(false);
  const [mappingCoachPhase, setMappingCoachPhase] = useState("hidden");
  const mappingCoachTimerRef = useRef(null);

  // 진입 = 내 데이터 의도 → 데모 자동로드 억제 + 이미 로드된 데모 슬라이스 비움.
  useEffect(() => {
    startMyData();
    let beginTimer;
    let timer;
    try {
      const handoff = JSON.parse(window.sessionStorage.getItem(DOCHI_HANDOFF_KEY) || "null");
      const isRecent = handoff?.startedAt && Date.now() - handoff.startedAt < 15000;
      const hasReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (isRecent) {
        beginTimer = window.setTimeout(() => {
          window.sessionStorage.removeItem(DOCHI_HANDOFF_KEY);
          if (hasReducedMotion) {
            setMappingCoachPhase("showing");
            return;
          }
          setIsDochiArrival(true);
          timer = window.setTimeout(() => {
            setIsDochiArrival(false);
            setMappingCoachPhase("showing");
          }, 1500);
        }, 0);
      } else {
        window.sessionStorage.removeItem(DOCHI_HANDOFF_KEY);
      }
    } catch {
      // 저장소 접근이 막혀도 일반 /start 진입은 그대로 유지한다.
    }
    return () => {
      window.clearTimeout(beginTimer);
      window.clearTimeout(timer);
      window.clearTimeout(mappingCoachTimerRef.current);
    };
  }, [startMyData]);

  const groups = IA.filter((g) => OPS_GROUP_IDS.has(g.id) && g.id !== DATA_GUIDE_GROUP);
  const goTool = (id) => router.push(locale === "en" && hasEnVersion(id) ? `/en${idToSlug[id] || ""}` : idToSlug[id] || "/");
  const hasPreparedData = Boolean(csvData.canonicalData?.records?.length);
  const getTitle = (id) => {
    const meta = IA.flatMap((group) => group.items).find((item) => item.id === id);
    return meta ? trItemTitle(id, locale, meta.title) : id;
  };
  const openRecommended = (id, preparedOverride = null) => {
    trackProductEvent("analysis_recommended", { tool_id: id, source: "start" });
    const prepared = preparedOverride || prepareDatasetForTool({ raw: csvData.raw, headers: csvData.headers, toolId: id, source: csvData.fileName || "dataset" });
    handoffCsvToRoute(id, prepared, { markAnalyzed: false });
    goTool(id);
  };
  const finishMappingReview = () => {
    setMappingCoachPhase("leaving");
    window.clearTimeout(mappingCoachTimerRef.current);
    mappingCoachTimerRef.current = window.setTimeout(() => setMappingCoachPhase("hidden"), 360);
  };
  const showMappingCoach = () => {
    window.clearTimeout(mappingCoachTimerRef.current);
    setMappingCoachPhase("showing");
  };

  return (
    <>
      <DochiArrivalTransition active={isDochiArrival} locale={locale} />
      <div className="page-eyebrow">{C.eyebrow}</div>
      <h1 className="page-title">{C.title}</h1>
      <p className="page-deck">{C.deck}</p>

      <section className="block start-upload-panel">
        <CsvUploader
          toolId="start-gate"
          locale={locale}
          showMappingReview
          collapseMappingReview
          showMappingCoach={mappingCoachPhase !== "hidden"}
          mappingCoachLeaving={mappingCoachPhase === "leaving"}
          onMappingReviewConfirmed={finishMappingReview}
          onPrepared={showMappingCoach}
          afterFileSummary={hasPreparedData ? (
            <AssistantWorkspace csvData={csvData} locale={locale} getTitle={getTitle} onOpenTool={openRecommended} autoStart={isDochiArrival || mappingCoachPhase !== "hidden"} />
          ) : null}
        />
      </section>

      {!hasPreparedData && <section className="start-direct-actions" aria-labelledby="start-direct-title">
        <header>
          <span>{C.directEyebrow}</span>
          <h2 id="start-direct-title">{C.directTitle}</h2>
        </header>
        <div className="start-direct-actions__grid">
          <Link
            href={locale === "en" ? "/en/calculator" : "/calculator"}
            onClick={() => trackProductEvent("calculator_entry_clicked", { source: "start", placement: "after_upload_entry", locale })}
          >
            <span>QUICK MATH</span><strong>{C.calculatorTitle}</strong><p>{C.calculatorDesc}</p><b>{C.calculatorCta} →</b>
          </Link>
          <Link
            href={locale === "en" ? "/en/diagnose" : "/diagnose"}
            onClick={() => trackProductEvent("diagnose_entry_clicked", { source: "start", placement: "after_upload_entry", locale })}
          >
            <span>ROOT CAUSE</span><strong>{C.diagnoseLabel}</strong><p>{C.diagnoseDesc}</p><b>{C.diagnoseCta} →</b>
          </Link>
          <Link href={locale === "en" ? "/en/tools/brand-campaign-incrementality" : "/tools/brand-campaign-incrementality"}>
            <span>BRAND LIFT</span><strong>{C.brandTitle}</strong><p>{C.brandDesc}</p><b>{C.brandCta} →</b>
          </Link>
        </div>
      </section>}

      {/* 도구 인덱스 — 예전에는 <details>로 접혀 있어서 "무엇을 할 수 있는지"가
          화면에 없었다. 항상 펴 두고 질문 단계로 묶는다. 지금 올린 CSV로 안 되는
          도구도 숨기지 않고 흐리게만 둔다(숨기면 존재 자체를 못 본다). */}
      <section className="block start-tool-index" aria-labelledby="start-tool-index-title">
        <h2 className="section-title" id="start-tool-index-title" style={{ margin: "0 0 4px", border: "none", padding: 0 }}>
          {C.indexTitle}
        </h2>
        <p className="muted" style={{ margin: "0 0 16px" }}>{hasPreparedData ? C.indexDeckWithData : C.indexDeck}</p>
        <ToolIndex
          locale={locale}
          density="full"
          eligibleIds={null}
          onSelect={(toolId) => (hasPreparedData ? openRecommended(toolId) : goTool(toolId))}
        />
      </section>
    </>
  );
}
