"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import DecisionDataUpdateGuide from "@/components/ds/DecisionDataUpdateGuide";
import { buildDatasetContinuitySnapshot, classifyDatasetContinuity, readDatasetContinuitySnapshot } from "@/lib/dataContinuity";
import { groupForRoute } from "@/lib/toolGroups";

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
  const decisionRecords = useAppStore((s) => s.decisionRecords);
  const handoffCsvToRoute = useAppStore((s) => s.handoffCsvToRoute);
  const [isDochiArrival, setIsDochiArrival] = useState(false);
  const [mappingCoachPhase, setMappingCoachPhase] = useState("hidden");
  const [eligibilitySnapshot, setEligibilitySnapshot] = useState(null);
  const mappingCoachTimerRef = useRef(null);
  const workspaceRef = useRef(null);

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
  // 사용자가 비교 방식이나 데이터 상태를 다시 판정할 필요 없도록, 같은 데이터
  // 그룹에서 가장 최근에 저장한 판단 하나를 현재 업로드와 먼저 대조한다. 원본 행은
  // 결정 기록에 남지 않으며, 이 비교도 날짜 범위와 비가역 지문만 사용한다.
  const continuity = useMemo(() => {
    if (!hasPreparedData) return null;
    const group = groupForRoute("start-gate");
    const previousRecord = [...decisionRecords]
      .filter((record) => readDatasetContinuitySnapshot(record.datasetSnapshot)?.dataGroup === group)
      .sort((left, right) => Date.parse(right.updatedAt || right.createdAt || 0) - Date.parse(left.updatedAt || left.createdAt || 0))[0];
    if (!previousRecord) return null;
    const current = buildDatasetContinuitySnapshot(csvData.canonicalData, { dataGroup: group, mapping: csvData.mapping });
    return classifyDatasetContinuity(previousRecord.datasetSnapshot, current);
  }, [csvData.canonicalData, csvData.mapping, decisionRecords, hasPreparedData]);
  // 업로드 뒤의 도구 목록은 도치 작업대와 같은 자격 판정을 쓴다. 이전 파일의
  // 판정이 새 파일 위에 잠깐 남으면 "지금 가능"이라는 약속이 거짓이 되므로,
  // 원본·헤더·매핑 참조가 모두 같은 판정만 표시한다.
  const isEligibilityCurrent = hasPreparedData
    && eligibilitySnapshot?.raw === csvData.raw
    && eligibilitySnapshot?.headers === csvData.headers
    && eligibilitySnapshot?.mapping === csvData.mapping;
  const eligibleIds = isEligibilityCurrent
    ? eligibilitySnapshot.ids
    : hasPreparedData ? [] : null;
  const rememberEligibility = useCallback((eligibility) => {
    setEligibilitySnapshot({
      raw: csvData.raw,
      headers: csvData.headers,
      mapping: csvData.mapping,
      ids: eligibility.filter((result) => result.status !== "blocked").map((result) => result.toolId),
    });
  }, [csvData.headers, csvData.mapping, csvData.raw]);
  const getTitle = (id) => {
    const meta = IA.flatMap((group) => group.items).find((item) => item.id === id);
    return meta ? trItemTitle(id, locale, meta.title) : id;
  };
  const openRecommended = (id, preparedOverride = null) => {
    trackProductEvent("analysis_recommended", { tool_id: id, source: "start" });
    const prepared = preparedOverride || prepareDatasetForTool({ raw: csvData.raw, headers: csvData.headers, toolId: id, source: csvData.fileName || "dataset" });
    // 추천·자격 통과 도구는 도치 독과 같은 분석 완료 상태로 연다. 반대로 목록에
    // 흐리게 보이는 도구까지 완료 처리하면 부족한 컬럼인데도 기본 결과·결정 기록이
    // 열릴 수 있으므로, 그 경우에는 상세 화면의 정직한 업로드 게이트를 유지한다.
    handoffCsvToRoute(id, prepared, { markAnalyzed: Boolean(isEligibilityCurrent && eligibleIds.includes(id)) });
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
  const continueWithNewAnalysis = () => workspaceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

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
            <>
              <DecisionDataUpdateGuide continuity={continuity} locale={locale} onContinue={continueWithNewAnalysis} />
              <div ref={workspaceRef}>
                <AssistantWorkspace csvData={csvData} locale={locale} getTitle={getTitle} onOpenTool={openRecommended} onEligibilityChange={rememberEligibility} autoStart={isDochiArrival || mappingCoachPhase !== "hidden"} />
              </div>
            </>
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
          eligibleIds={eligibleIds}
          onSelect={(toolId) => (hasPreparedData ? openRecommended(toolId) : goTool(toolId))}
        />
      </section>
    </>
  );
}
