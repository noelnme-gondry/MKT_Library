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

// "내 데이터로 분석 시작" 진입 게이트 — 데모 없이 어떤 분석부터 할지 고르는 페이지.
// 진입 시 demoDisabled=true(세션) → 어느 도구로 가도 데모 자동로드 없이 빈 업로드
// 화면. "예시부터 둘러보기"를 고르면 demoDisabled=false로 되돌리고 대시보드 데모로.
const ANALYSIS_SECTION = SECTIONS.find((s) => s.id === "analysis");
const OPS_GROUP_IDS = new Set(ANALYSIS_SECTION ? ANALYSIS_SECTION.groups : []);
const DATA_GUIDE_GROUP = "08";
const ROUTER_TOOL_IDS = Object.keys(ANALYSIS_CONTRACTS);

const COPY = {
  ko: {
    eyebrow: "내 데이터로 시작",
    title: "데이터부터 살펴볼게요",
    deck: "사용 중인 CSV 또는 Google Sheets를 그대로 가져오세요. 먼저 데이터 구조를 진단한 뒤 가능한 분석을 추천합니다.",
    demoLink: "먼저 예시(데모)로 둘러볼래요 →",
    open: "이 분석 시작 →",
    browseAll: "데이터 없이 전체 도구부터 둘러보기",
    diagnoseLabel: "CSV보다 문제부터 정리하고 싶나요?",
    diagnoseDesc: "세 가지 질문으로 먼저 확인할 분석 하나를 찾습니다.",
    diagnoseCta: "성과 문제 진단",
  },
  en: {
    eyebrow: "Start with your data",
    title: "Let’s understand your data first",
    deck: "Bring your CSV or Google Sheet as-is. We’ll profile it first, then recommend analyses that fit.",
    demoLink: "I'd rather browse the demo first →",
    open: "Start this →",
    browseAll: "Browse every tool without data",
    diagnoseLabel: "Want to frame the problem before uploading a CSV?",
    diagnoseDesc: "Use three questions to find the first analysis to check.",
    diagnoseCta: "Diagnose performance",
  },
};

export default function StartGate({ locale = "ko" }) {
  const C = COPY[locale] || COPY.ko;
  const router = useRouter();
  const setDemoDisabled = useAppStore((s) => s.setDemoDisabled);
  const startMyData = useAppStore((s) => s.startMyData);
  const csvData = useAppStore((s) => s.csvData);
  const handoffCsvToRoute = useAppStore((s) => s.handoffCsvToRoute);
  const isAnalyzed = useAppStore((s) => s.isGroupAnalyzed("start-gate"));

  // 진입 = 내 데이터 의도 → 데모 자동로드 억제 + 이미 로드된 데모 슬라이스 비움.
  useEffect(() => {
    startMyData();
  }, [startMyData]);

  const groups = IA.filter((g) => OPS_GROUP_IDS.has(g.id) && g.id !== DATA_GUIDE_GROUP);
  const goTool = (id) => router.push(locale === "en" && hasEnVersion(id) ? `/en${idToSlug[id] || ""}` : idToSlug[id] || "/");
  const goDemo = () => { setDemoDisabled(false); router.push(locale === "en" ? "/en/dashboard" : "/dashboard"); };
  const diagnosis = useMemo(() => buildRouterDiagnosis({ canonicalData: csvData.canonicalData, mapping: csvData.mapping, locale }), [csvData.mapping, csvData.canonicalData, locale]);
  const eligibility = useMemo(() => ROUTER_TOOL_IDS.map((toolId) => evaluateEligibility({ toolId, mapping: csvData.mapping, canonicalData: csvData.canonicalData, diagnosis })), [csvData.mapping, csvData.canonicalData, diagnosis]);
  const recommended = rankRecommendedAnalyses(eligibility);
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
      <aside className="start-diagnose-entry">
        <div><strong>{C.diagnoseLabel}</strong><p>{C.diagnoseDesc}</p></div>
        <Link
          className="btn ghost"
          href={locale === "en" ? "/en/diagnose" : "/diagnose"}
          onClick={() => trackProductEvent("diagnose_entry_clicked", { source: "start", placement: "before_upload", locale })}
        >
          {C.diagnoseCta} →
        </Link>
      </aside>

      <section className="block" style={{ marginTop: "1.2rem" }}>
        <CsvUploader toolId="start-gate" locale={locale} />
      </section>

      {isAnalyzed && (
        <AnalysisEligibilityList
          results={[...recommended, ...eligibility.filter((item) => !recommended.includes(item))]}
          getTitle={getTitle}
          onOpen={openRecommended}
          locale={locale}
        />
      )}

      {!isAnalyzed && <details className="start-tool-browser">
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

      <div style={{ marginTop: "1.6rem", textAlign: "center" }}>
        <button type="button" onClick={goDemo} className="btn ghost" style={{ fontSize: "13px" }}>
          {C.demoLink}
        </button>
      </div>
    </>
  );
}
