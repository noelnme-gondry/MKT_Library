"use client";
import React, { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IA, SECTIONS } from "@/store/useDataStore";
import { idToSlug, hasEnVersion } from "@/lib/routeMap";
import { trItemTitle, trGroupTitle } from "@/lib/enNavCopy";
import { useAppStore } from "@/store/useDataStore";
import CsvUploader from "@/components/CsvUploader";
import AnalysisEligibilityList from "@/components/data-import/AnalysisEligibilityList";
import { ANALYSIS_CONTRACTS, evaluateEligibility, rankRecommendedAnalyses } from "@/lib/analysis-router/evaluateEligibility";
import { trackProductEvent } from "@/lib/analytics";
import { prepareDatasetForTool } from "@/lib/data-import/prepareDatasetForTool";
import { buildRouterDiagnosis } from "@/lib/analysis-router/buildRouterDiagnosis";
import { CONNECTED_TOOLS } from "@/lib/toolConnections";

// "내 데이터로 분석 시작" 진입 게이트 — 데모 없이 어떤 분석부터 할지 고르는 페이지.
// 진입 시 demoDisabled=true(세션) → 어느 도구로 가도 데모 자동로드 없이 빈 업로드
// 화면. "예시부터 둘러보기"를 고르면 demoDisabled=false로 되돌리고 대시보드 데모로.
const ANALYSIS_SECTION = SECTIONS.find((s) => s.id === "analysis");
const OPS_GROUP_IDS = new Set(ANALYSIS_SECTION ? ANALYSIS_SECTION.groups : []);
const DATA_GUIDE_GROUP = "08";
// 증분 분석(5-23)은 대조군/전후/신규 켜기 중 어떤 설계인지 먼저 고르는 도구다.
// 공통 캠페인 CSV만 보고 "가능"으로 추정하면 거짓 추천이 되므로, 전용 진입에서만 연다.
const ROUTER_TOOL_IDS = Object.keys(ANALYSIS_CONTRACTS).filter((toolId) => toolId !== "5-23");

const COPY = {
  ko: {
    eyebrow: "내 데이터 분석",
    title: "데이터를 올리면 첫 분석을 골라드립니다",
    deck: "CSV나 Google Sheets의 컬럼과 기간을 브라우저에서 확인해 지금 실행 가능한 분석만 보여줍니다. 도구를 미리 고를 필요 없습니다.",
    open: "이 분석 시작 →",
    recommendationReady: "파일 확인이 끝났습니다. 추천 분석으로 초점을 옮겼습니다.",
    recommendationRegion: "추천 분석 결과",
    browseAll: "데이터 없이 전체 도구부터 둘러보기",
    browseAllWithData: "추천 대신 전체 도구 직접 찾기",
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
    recommendationReady: "File checks are complete. Focus moved to the recommended analyses.",
    recommendationRegion: "Recommended analysis results",
    browseAll: "Browse every tool without data",
    browseAllWithData: "Browse every tool instead",
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

  // 진입 = 내 데이터 의도 → 데모 자동로드 억제 + 이미 로드된 데모 슬라이스 비움.
  useEffect(() => {
    startMyData();
  }, [startMyData]);

  const groups = IA.filter((g) => OPS_GROUP_IDS.has(g.id) && g.id !== DATA_GUIDE_GROUP);
  const goTool = (id) => router.push(locale === "en" && hasEnVersion(id) ? `/en${idToSlug[id] || ""}` : idToSlug[id] || "/");
  const diagnosis = useMemo(() => buildRouterDiagnosis({ canonicalData: csvData.canonicalData, mapping: csvData.mapping, locale }), [csvData.mapping, csvData.canonicalData, locale]);
  // 시작 화면의 기본 매핑은 효율 CSV에 맞춰 좁혀져 있다. 검색어·소재처럼 다른
  // grain의 파일도 여기서 놓치지 않도록, 후보 도구별로 원본 파일을 다시 매핑해
  // 가능 여부를 판정한다. 실제 열기 경로도 같은 prepareDatasetForTool을 쓴다.
  const eligibility = useMemo(() => ROUTER_TOOL_IDS.map((toolId) => {
    const prepared = prepareDatasetForTool({ raw: csvData.raw, headers: csvData.headers, toolId, source: csvData.fileName || "dataset" });
    return evaluateEligibility({ toolId, mapping: prepared.mapping, canonicalData: prepared.canonicalData, diagnosis, locale, mappingContract: prepared.mappingContract });
  }), [csvData.raw, csvData.headers, csvData.fileName, diagnosis, locale]);
  const recommended = rankRecommendedAnalyses(eligibility);
  const hasPreparedData = Boolean(csvData.canonicalData?.records?.length);
  const recommendationsRef = useRef(null);
  const hadPreparedDataRef = useRef(hasPreparedData);

  // 업로드·샘플 로드가 끝났는데 추천 결과가 첫 화면 아래에 생기면 버튼이 반응하지
  // 않은 것처럼 보인다. 새 데이터가 준비된 순간에만 결과 시작점으로 이동하고,
  // 이미 데이터가 있는 페이지 재진입에서는 사용자의 스크롤을 건드리지 않는다.
  useEffect(() => {
    const didPrepareNow = !hadPreparedDataRef.current && hasPreparedData;
    hadPreparedDataRef.current = hasPreparedData;
    if (!didPrepareNow) return undefined;
    const frame = window.requestAnimationFrame(() => {
      const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
      recommendationsRef.current?.scrollIntoView?.({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      recommendationsRef.current?.focus?.({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [hasPreparedData]);
  const getTitle = (id) => {
    const meta = IA.flatMap((group) => group.items).find((item) => item.id === id);
    return meta ? trItemTitle(id, locale, meta.title) : id;
  };
  const openRecommended = (id) => {
    trackProductEvent("analysis_recommended", { tool_id: id, source: "start" });
    const prepared = prepareDatasetForTool({ raw: csvData.raw, headers: csvData.headers, toolId: id, source: csvData.fileName || "dataset" });
    const eligibilityResult = eligibility.find((result) => result.toolId === id);
    const isEligible = Boolean(eligibilityResult && eligibilityResult.status !== "blocked");
    handoffCsvToRoute(id, prepared, { markAnalyzed: isEligible });
    goTool(id);
  };

  return (
    <>
      <div className="page-eyebrow">{C.eyebrow}</div>
      <h1 className="page-title">{C.title}</h1>
      <p className="page-deck">{C.deck}</p>

      <section className="block start-upload-panel">
        <CsvUploader
          toolId="start-gate"
          locale={locale}
          afterFileSummary={hasPreparedData ? (
            <>
              <span className="sr-only" role="status">{C.recommendationReady}</span>
              <div ref={recommendationsRef} className="start-recommendation-anchor" role="region" aria-label={C.recommendationRegion} tabIndex="-1">
              <AnalysisEligibilityList
                results={[...recommended, ...eligibility.filter((item) => !recommended.includes(item))]}
                getTitle={getTitle}
                onOpen={openRecommended}
                locale={locale}
                provisional
              />
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

      <details className="start-tool-browser">
        <summary>{hasPreparedData ? C.browseAllWithData : C.browseAll}</summary>
        {groups.map((g) => (
        <section key={g.id} className="block">
          <h2 className="section-title" style={{ margin: "0 0 10px", border: "none", padding: 0 }}>
            {trGroupTitle(g.id, locale, g.title)}
          </h2>
          <div className="phase-grid">
            {g.items.filter((it) => !it.hidden).map((it) => (
              <a
                key={it.id}
                href="#"
                className="phase-card phase-card-tool"
                onClick={(e) => { e.preventDefault(); hasPreparedData ? openRecommended(it.id) : goTool(it.id); }}
                style={{ cursor: "pointer", textDecoration: "none" }}
              >
                <div className="phase-card-title">{trItemTitle(it.id, locale, it.title)}</div>
                {(locale === "en" ? CONNECTED_TOOLS[it.id]?.question?.en : it.desc) && <div className="phase-card-desc">{locale === "en" ? CONNECTED_TOOLS[it.id]?.question?.en : it.desc}</div>}
                <div className="phase-card-cta">{C.open}</div>
              </a>
            ))}
          </div>
        </section>
        ))}
      </details>
    </>
  );
}
