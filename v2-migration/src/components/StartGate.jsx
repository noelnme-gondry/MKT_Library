"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { buildIndustryPresetDemo, getIndustryPresets, getIndustryScaleOptions } from "@/lib/industryPresets";
import { buildDemoCsv } from "@/utils/demoData";

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
    presetEyebrow: "SITUATION PRESETS",
    presetTitle: "업로드 전에, 내 상황과 가까운 결과부터 보세요",
    presetDeck: "업종과 규모를 고르면 90일 합성 데이터로 판단 화면이 바로 열립니다. 숫자는 예시이며 실제 데이터는 저장하거나 전송하지 않습니다.",
    scaleLabel: "샘플 운영 규모",
    scaleHint: "선택하지 않으면 성장기 기준",
    viewPreset: "이 상황으로 결과 보기",
    sampleMeta: "90일 · 4개 매체 · 합성 데이터",
    uploadDivider: "또는 내 데이터를 바로 진단",
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
    presetEyebrow: "SITUATION PRESETS",
    presetTitle: "See a result that resembles your situation before uploading",
    presetDeck: "Choose an industry and scale to open a decision view with 90 days of synthetic data. The numbers are examples; no data is stored or sent.",
    scaleLabel: "Sample operating scale",
    scaleHint: "Growth is used by default",
    viewPreset: "View this situation",
    sampleMeta: "90 days · 4 channels · synthetic data",
    uploadDivider: "Or diagnose your own data",
  },
};

export default function StartGate({ locale = "ko" }) {
  const C = COPY[locale] || COPY.ko;
  const router = useRouter();
  const setDemoDisabled = useAppStore((s) => s.setDemoDisabled);
  const startMyData = useAppStore((s) => s.startMyData);
  const csvData = useAppStore((s) => s.csvData);
  const handoffCsvToRoute = useAppStore((s) => s.handoffCsvToRoute);
  const [presetScale, setPresetScale] = useState("growth");
  const hasTrackedPresetExposure = useRef(false);
  const presets = useMemo(() => getIndustryPresets(locale), [locale]);
  const scaleOptions = useMemo(() => getIndustryScaleOptions(locale), [locale]);

  // 진입 = 내 데이터 의도 → 데모 자동로드 억제 + 이미 로드된 데모 슬라이스 비움.
  useEffect(() => {
    startMyData();
  }, [startMyData]);

  useEffect(() => {
    if (hasTrackedPresetExposure.current) return;
    hasTrackedPresetExposure.current = true;
    trackProductEvent("preset_exposed", { source: "start", placement: "before_upload", locale });
  }, [locale]);

  const groups = IA.filter((g) => OPS_GROUP_IDS.has(g.id) && g.id !== DATA_GUIDE_GROUP);
  const goTool = (id) => router.push(locale === "en" && hasEnVersion(id) ? `/en${idToSlug[id] || ""}` : idToSlug[id] || "/");
  const goDemo = () => { setDemoDisabled(false); router.push(locale === "en" ? "/en/dashboard" : "/dashboard"); };
  const runPreset = (preset) => {
    const demo = buildIndustryPresetDemo(buildDemoCsv("efficiency", locale), preset.id, presetScale);
    if (!demo) return;
    setDemoDisabled(false);
    handoffCsvToRoute("5-2", demo);
    const params = {
      tool_id: "5-2",
      source: "industry_preset",
      placement: "before_upload",
      locale,
      preset_id: preset.id,
      preset_scale: presetScale,
    };
    trackProductEvent("preset_selected", params);
    trackProductEvent("example_run_started", params);
    router.push(locale === "en" ? "/en/dashboard" : "/dashboard");
  };
  const diagnosis = useMemo(() => buildRouterDiagnosis({ canonicalData: csvData.canonicalData, mapping: csvData.mapping, locale }), [csvData.mapping, csvData.canonicalData, locale]);
  const eligibility = useMemo(() => ROUTER_TOOL_IDS.map((toolId) => evaluateEligibility({ toolId, mapping: csvData.mapping, canonicalData: csvData.canonicalData, diagnosis })), [csvData.mapping, csvData.canonicalData, diagnosis]);
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

      <section className="start-presets" aria-labelledby="start-preset-title">
        <div className="start-presets__head">
          <div>
            <span>{C.presetEyebrow}</span>
            <h2 id="start-preset-title">{C.presetTitle}</h2>
            <p>{C.presetDeck}</p>
          </div>
          <div className="start-preset-scale" role="group" aria-label={C.scaleLabel}>
            <div><strong>{C.scaleLabel}</strong><small>{C.scaleHint}</small></div>
            <div className="start-preset-scale__options">
              {scaleOptions.map((scale) => (
                <button
                  type="button"
                  key={scale.id}
                  className={presetScale === scale.id ? "is-active" : ""}
                  aria-pressed={presetScale === scale.id}
                  aria-label={`${scale.short} · ${scale.label}`}
                  onClick={() => setPresetScale(scale.id)}
                >
                  <span>{scale.short}</span>
                  <small>{scale.label}</small>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="start-presets__grid">
          {presets.map((preset) => (
            <button
              type="button"
              key={preset.id}
              className="start-preset-card"
              data-preset={preset.id}
              onClick={() => runPreset(preset)}
              aria-label={`${preset.title} · ${C.viewPreset}`}
              aria-describedby={`start-preset-${preset.id}-question`}
            >
              <span className="start-preset-card__code">{preset.code}</span>
              <h3>{preset.title}</h3>
              <p id={`start-preset-${preset.id}-question`}>{preset.question}</p>
              <ol className="start-preset-card__path" aria-label={preset.description}>
                {preset.metricPath.map((metric) => <li key={metric}>{metric}</li>)}
              </ol>
              <span className="start-preset-card__meta">{C.sampleMeta}</span>
              <strong className="start-preset-card__cta">{C.viewPreset} <span aria-hidden="true">→</span></strong>
            </button>
          ))}
        </div>
      </section>

      <div className="start-upload-divider"><span>{C.uploadDivider}</span></div>

      <section className="block" style={{ marginTop: "1.2rem" }}>
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

      <div style={{ marginTop: "1.6rem", textAlign: "center" }}>
        <button type="button" onClick={goDemo} className="btn ghost" style={{ fontSize: "13px" }}>
          {C.demoLink}
        </button>
      </div>
    </>
  );
}
