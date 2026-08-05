"use client";
import React, { useEffect, useMemo } from "react";
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
import { buildDemoCsv } from "@/utils/demoData";

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
    title: "CSV나 Google Sheets를 가져오세요",
    deck: "업로드한 데이터 구조를 브라우저 안에서 확인한 뒤, 현재 컬럼으로 가능한 분석과 가장 먼저 볼 질문을 추천합니다.",
    demoLink: "예시 데이터로 둘러보기",
    open: "이 분석 시작 →",
    browseAll: "데이터 없이 전체 도구부터 둘러보기",
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
    title: "Bring a CSV or Google Sheet",
    deck: "We inspect its structure in your browser, then recommend the analyses and first questions your current columns can support.",
    demoLink: "Explore example data",
    open: "Start this →",
    browseAll: "Browse every tool without data",
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
  const setDemoDisabled = useAppStore((s) => s.setDemoDisabled);
  const startMyData = useAppStore((s) => s.startMyData);
  const csvData = useAppStore((s) => s.csvData);
  const handoffCsvToRoute = useAppStore((s) => s.handoffCsvToRoute);

  // 진입 = 내 데이터 의도 → 데모 자동로드 억제 + 이미 로드된 데모 슬라이스 비움.
  useEffect(() => {
    startMyData();
  }, [startMyData]);

  const groups = IA.filter((g) => OPS_GROUP_IDS.has(g.id) && g.id !== DATA_GUIDE_GROUP);
  const goTool = (id) => router.push(locale === "en" && hasEnVersion(id) ? `/en${idToSlug[id] || ""}` : idToSlug[id] || "/");
  const goDemo = () => {
    setDemoDisabled(false);
    handoffCsvToRoute("5-2", buildDemoCsv("efficiency", locale));
    trackProductEvent("example_run_started", {
      tool_id: "5-2",
      source: "start",
      placement: "after_upload_entry",
      locale,
    });
    router.push(locale === "en" ? "/en/dashboard" : "/dashboard");
  };
  const diagnosis = useMemo(() => buildRouterDiagnosis({ canonicalData: csvData.canonicalData, mapping: csvData.mapping, locale }), [csvData.mapping, csvData.canonicalData, locale]);
  const eligibility = useMemo(() => ROUTER_TOOL_IDS.map((toolId) => evaluateEligibility({ toolId, mapping: csvData.mapping, canonicalData: csvData.canonicalData, diagnosis, locale })), [csvData.mapping, csvData.canonicalData, diagnosis, locale]);
  const recommended = rankRecommendedAnalyses(eligibility);
  const hasPreparedData = Boolean(csvData.canonicalData?.records?.length);
  const getTitle = (id) => {
    const meta = IA.flatMap((group) => group.items).find((item) => item.id === id);
    return meta ? trItemTitle(id, locale, meta.title) : id;
  };
  const openRecommended = (id) => {
    trackProductEvent("analysis_recommended", { tool_id: id, source: "start" });
    const prepared = prepareDatasetForTool({ raw: csvData.raw, headers: csvData.headers, toolId: id, source: csvData.fileName || "dataset" });
    handoffCsvToRoute(id, prepared);
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
            <AnalysisEligibilityList
              results={[...recommended, ...eligibility.filter((item) => !recommended.includes(item))]}
              getTitle={getTitle}
              onOpen={openRecommended}
              locale={locale}
              provisional
            />
          ) : null}
        />
      </section>

      <section className="start-direct-actions" aria-labelledby="start-direct-title">
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
        <button type="button" onClick={goDemo} className="start-demo-link">
          {C.demoLink} <span aria-hidden="true">→</span>
        </button>
      </section>

      {!hasPreparedData && <details className="start-tool-browser">
        <summary>{C.browseAll}</summary>
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
                onClick={(e) => { e.preventDefault(); goTool(it.id); }}
                style={{ cursor: "pointer", textDecoration: "none" }}
              >
                <div className="phase-card-title">{trItemTitle(it.id, locale, it.title)}</div>
                {it.desc && <div className="phase-card-desc">{it.desc}</div>}
                <div className="phase-card-cta">{C.open}</div>
              </a>
            ))}
          </div>
        </section>
        ))}
      </details>}
    </>
  );
}
