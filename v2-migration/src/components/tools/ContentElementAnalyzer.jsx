"use client";
// ── 콘텐츠 요소 분석기 (9-1) ─────────────────────────────────────────────────
// 다변량 회귀(REG_STATS.ols, regMath — 엔진 불변 재사용)로 "어떤 제작 요소가
// 성과(CTR·조회수)와 유의하게 연관되는가"를 가려낸다. 5-18 회귀 탭이 3탭 안에
// 묻혀 있어 단독 요소-중요도 UI가 없으므로 신규 얇은 컴포넌트(§plan: 라벨팩
// 파라미터화의 유일한 예외 — 소스 컴포넌트가 없어 엔진 위 신규 UI).
//
// 통계적 정직성(§8): 관측 속성 회귀는 교락이 심함 → "연관"이지 "인과" 아님.
// OLS가 산출하지 않는 값("확률 85%" 등)은 만들지 않는다. 유의성은 HC3 robust
// two-sided p에 BH 다중검정 보정을 적용한다.
import React, { useState, useMemo, useRef, useEffect } from "react";
import Papa from "papaparse";
import Chart from "chart.js/auto";
import { computeAnalyzeSig, useAppStore } from "@/store/useDataStore";
import { REG_STATS } from "@/utils/regMath";
import { CHART_THEME } from "@/utils/chartUtils";
import { buildDemoCsv } from "@/utils/demoData";
import CsvGuide from "@/components/ds/CsvGuide";
import AnalysisDetails from "@/components/ds/AnalysisDetails";
import ResultActionCard from "@/components/ds/ResultActionCard";
import ModelDiagnosticsPanel from "@/components/ds/ModelDiagnosticsPanel";
import AnalysisBlockedTelemetry from "@/components/data-import/AnalysisBlockedTelemetry";
import { ELEMENT_COPY as C } from "@/utils/contentDomain";
import { analysisResultEventKey, trackProductEvent, trackProductEventOnce } from "@/lib/analytics";

const MUTED = "var(--text-muted)";
const MIN_BINARY_SUPPORT = 5;

// 셸 카피 KR/EN 팩(§EN 확장). ko = 기존 하드코딩 문자열과 byte-동일(출력 불변),
// en = 번역. 도메인 카피(heroQ 등)는 ko가 contentDomain ELEMENT_COPY를 그대로 참조.
const EA_COPY = {
  ko: {
    dataPrep: "데이터 준비",
    dropTitle: "CSV 파일 드래그 & 드롭",
    dropSub: "또는 클릭하여 파일 선택",
    demoBannerTitle: "🧪 지금 보고 있는 화면은 샘플(예시) 데이터입니다",
    demoBannerDesc: "실제 내 데이터가 아니며, 서버로 전송되지 않습니다. 내 CSV를 업로드하면 바로 교체됩니다.",
    demoBannerBtn: "📁 내 CSV 업로드하기",
    mappingTitle: "컬럼 지정",
    previewingDemo: "샘플 데이터로 미리보기 중",
    rowsStats: (rows, cols) => `${rows.toLocaleString()}행 · 숫자 컬럼 ${cols}개`,
    changeCsvBtn: "⟳ CSV 변경",
    outcomeLabel: C.outcomeLabel,
    outcomeHint: "설명하고 싶은 성과 숫자 1개를 고르세요.",
    featureLabel: C.featureLabel,
    featureHint: "성과에 영향을 줬을 만한 요소들을 고르세요(있음/없음은 0/1, 길이·개수는 숫자).",
    featureDataHint: "콘텐츠 1건당 1행, 요소 1개당 1개 숫자 열로 준비하세요. 태그 중복은 업로드 전에 한 열로 합치고, ‘없음’은 빈칸 대신 0으로 적으세요(빈칸은 결측으로 제외됩니다).",
    needBoth: "⚠ 성과 1개 + 요소 1개 이상을 지정하세요",
    analyzedBadge: "✓ 분석 완료",
    analyzedHint: "컬럼을 바꾸면 결과가 숨겨지고 다시 분석해야 합니다.",
    reanalyzeBtn: "↻ 다시 분석",
    readyMsg: "지정 완료.",
    readyStrong: "분석을 실행하세요.",
    analyzeBtn: "▶ 분석하기",
    cantEstimate: "추정 불가",
    errNoVariance: "고른 요소가 전부 같은 값이라 성과와의 관계를 추정할 수 없습니다. 값이 변하는 요소를 넣어주세요.",
    errTooFewRows: (n, k) => `데이터 행이 요소 수 대비 너무 적습니다(행 ${n} · 변수 ${k}). 콘텐츠 편수를 늘리거나 요소 수를 줄이세요.`,
    errSingular: "요소들이 서로 너무 비슷(공선성)해 각 요소의 몫을 분리할 수 없습니다. 겹치는 요소를 하나만 남겨보세요.",
    errHighLeverage: "선택한 요소가 너무 적은 콘텐츠에만 나타나 강건한 불확실성을 계산할 수 없습니다. 해당 요소가 있는 콘텐츠와 없는 콘텐츠를 각각 2개 이상 확보하거나 희소 요소를 빼주세요.",
    errConstantOutcome: "선택한 성과가 모든 유효 콘텐츠에서 같아 요소와의 관계를 추정할 수 없습니다. 값이 변하는 성과 지표를 고르세요.",
    errSparseFeatures: (features) => `희소 요소(${features.join(", ")})는 있는 콘텐츠 또는 없는 콘텐츠가 5건 미만이라 과대해석 위험이 있어 결론에서 제외했습니다. 각 상태를 5건 이상 확보하거나 해당 요소를 빼세요.`,
    excludedRows: (valid, total) => `유효 행 ${valid.toLocaleString()} / 입력 ${total.toLocaleString()}행`,
    heroQ: C.heroQ,
    heroSub: C.heroSub,
    topSigLabel: "🏆 가장 강한 요소",
    noSigHtml: null, // KR은 기존 인라인 JSX 유지(byte-동일)
    causationTitle: "연관이지 인과 아님",
    causationBody: C.causationBody,
    forestTitle: "어떤 요소가 성과와 연관됐나",
    ciLegendLabel: "HC3 95% 신뢰구간",
    coefLegendLabel: "계수(추정 연관)",
    axisTitle: (outcome) => `${outcome}와의 연관 계수`,
    tipSig: " (유의)",
    tipNs: " (무유의)",
    tipCoef: "계수",
    expertSummary: "📊 전문가 뷰 — 계수·표준오차·p값 전체 표, 모델 적합도",
    intercept: "절편",
    droppedPrefix: "무분산 제외: ",
    thElement: "요소",
    thCoef: "계수",
    thCoefTip: "다른 선택 요소를 함께 둔 관측 연관 계수(인과효과 아님)",
    thSeTip: "이분산에 강건한 HC3 표준오차",
    thTTip: "t = 계수/HC3 SE (연관 강도)",
    thRawPTip: "HC3 two-sided 원 p-value",
    thPTip: "BH 보정 two-sided p-value",
    thCiTip: "HC3 pointwise 95% 신뢰구간",
    thVerdict: "판정",
    sigUp: "유의 ↑",
    sigDown: "유의 ↓",
    ns: "무유의",
    tableFootnote: '표준오차·신뢰구간은 이분산에 강건한 HC3, 판정은 BH 보정 p값 기준입니다. 신뢰구간은 요소별 pointwise 구간입니다. 계수는 각 요소의 원단위 연관 — 있음/없음(0/1)은 "있을 때 vs 없을 때", 숫자는 "1 증가 시" 성과 변화입니다.',
  },
  en: {
    dataPrep: "Prepare your data",
    dropTitle: "Drag & drop a CSV file",
    dropSub: "or click to choose a file",
    demoBannerTitle: "🧪 You're viewing sample data",
    demoBannerDesc: "This isn't your real data and nothing is sent to a server. Upload your own CSV to replace it instantly.",
    demoBannerBtn: "📁 Upload my CSV",
    mappingTitle: "Assign columns",
    previewingDemo: "Previewing sample data",
    rowsStats: (rows, cols) => `${rows.toLocaleString()} rows · ${cols} numeric columns`,
    changeCsvBtn: "⟳ Change CSV",
    outcomeLabel: "Outcome metric (CTR, views, etc.)",
    outcomeHint: "Pick the one performance number you want to explain.",
    featureLabel: "Content elements (production attributes)",
    featureHint: "Pick the elements that might have driven the outcome (yes/no as 0/1; lengths and counts as numbers).",
    featureDataHint: "Use one row per content piece and one numeric column per element. Combine duplicate tags before upload, and write 0—not a blank—for an absent tag (blanks are excluded as missing).",
    needBoth: "⚠ Choose 1 outcome + at least 1 element",
    analyzedBadge: "✓ Analysis done",
    analyzedHint: "Changing columns hides the results until you analyze again.",
    reanalyzeBtn: "↻ Re-analyze",
    readyMsg: "Columns assigned.",
    readyStrong: "Run the analysis.",
    analyzeBtn: "▶ Analyze",
    cantEstimate: "Cannot estimate",
    errNoVariance: "Every selected element has the same value in every row, so its relationship with the outcome can't be estimated. Add elements whose values vary.",
    errTooFewRows: (n, k) => `Too few rows for the number of elements (rows ${n} · variables ${k}). Add more content pieces or drop some elements.`,
    errSingular: "The elements are too similar to each other (collinearity) to separate their contributions. Keep only one of any overlapping pair.",
    errHighLeverage: "A selected element appears in too few content pieces to estimate robust uncertainty. Add at least two pieces with and without that element, or remove the sparse element.",
    errConstantOutcome: "The selected outcome is identical for every valid content piece, so its relationship with elements can't be estimated. Choose an outcome that varies.",
    errSparseFeatures: (features) => `Sparse element(s) (${features.join(", ")}) have fewer than 5 content pieces with or without the element, so they are excluded from the conclusion to avoid over-reading them. Collect at least 5 of each state or remove the element.`,
    excludedRows: (valid, total) => `${valid.toLocaleString()} valid / ${total.toLocaleString()} input rows`,
    heroQ: "Which production elements drive performance?",
    heroSub: "Puts your content pieces' production attributes and outcomes (CTR, views) side by side, and uses multivariate regression to isolate the elements significantly associated with performance.",
    topSigLabel: "🏆 Strongest element",
    noSigHtml: "No element reaches <strong>statistical significance</strong> in this data. Add more samples or try different elements (not significant ≠ no effect — it means <em>insufficient evidence</em>).",
    causationTitle: "Association, not causation",
    causationBody: "These results are <strong>associations</strong>, not <strong>causation</strong>. Skilled creators tend to use several good elements together (confounding), so changing one element in isolation may behave differently. Confirm with an <strong>A/B test</strong> that changes exactly one element.",
    forestTitle: "Which elements are associated with the outcome",
    ciLegendLabel: "HC3 95% confidence interval",
    coefLegendLabel: "Coefficient (estimated association)",
    axisTitle: (outcome) => `Association coefficient with ${outcome}`,
    tipSig: " (significant)",
    tipNs: " (not significant)",
    tipCoef: "coef",
    expertSummary: "📊 Expert view — full coefficient/SE/p table, model fit",
    intercept: "intercept",
    droppedPrefix: "No-variance excluded: ",
    thElement: "Element",
    thCoef: "Coef",
    thCoefTip: "Observed association coefficient with other selected elements included (not causal effect)",
    thSeTip: "HC3 heteroskedasticity-robust standard error",
    thTTip: "t = coef/HC3 SE (association strength)",
    thRawPTip: "Raw HC3 two-sided p-value",
    thPTip: "BH-adjusted two-sided p-value",
    thCiTip: "Pointwise HC3 95% confidence interval",
    thVerdict: "Verdict",
    sigUp: "Sig ↑",
    sigDown: "Sig ↓",
    ns: "n.s.",
    tableFootnote: "SEs and pointwise intervals use heteroskedasticity-robust HC3; decisions use BH-adjusted p-values. Coefficients are raw-unit associations — present vs absent for 0/1 elements, or the outcome change per +1 for numeric elements.",
  },
};

/* 컬럼이 대체로 숫자면 true (id·라벨 컬럼 배제용). */
function isNumericColumn(rows, header) {
  let ok = 0, seen = 0;
  for (let i = 0; i < rows.length && seen < 60; i++) {
    const v = rows[i][header];
    if (v === "" || v == null) continue;
    seen++;
    if (isFinite(parseFloat(String(v).replace(/,/g, "")))) ok++;
  }
  return seen > 0 && ok / seen >= 0.8;
}

const num = (v) => parseFloat(String(v == null ? "" : v).replace(/,/g, ""));

function numberRange(values) {
  let min = Infinity, max = -Infinity;
  for (const value of values) {
    if (!isFinite(value)) continue;
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  return { min, max };
}

/* 성과(종속) 컬럼 자동 추정 — 이름이 성과성이면 우선, 아니면 마지막 숫자 컬럼. */
function guessOutcome(numericCols) {
  const rx = /(ctr|조회|view|성과|click.?rate|engagement|반응|완독|read.?rate|cvr|conv)/i;
  return numericCols.find((h) => rx.test(h)) || numericCols[numericCols.length - 1] || null;
}

/* id처럼 보이는 컬럼(피처에서 제외). */
function looksLikeId(header) {
  return /(_id$|^id$|post_id|content_id|url|title|이름|name)/i.test(header);
}

function analyzeSig(outcome, features, fileName) {
  return JSON.stringify({ o: outcome, f: [...features].sort() }) + "|" + (fileName || "");
}

/* 결과 CSV(BOM+CRLF, §7) — 검증 가능성(§9). */
function downloadCoefCsv(rows) {
  const q = (s) => { s = String(s); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const head = ["element", "coefficient", "hc3_std_error", "hc3_t_value", "p_raw_two_sided_hc3", "p_bh_adjusted", "hc3_ci_low", "hc3_ci_high", "significant_bh_5pct"];
  const lines = [head.join(",")];
  for (const r of rows) {
    lines.push([
      r.name, r.coef.toFixed(5), r.se.toFixed(5), r.t.toFixed(3),
      r.rawP.toFixed(5), r.p.toFixed(5), r.ciLo.toFixed(5), r.ciHi.toFixed(5), r.sig ? "1" : "0",
    ].map(q).join(","));
  }
  const content = "﻿" + lines.join("\r\n");
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `content_elements_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function ContentElementAnalyzer({ locale = "ko" }) {
  const T = EA_COPY[locale] || EA_COPY.ko;
  const tr = (ko, en) => (locale === "en" ? en : ko);
  const csvData = useAppStore((s) => s.csvData);
  const setCsvData = useAppStore((s) => s.setCsvData);
  const demoDisabled = useAppStore((s) => s.demoDisabled);
  const analystMode = useAppStore((s) => s.analystMode);
  const requestAd = useAppStore((s) => s.requestAd);
  const fileRef = useRef(null);
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  const hasData = csvData?.raw?.length > 0;
  const isDemo = !!(csvData?.fileName && csvData.fileName.startsWith("demo_"));

  const [demoPending, setDemoPending] = useState(false);
  const [outcome, setOutcome] = useState(null);
  const [features, setFeatures] = useState([]);
  const [analyzedSig, setAnalyzedSig] = useState(null);
  const [mappingOpen, setMappingOpen] = useState(true);
  const [seededKey, setSeededKey] = useState(null);

  const handleFile = (file) => {
    if (!file) return;
    trackProductEvent("data_import_start", { tool_id: "9-1", source: "csv", locale });
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (res) => {
        const rows = Array.isArray(res.data) ? res.data : [];
        const headers = res.meta?.fields || [];
        if (!rows.length) {
          trackProductEvent("data_import_failed", { tool_id: "9-1", source: "csv", state: "empty_file", locale });
          return;
        }
        const hasFatalParseError = (res.errors || []).some((error) =>
          error?.type === "Quotes"
          || error?.type === "Delimiter"
          || error?.type === "Abort"
          || error?.code === "TooManyFields");
        if (hasFatalParseError) {
          trackProductEvent("data_import_failed", { tool_id: "9-1", source: "csv", state: "parse_error", locale });
          return;
        }
        setCsvData({ raw: rows, headers, mapping: {}, fileName: file.name });
        trackProductEvent("data_import_success", { tool_id: "9-1", source: "csv", row_count: rows.length, column_count: headers.length, locale });
      },
      error: () => trackProductEvent("data_import_failed", { tool_id: "9-1", source: "csv", state: "parse_error", locale }),
    });
  };
  const handleLoadDemo = () => { setDemoPending(true); setCsvData(buildDemoCsv(C.demoGroup, locale)); };
  const resetCsv = () => setCsvData({ raw: [], headers: [], mapping: {}, fileName: "" });

  // 첫 진입 시 데모 자동 로드(다른 도구와 동일 첫인상 패턴).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!hasData && !demoDisabled) handleLoadDemo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const headers = useMemo(() => {
    if (!hasData) return [];
    return csvData?.headers?.length ? csvData.headers : Object.keys(csvData.raw[0] || {});
  }, [hasData, csvData]);

  const numericCols = useMemo(
    () => (hasData ? headers.filter((h) => isNumericColumn(csvData.raw, h)) : []),
    [hasData, csvData, headers],
  );

  // 데이터 바뀌면 자동추정 재시드(render-time, setState-in-effect 회피).
  const fileName = csvData?.fileName || "data.csv";
  const seedKey = hasData ? `${fileName}|${headers.join(",")}|${csvData.raw.length}` : "";
  if (seededKey !== seedKey) {
    setSeededKey(seedKey);
    const o = guessOutcome(numericCols);
    const f = numericCols.filter((h) => h !== o && !looksLikeId(h));
    setOutcome(o);
    setFeatures(f);
    setAnalyzedSig(demoPending && hasData ? analyzeSig(o, f, fileName) : null);
    setMappingOpen(!(demoPending && hasData));
    if (demoPending) setDemoPending(false);
  }

  const analyzed = analyzedSig != null && analyzedSig === analyzeSig(outcome, features, fileName);
  const runElementAnalysis = () => {
    const nextSig = analyzeSig(outcome, features, fileName);
    trackProductEventOnce("analysis_started", analysisResultEventKey("9-1", "content_elements", computeAnalyzeSig(csvData), nextSig, locale), {
      tool_id: "9-1",
      source: isDemo ? "demo" : "csv",
      row_count: csvData?.raw?.length || 0,
      analysis_type: "content_elements",
      locale,
    });
    requestAd(() => {
      setAnalyzedSig(nextSig);
      setMappingOpen(false);
    });
  };

  // ── 회귀 적합 (REG_STATS.ols) ──────────────────────────────────────────────
  const fit = useMemo(() => {
    // 매핑을 고르는 동안에는 대용량 CSV를 재계산하지 않는다. 분석 실행 시점의
    // signature만 적합해 결과와 입력이 어긋나는 일도 막는다.
    if (!analyzed || !hasData || !outcome || !features.length) return null;
    // 상수(무분산) 피처 드롭 → 특이행렬 방지 + 정직 안내.
    const dropped = [];
    const useFeatures = features.filter((f) => {
      const vals = csvData.raw.map((r) => num(r[f])).filter(isFinite);
      const { min, max } = numberRange(vals);
      if (!(max > min)) { dropped.push(f); return false; }
      return true;
    });
    if (!useFeatures.length) return { error: "no-variance", dropped };

    const completeRows = (includedFeatures) => csvData.raw.filter((r) => {
      const yv = num(r[outcome]);
      return isFinite(yv) && includedFeatures.every((f) => isFinite(num(r[f])));
    });
    // 0/1 태그는 한쪽 상태가 5건 미만이면 극단적인 몇 행이 계수를 지배한다.
    // 이때는 억지로 추정하지 않고 요소 자체를 결론에서 제외한다.
    const sparse = [];
    const supportedFeatures = useFeatures.filter((f) => {
      const values = csvData.raw
        .filter((r) => isFinite(num(r[outcome])) && isFinite(num(r[f])))
        .map((r) => num(r[f]));
      const isBinary = values.every((v) => v === 0 || v === 1);
      if (!isBinary) return true;
      const present = values.filter((v) => v === 1).length;
      const absent = values.length - present;
      if (present < MIN_BINARY_SUPPORT || absent < MIN_BINARY_SUPPORT) {
        sparse.push(f);
        return false;
      }
      return true;
    });
    if (!supportedFeatures.length) return { error: "sparse-features", dropped, sparse, n: 0, inputRows: csvData.raw.length };

    const validRows = completeRows(supportedFeatures);
    const X = validRows.map((r) => [1, ...supportedFeatures.map((f) => num(r[f]))]);
    const y = validRows.map((r) => num(r[outcome]));
    const n = X.length;
    if (n < supportedFeatures.length + 3) return { error: "too-few-rows", n, k: supportedFeatures.length, dropped, sparse, inputRows: csvData.raw.length };
    const { min: yMin, max: yMax } = numberRange(y);
    if (!(yMax > yMin)) return { error: "constant-outcome", n, k: supportedFeatures.length, dropped, sparse, inputRows: csvData.raw.length };

    let res;
    try { res = REG_STATS.ols(X, y); } catch { return { error: "singular", dropped }; }
    if (!res || res.regularized || !isFinite(res.R2) || res.se.some((s) => !isFinite(s))) return { error: "singular", dropped, sparse, inputRows: csvData.raw.length };
    if (!res.hc3Valid) return { error: "high-leverage", dropped, sparse, maxLeverage: res.maxLeverage, inputRows: csvData.raw.length };

    const isBinaryFeature = (f) => {
      const set = new Set(validRows.map((r) => num(r[f])));
      return [...set].every((v) => v === 0 || v === 1);
    };
    const rows = supportedFeatures.map((f, j) => {
      const idx = j + 1; // 절편이 0
      const p2 = res.hc3Pval[idx]; // REG_STATS.tSF가 이미 two-sided p-value 반환.
      return {
        name: f,
        coef: res.beta[idx],
        se: res.hc3Se[idx],
        t: res.hc3Tval[idx],
        p: p2,
        rawP: p2,
        ciLo: res.hc3Ci[idx][0],
        ciHi: res.hc3Ci[idx][1],
        sig: false,
        binary: isBinaryFeature(f),
      };
    });
    // 여러 요소를 동시에 훑으므로 BH FDR 보정값을 판정에 사용(raw p도 보존).
    const byP = [...rows].sort((a, b) => a.rawP - b.rawP);
    let nextAdjusted = 1;
    for (let rank = byP.length - 1; rank >= 0; rank--) {
      nextAdjusted = Math.min(nextAdjusted, (byP[rank].rawP * byP.length) / (rank + 1));
      byP[rank].p = Math.min(1, nextAdjusted);
      byP[rank].sig = byP[rank].p < 0.05;
    }
    // 중요도 = 연관 강도(|t|) 내림차순 — 단위 무관 비교(§honesty: effect-size 아님).
    rows.sort((a, b) => Math.abs(b.t) - Math.abs(a.t));
    return {
      rows, n, k: supportedFeatures.length, dropped, sparse, inputRows: csvData.raw.length, excludedRows: csvData.raw.length - n,
      R2: res.R2, adjR2: res.adjR2, intercept: res.beta[0], outcome,
      // Additive UI payload only: diagnostics inspect the exact displayed OLS fit.
      olsFit: res, X, terms: ["(Intercept)", ...supportedFeatures],
    };
  }, [analyzed, hasData, csvData, outcome, features]);

  useEffect(() => {
    if (!analyzed || !fit?.error) return;
    trackProductEventOnce("analysis_completed", analysisResultEventKey("9-1", "content_elements", computeAnalyzeSig(csvData), analyzedSig, locale), {
      tool_id: "9-1",
      source: isDemo ? "demo" : csvData?.importSource || "csv",
      row_count: csvData?.raw?.length || 0,
      analysis_type: "content_elements",
      result_state: "insufficient",
      locale,
    });
  }, [analyzed, analyzedSig, csvData, fit?.error, isDemo, locale]);

  // ── Forest plot ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (chartInstance.current) { chartInstance.current.destroy(); chartInstance.current = null; }
    if (!analyzed || !chartRef.current || !fit || fit.error || !fit.rows.length) return undefined;
    const TT = EA_COPY[locale] || EA_COPY.ko;
    const rows = fit.rows;
    const labels = rows.map((r) => r.name);
    const posColor = "rgba(34,197,94,0.85)", negColor = "rgba(248,113,113,0.85)", nsColor = "rgba(148,163,184,0.6)";
    const colorOf = (r) => (!r.sig ? nsColor : r.coef >= 0 ? posColor : negColor);
    chartInstance.current = new Chart(chartRef.current, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: TT.ciLegendLabel,
            data: rows.map((r) => [r.ciLo, r.ciHi]),
            backgroundColor: rows.map((r) => colorOf(r).replace("0.85", "0.25").replace("0.6", "0.18")),
            borderColor: rows.map(colorOf),
            borderWidth: 1,
            borderSkipped: false,
            barPercentage: 0.5,
          },
          {
            type: "scatter",
            label: TT.coefLegendLabel,
            data: rows.map((r) => ({ x: r.coef, y: r.name })),
            backgroundColor: rows.map(colorOf),
            pointRadius: 5,
            pointHoverRadius: 6,
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            title: { display: true, text: TT.axisTitle(fit.outcome), color: CHART_THEME.muted },
            ticks: { color: CHART_THEME.muted },
            grid: { color: CHART_THEME.grid },
          },
          y: { type: "category", labels, ticks: { color: CHART_THEME.text }, grid: { color: CHART_THEME.grid } },
        },
        plugins: {
          legend: { labels: { color: CHART_THEME.muted, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const r = rows[ctx.dataIndex];
                if (!r) return "";
                return `${r.name}: ${TT.tipCoef} ${r.coef.toFixed(3)} · 95%CI [${r.ciLo.toFixed(3)}, ${r.ciHi.toFixed(3)}] · BH p=${r.p.toFixed(3)}${r.sig ? TT.tipSig : TT.tipNs}`;
              },
            },
          },
        },
      },
    });
    return () => { if (chartInstance.current) { chartInstance.current.destroy(); chartInstance.current = null; } };
  }, [analyzed, fit, locale]);

  // ── 빈 상태 ────────────────────────────────────────────────────────────────
  if (!hasData) {
    return (
      <div className="tab-pane active">
        <section className="block" id="s-content-mapping">
          <h2 className="section-title">{T.dataPrep}</h2>
          <CsvGuide toolId={C.guideToolId} onTryExample={handleLoadDemo} locale={locale} />
          <div className="csv-dropzone"
            role="button"
            tabIndex={0}
            aria-label={tr("콘텐츠 분석 CSV 파일 선택", "Choose a content-analysis CSV file")}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]); }}
            onClick={() => fileRef.current?.click()}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileRef.current?.click(); } }}
            style={{ cursor: "pointer" }}>
            <div className="csv-drop-text">{T.dropTitle}</div>
            <div className="csv-drop-sub">{T.dropSub}</div>
            <input type="file" accept=".csv,text/csv" style={{ display: "none" }} ref={fileRef}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = null; }} />
          </div>
        </section>
      </div>
    );
  }

  const canAnalyze = !!outcome && features.length > 0;
  const topSig = fit && !fit.error ? fit.rows.find((r) => r.sig) : null;
  // 관측 연관이 유의한 topSig 하나로 좁혀졌을 때만 도구가 명시한 한 변수 실험 초안을 제공한다.
  // 파일명·원본 행·매핑·signature는 넘기지 않고, 실험 baseline은 계산하지 않았으므로 비운다.
  const decisionPrefill = topSig
    ? {
        conclusion: tr(
          `${topSig.name}과 ${fit.outcome} 사이에 ${topSig.coef >= 0 ? "양의" : "음의"} 관측 연관이 확인됐습니다 (BH p=${topSig.p.toFixed(3)}). 인과효과로 확정하지 않습니다.`,
          `${topSig.name} has a ${topSig.coef >= 0 ? "positive" : "negative"} observed association with ${fit.outcome} (BH p=${topSig.p.toFixed(3)}). This does not establish a causal effect.`,
        ),
        action: topSig.binary
          ? tr(
              `${topSig.name} 있음/없음만 다른 A/B 테스트 초안을 만들고 나머지 요소와 배포 조건을 고정한다`,
              `Draft an A/B test that differs only in whether ${topSig.name} is present, holding every other element and distribution condition fixed`,
            )
          : tr(
              `${topSig.name} 수준만 다른 두 버전의 A/B 테스트 초안을 만들고 나머지 요소와 배포 조건을 고정한다`,
              `Draft an A/B test with two preset ${topSig.name} levels, holding every other element and distribution condition fixed`,
            ),
        hypothesis: tr(
          `한 변수 통제 실험에서도 ${fit.outcome} 차이가 관측 연관과 같은 ${topSig.coef >= 0 ? "높은" : "낮은"} 방향으로 재현될 것이다`,
          `In the one-variable controlled experiment, the ${fit.outcome} difference should reproduce the observed ${topSig.coef >= 0 ? "higher" : "lower"} direction`,
        ),
        metric: String(fit.outcome),
        baseline: "",
        sourcePeriod: "",
        reviewQuestion: tr(
          `한 변수 통제 실험에서 ${fit.outcome} 차이가 재현됐는가, 아니면 관측 연관만 남았는가?`,
          `Did the one-variable controlled experiment reproduce the ${fit.outcome} difference, or was it only an observational association?`,
        ),
      }
    : null;
  return (
    <div className="tab-pane active">
      {isDemo && (
        <div className="required-banner" style={{ borderLeftColor: "#f7b955", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
          <div>
            <strong>{T.demoBannerTitle}</strong>
            <p style={{ margin: "0.25rem 0 0" }}>{T.demoBannerDesc}</p>
          </div>
          <button className="ab-button" onClick={resetCsv}>{T.demoBannerBtn}</button>
        </div>
      )}

      {/* ── §0 매핑 ── */}
      <details className="block analysis-data-mapping" id="s-content-mapping" open={mappingOpen} onToggle={(event) => setMappingOpen(event.currentTarget.open)}>
        <summary>
          <span><span className="ix">§0</span>{T.mappingTitle}</span>
          {analyzed && <small>{T.analyzedBadge} · {fit?.n?.toLocaleString?.() || csvData.raw.length.toLocaleString()}{tr("행", " rows")}</small>}
        </summary>
        <div className="analysis-data-mapping__body">
        <div className="csv-loaded-bar">
          <div className="csv-loaded-info">
            <span className="dot" style={{ background: isDemo ? "#f59e0b" : "#22c55e" }}></span>
            {isDemo ? <strong>{T.previewingDemo}</strong> : <strong>{fileName}</strong>}
            <span className="csv-loaded-stats tnum">{T.rowsStats(csvData.raw.length, numericCols.length)}</span>
          </div>
          {!isDemo && <button className="ab-pill csv-change-btn" onClick={resetCsv}>{T.changeCsvBtn}</button>}
        </div>

        <div style={{ marginTop: "12px", display: "grid", gap: "12px" }}>
          <div>
            <label style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-1)" }}>{T.outcomeLabel}</label>
            <div style={{ fontSize: "11px", color: MUTED, margin: "2px 0 6px" }}>{T.outcomeHint}</div>
            <select className="map-select" value={outcome || ""} onChange={(e) => { setOutcome(e.target.value); setFeatures((prev) => prev.filter((f) => f !== e.target.value)); }}>
              {numericCols.map((h) => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-1)" }}>{T.featureLabel}</label>
            <div style={{ fontSize: "11px", color: MUTED, margin: "2px 0 6px" }}>{T.featureHint}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {numericCols.filter((h) => h !== outcome).map((h) => {
                const on = features.includes(h);
                return (
                  <button key={h} className={`ab-pill ${on ? "active" : ""}`}
                    onClick={() => setFeatures((prev) => (on ? prev.filter((x) => x !== h) : [...prev, h]))}>
                    {on ? "✓ " : ""}{h}
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: "11px", color: MUTED, marginTop: "7px", lineHeight: 1.45 }}>{T.featureDataHint}</div>
          </div>
        </div>

        {!canAnalyze ? (
          <div className="required-banner" style={{ marginTop: "12px" }}>
            <AnalysisBlockedTelemetry
              toolId="9-1"
              source={isDemo ? "demo" : csvData?.importSource || "csv"}
              state="missing_required"
              signature={`${fileName}|${outcome || ""}|${features.length}`}
              rowCount={csvData?.raw?.length || 0}
              missingCount={(outcome ? 0 : 1) + (features.length ? 0 : 1)}
              analysisType="content_elements"
              locale={locale}
            />
            <strong>{T.needBoth}</strong>
          </div>
        ) : analyzed ? (
          <div style={{ marginTop: "12px", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <span style={{ color: "#22c55e", fontSize: "12px", fontWeight: 600 }}>{T.analyzedBadge}</span>
            <span style={{ color: MUTED, fontSize: "11px" }}>{T.analyzedHint}</span>
            <button className="ab-pill" style={{ marginLeft: "auto" }} onClick={runElementAnalysis}>{T.reanalyzeBtn}</button>
          </div>
        ) : (
          <div style={{ marginTop: "12px", background: "linear-gradient(135deg,rgba(122,162,247,0.12),rgba(122,162,247,0.03))", border: "1px solid rgba(122,162,247,0.3)", borderRadius: "10px", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
            <div style={{ fontSize: "12.5px", color: "var(--text-1)" }}>✅ {T.readyMsg} <strong>{T.readyStrong}</strong></div>
            <button className="ab-pill" style={{ background: CHART_THEME.primary, color: "var(--bg-1)", fontWeight: 700, borderColor: CHART_THEME.primary, fontSize: "13px", padding: "8px 18px" }} onClick={runElementAnalysis}>{T.analyzeBtn}</button>
          </div>
        )}
        </div>
      </details>

      {analyzed && fit && fit.error && (
        <section className="block">
          <div className="required-banner">
            <AnalysisBlockedTelemetry
              toolId="9-1"
              source={isDemo ? "demo" : csvData?.importSource || "csv"}
              state="estimation_failed"
              signature={`${fileName}|${analyzedSig}|${fit.error}`}
              rowCount={csvData?.raw?.length || 0}
              analysisType="content_elements"
              locale={locale}
            />
            <strong>{T.cantEstimate}</strong>
            <p style={{ margin: ".35rem 0 0", fontSize: "12.5px" }}>
              {fit.error === "no-variance" && T.errNoVariance}
              {fit.error === "too-few-rows" && T.errTooFewRows(fit.n || 0, fit.k || 0)}
              {fit.error === "singular" && T.errSingular}
              {fit.error === "high-leverage" && T.errHighLeverage}
              {fit.error === "constant-outcome" && T.errConstantOutcome}
              {fit.error === "sparse-features" && T.errSparseFeatures(fit.sparse || [])}
            </p>
          </div>
        </section>
      )}

      {analyzed && fit && !fit.error && (
        <>
          <section className="block" id="s-content-result">
            <ResultActionCard
              toolId="9-1"
              locale={locale}
              analysisKey={analyzedSig}
              analysisType="content_elements"
              resultState="ready"
              tone={topSig ? "good" : "neutral"}
              title={T.heroQ}
              decisionReview={Boolean(decisionPrefill)}
              decisionPrefill={decisionPrefill}
              headline={topSig
                ? tr(
                    `${topSig.name}: ${fit.outcome}가 ${topSig.coef >= 0 ? "높은" : "낮은"} 쪽과 가장 강하게 연관된 신호입니다.`,
                    `${topSig.name} has the strongest association with a ${topSig.coef >= 0 ? "higher" : "lower"} ${fit.outcome}.`,
                  )
                : tr("유의한 요소를 확정할 증거가 아직 부족합니다.", "There is not enough evidence to confirm a significant element yet.")}
              points={[
                {
                  text: topSig
                    ? tr("다음 실험: 이 요소 하나만 바꾸기", "Next experiment: change this element only")
                    : tr("표본을 늘리거나 서로 겹치지 않는 제작 요소를 추가하세요.", "Add more observations or production elements that do not overlap."),
                  cls: topSig ? "good" : "muted",
                },
              ]}
              stats={[
                { label: tr("가장 강한 요소", "Strongest element"), value: topSig?.name || "—" },
                { label: tr("연관 계수", "Association coefficient"), value: topSig ? `${topSig.coef >= 0 ? "+" : ""}${topSig.coef.toFixed(topSig.binary ? 2 : 3)}` : "—", detail: topSig ? `BH p=${topSig.p.toFixed(3)}` : tr("증거 부족", "Insufficient evidence") },
                { label: tr("유효 행", "Valid rows"), value: fit.n.toLocaleString(), detail: T.excludedRows(fit.n, fit.inputRows) },
                { label: tr("분석 요소", "Features"), value: `${fit.k}${tr("개", "")}`, detail: fit.dropped.length ? tr(`${fit.dropped.length}개 제외`, `${fit.dropped.length} dropped`) : tr("제외 없음", "None dropped") },
              ]}
              analysisDetails={(
            <AnalysisDetails
              locale={locale}
              statusLabel={topSig ? tr("유의 연관 후보", "Significant association candidate") : tr("판정 보류", "Abstain")}
              statusTone={topSig ? "neutral" : "warning"}
              metric={tr("요소 회귀계수·HC3 CI", "Element coefficient · HC3 CI")}
              unit={tr("성과 원 단위", "Outcome units")}
              meaning={tr("콘텐츠 요소와 성과의 관측 연관이며 인과효과가 아닙니다.", "Observed association between content elements and the outcome; not a causal effect.")}
              sampleSize={{ value: fit.n, label: tr("유효 행", "Valid rows"), detail: `${fit.k} ${tr("개 요소", "features")} · ${fit.dropped.length} ${tr("개 제외", "dropped")}` }}
              scope={tr("선택한 outcome·요소 매핑", "Selected outcome and feature mapping")}
              method="WLS/OLS + HC3 + Benjamini-Hochberg"
              version="content-elements-v1"
              metricDefinition={tr("BH 보정 p<0.05를 유의 연관으로 표시하고 95% HC3 구간을 함께 표시합니다.", "BH-adjusted p<0.05 marks an association candidate; pointwise HC3 95% intervals are shown.")}
              warnings={[
                ...(fit.dropped.length ? [tr("분산 0인 요소는 추정에서 제외됐습니다.", "Zero-variance elements were excluded from estimation.")] : []),
                ...(fit.sparse.length ? [tr(`희소 요소(${fit.sparse.join(", ")})는 있는/없는 콘텐츠가 각각 5건 미만이라 결론에서 제외됐습니다.`, `Sparse element(s) (${fit.sparse.join(", ")}) have fewer than 5 contents in one state and were excluded from the conclusion.`)] : []),
                ...(fit.excludedRows ? [tr(`성과 또는 선택 요소가 비어 있는 ${fit.excludedRows.toLocaleString()}행은 추정에서 제외됐습니다. 빈칸을 ‘없음’으로 가정하지 않았습니다.`, `${fit.excludedRows.toLocaleString()} rows with a missing outcome or selected element were excluded; blanks were not assumed to mean absence.`)] : []),
                tr("희소 요소와 플랫폼 선택 편향은 불확실성을 키웁니다. 실험으로 확인하세요.", "Sparse elements and platform selection bias increase uncertainty. Confirm with an experiment."),
              ]}
            />
              )}
            />
          </section>

          {analystMode && <ModelDiagnosticsPanel scope="9-1:ols" fit={fit.olsFit} X={fit.X} labels={fit.terms} locale={locale} />}

          {/* ── §1 요소별 기여도 forest plot ── */}
          <section className="block">
            <h2 className="section-title"><span className="ix">§1</span>{T.forestTitle}</h2>
            <p className="muted" style={{ fontSize: "11.5px", margin: "2px 0 8px" }}>
              {locale === "en" ? (
                <>Dot = estimated association, bar = pointwise HC3 95% CI. <span style={{ color: "#22c55e" }}>Green</span> / <span style={{ color: "#f87171" }}>red</span> = BH p&lt;.05 · <span style={{ color: "#94a3b8" }}>gray</span> = BH p≥.05. Ordered by robust association strength (|t|).</>
              ) : (
                <>점 = 추정 연관(계수), 막대 = 요소별 HC3 95% 신뢰구간. <span style={{ color: "#22c55e" }}>초록</span>/<span style={{ color: "#f87171" }}>빨강</span>=BH p&lt;.05 · <span style={{ color: "#94a3b8" }}>회색</span>=BH p≥.05. 위에서부터 강건한 연관이 큰 순(|t|).</>
              )}
            </p>
            <div className="chart-container" style={{ height: `${Math.max(160, fit.rows.length * 42 + 70)}px` }}>
              <canvas ref={chartRef}></canvas>
            </div>
          </section>

          {/* ── §2 전문가 표 ── */}
          <details className="block">
            <summary style={{ cursor: "pointer", fontSize: "13px", fontWeight: 600, color: "var(--primary, #adc6ff)", padding: "4px 0" }}>
              {T.expertSummary}
            </summary>
            <div style={{ marginTop: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                <div style={{ fontSize: "12.5px", color: MUTED }}>
                  R² {(fit.R2).toFixed(3)} · adj.R² {(fit.adjR2).toFixed(3)} · n {fit.n.toLocaleString()} · {T.intercept} {fit.intercept.toFixed(3)}
                  {fit.dropped.length ? ` · ${T.droppedPrefix}${fit.dropped.join(", ")}` : ""}
                </div>
                <button className="ab-pill" onClick={() => downloadCoefCsv(fit.rows)}>⬇ CSV</button>
              </div>
              <div className="table-wrap" style={{ marginTop: "8px" }}>
                <table className="data" style={{ fontSize: "12.5px" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left" }}>{T.thElement}</th>
                      <th style={{ textAlign: "right" }} title={T.thCoefTip}>{T.thCoef}</th>
                      <th style={{ textAlign: "right" }} title={T.thSeTip}>SE</th>
                      <th style={{ textAlign: "right" }} title={T.thTTip}>t</th>
                      <th style={{ textAlign: "right" }} title={T.thRawPTip}>raw p</th>
                      <th style={{ textAlign: "right" }} title={T.thPTip}>BH p</th>
                      <th style={{ textAlign: "right" }} title={T.thCiTip}>95% CI</th>
                      <th style={{ textAlign: "center" }}>{T.thVerdict}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fit.rows.map((r) => (
                      <tr key={r.name}>
                        <td style={{ textAlign: "left" }}>{r.name}</td>
                        <td className="tnum" style={{ textAlign: "right", color: r.sig ? (r.coef >= 0 ? "#22c55e" : "#f87171") : undefined }}>{r.coef.toFixed(3)}</td>
                        <td className="tnum" style={{ textAlign: "right" }}>{r.se.toFixed(3)}</td>
                        <td className="tnum" style={{ textAlign: "right" }}>{r.t.toFixed(2)}</td>
                        <td className="tnum" style={{ textAlign: "right" }}>{r.rawP.toFixed(3)}</td>
                        <td className="tnum" style={{ textAlign: "right" }}>{r.p.toFixed(3)}</td>
                        <td className="tnum" style={{ textAlign: "right" }}>[{r.ciLo.toFixed(2)}, {r.ciHi.toFixed(2)}]</td>
                        <td style={{ textAlign: "center" }}>{r.sig ? (r.coef >= 0 ? T.sigUp : T.sigDown) : T.ns}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="muted" style={{ fontSize: "11px", marginTop: "8px" }}>
                {T.tableFootnote}
              </p>
            </div>
          </details>
        </>
      )}
    </div>
  );
}
