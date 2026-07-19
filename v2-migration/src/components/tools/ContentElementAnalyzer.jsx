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
import { useAppStore } from "@/store/useDataStore";
import { REG_STATS } from "@/utils/regMath";
import { CHART_THEME } from "@/utils/chartUtils";
import { buildDemoCsv } from "@/utils/demoData";
import DemoLoadButton from "@/components/DemoLoadButton";
import CsvGuide from "@/components/ds/CsvGuide";
import { ELEMENT_COPY as C } from "@/utils/contentDomain";

const MUTED = "var(--text-muted)";

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
    heroQ: C.heroQ,
    heroSub: C.heroSub,
    topSigLabel: "🏆 가장 강한 요소",
    noSigHtml: null, // KR은 기존 인라인 JSX 유지(byte-동일)
    causationTitle: "연관이지 인과 아님",
    causationBody: C.causationBody,
    forestTitle: "어떤 요소가 성과와 연관됐나",
    ciLegendLabel: "HC3 95% 신뢰구간",
    coefLegendLabel: "계수(추정 효과)",
    axisTitle: (outcome) => `${outcome} 변화 (계수)`,
    tipSig: " (유의)",
    tipNs: " (무유의)",
    tipCoef: "계수",
    expertSummary: "📊 전문가 뷰 — 계수·표준오차·p값 전체 표, 모델 적합도",
    intercept: "절편",
    droppedPrefix: "무분산 제외: ",
    thElement: "요소",
    thCoef: "계수",
    thCoefTip: "추정 효과(계수)",
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
    heroQ: "Which production elements drive performance?",
    heroSub: "Puts your content pieces' production attributes and outcomes (CTR, views) side by side, and uses multivariate regression to isolate the elements significantly associated with performance.",
    topSigLabel: "🏆 Strongest element",
    noSigHtml: "No element reaches <strong>statistical significance</strong> in this data. Add more samples or try different elements (not significant ≠ no effect — it means <em>insufficient evidence</em>).",
    causationTitle: "Association, not causation",
    causationBody: "These results are <strong>associations</strong>, not <strong>causation</strong>. Skilled creators tend to use several good elements together (confounding), so changing one element in isolation may behave differently. Confirm with an <strong>A/B test</strong> that changes exactly one element.",
    forestTitle: "Which elements are associated with the outcome",
    ciLegendLabel: "HC3 95% confidence interval",
    coefLegendLabel: "Coefficient (estimated effect)",
    axisTitle: (outcome) => `Change in ${outcome} (coefficient)`,
    tipSig: " (significant)",
    tipNs: " (not significant)",
    tipCoef: "coef",
    expertSummary: "📊 Expert view — full coefficient/SE/p table, model fit",
    intercept: "intercept",
    droppedPrefix: "No-variance excluded: ",
    thElement: "Element",
    thCoef: "Coef",
    thCoefTip: "Estimated effect (coefficient)",
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
  const csvData = useAppStore((s) => s.csvData);
  const setCsvData = useAppStore((s) => s.setCsvData);
  const demoDisabled = useAppStore((s) => s.demoDisabled);
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
  const [seededKey, setSeededKey] = useState(null);

  const handleFile = (file) => {
    if (!file) return;
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (res) => {
        if (!res.data || !res.data.length) return;
        setCsvData({ raw: res.data, headers: res.meta.fields || [], mapping: {}, fileName: file.name });
      },
    });
  };
  const handleLoadDemo = () => { setDemoPending(true); setCsvData(buildDemoCsv(C.demoGroup)); };
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
    if (demoPending) setDemoPending(false);
  }

  const analyzed = analyzedSig != null && analyzedSig === analyzeSig(outcome, features, fileName);

  // ── 회귀 적합 (REG_STATS.ols) ──────────────────────────────────────────────
  const fit = useMemo(() => {
    if (!hasData || !outcome || !features.length) return null;
    // 상수(무분산) 피처 드롭 → 특이행렬 방지 + 정직 안내.
    const dropped = [];
    const useFeatures = features.filter((f) => {
      const vals = csvData.raw.map((r) => num(r[f])).filter(isFinite);
      const mn = Math.min(...vals), mx = Math.max(...vals);
      if (!(mx > mn)) { dropped.push(f); return false; }
      return true;
    });
    if (!useFeatures.length) return { error: "no-variance", dropped };

    const X = [], y = [];
    for (const r of csvData.raw) {
      const yv = num(r[outcome]);
      const xs = useFeatures.map((f) => num(r[f]));
      if (!isFinite(yv) || xs.some((v) => !isFinite(v))) continue;
      X.push([1, ...xs]);
      y.push(yv);
    }
    const n = X.length, k = useFeatures.length + 1;
    if (n < k + 2) return { error: "too-few-rows", n, k, dropped };

    let res;
    try { res = REG_STATS.ols(X, y); } catch { return { error: "singular", dropped }; }
    if (!res || res.regularized || !isFinite(res.R2) || res.se.some((s) => !isFinite(s))) return { error: "singular", dropped };
    if (!res.hc3Valid) return { error: "high-leverage", dropped, maxLeverage: res.maxLeverage };

    const isBinaryFeature = (f) => {
      const set = new Set(csvData.raw.map((r) => num(r[f])).filter(isFinite));
      return [...set].every((v) => v === 0 || v === 1);
    };
    const rows = useFeatures.map((f, j) => {
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
      rows, n, k, dropped,
      R2: res.R2, adjR2: res.adjR2, intercept: res.beta[0], outcome,
    };
  }, [hasData, csvData, outcome, features]);

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
        <section className="block">
          <h2 className="section-title">{T.dataPrep}</h2>
          <CsvGuide toolId={C.guideToolId} locale={locale} />
          <div className="csv-dropzone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]); }}
            onClick={() => fileRef.current?.click()} style={{ cursor: "pointer" }}>
            <div className="csv-drop-text">{T.dropTitle}</div>
            <div className="csv-drop-sub">{T.dropSub}</div>
            <input type="file" accept=".csv,text/csv" style={{ display: "none" }} ref={fileRef}
              onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = null; }} />
          </div>
          <DemoLoadButton onLoad={handleLoadDemo} locale={locale} />
        </section>
      </div>
    );
  }

  const canAnalyze = !!outcome && features.length > 0;
  const topSig = fit && !fit.error ? fit.rows.find((r) => r.sig) : null;
  const effDir = (coef) => (coef >= 0 ? "높이는" : "낮추는");
  const effWord = (coef) => (coef >= 0 ? "높" : "낮");

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
      <section className="block">
        <h2 className="section-title"><span className="ix">§0</span>{T.mappingTitle}</h2>
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
          </div>
        </div>

        {!canAnalyze ? (
          <div className="required-banner" style={{ marginTop: "12px" }}>
            <strong>{T.needBoth}</strong>
          </div>
        ) : analyzed ? (
          <div style={{ marginTop: "12px", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <span style={{ color: "#22c55e", fontSize: "12px", fontWeight: 600 }}>{T.analyzedBadge}</span>
            <span style={{ color: MUTED, fontSize: "11px" }}>{T.analyzedHint}</span>
            <button className="ab-pill" style={{ marginLeft: "auto" }} onClick={() => requestAd(() => setAnalyzedSig(analyzeSig(outcome, features, fileName)))}>{T.reanalyzeBtn}</button>
          </div>
        ) : (
          <div style={{ marginTop: "12px", background: "linear-gradient(135deg,rgba(122,162,247,0.12),rgba(122,162,247,0.03))", border: "1px solid rgba(122,162,247,0.3)", borderRadius: "10px", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
            <div style={{ fontSize: "12.5px", color: "var(--text-1)" }}>✅ {T.readyMsg} <strong>{T.readyStrong}</strong></div>
            <button className="ab-pill" style={{ background: "#7aa2f7", color: "#0b0d12", fontWeight: 700, borderColor: "#7aa2f7", fontSize: "13px", padding: "8px 18px" }} onClick={() => requestAd(() => setAnalyzedSig(analyzeSig(outcome, features, fileName)))}>{T.analyzeBtn}</button>
          </div>
        )}
      </section>

      {analyzed && fit && fit.error && (
        <section className="block">
          <div className="required-banner">
            <strong>{T.cantEstimate}</strong>
            <p style={{ margin: ".35rem 0 0", fontSize: "12.5px" }}>
              {fit.error === "no-variance" && T.errNoVariance}
              {fit.error === "too-few-rows" && T.errTooFewRows(fit.n || 0, fit.k || 0)}
              {fit.error === "singular" && T.errSingular}
              {fit.error === "high-leverage" && T.errHighLeverage}
            </p>
          </div>
        </section>
      )}

      {analyzed && fit && !fit.error && (
        <>
          {/* ── §0 결론 히어로 ── */}
          <section className="block" style={{ background: "linear-gradient(135deg, rgba(122,162,247,0.12), rgba(192,132,252,0.05))", border: "1px solid rgba(122,162,247,0.25)", borderRadius: "14px", padding: "18px 20px" }}>
            <h2 className="section-title" style={{ marginTop: 0 }}>{T.heroQ}</h2>
            <p className="muted" style={{ fontSize: "12px", marginTop: "-4px", marginBottom: "14px" }}>{T.heroSub}</p>
            {topSig ? (
              <div style={{ background: "var(--surface-container-low)", border: "1px solid rgba(34,197,94,0.4)", borderRadius: "10px", padding: "12px 14px", marginBottom: "12px" }}>
                <div style={{ fontSize: "12px", color: MUTED, marginBottom: "4px" }}>{T.topSigLabel}</div>
                <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-1)", lineHeight: 1.6 }}>
                  {locale === "en" ? (
                    <>
                      <strong>{topSig.name}</strong> is <strong>statistically significantly</strong> associated with {topSig.coef >= 0 ? "raising" : "lowering"} {fit.outcome}
                      {topSig.binary
                        ? <> — when present, {fit.outcome} averaged <strong>{Math.abs(topSig.coef).toFixed(2)}</strong> {topSig.coef >= 0 ? "higher" : "lower"}.</>
                        : <> — each +1 is associated with an average change of <strong>{Math.abs(topSig.coef).toFixed(3)}</strong> {topSig.coef >= 0 ? "upward" : "downward"}.</>}
                    </>
                  ) : (
                    <>
                      <strong>{topSig.name}</strong>은(는) {fit.outcome}을(를) {effDir(topSig.coef)} 방향으로 <strong>통계적으로 유의</strong>하게 연관돼요
                      {topSig.binary
                        ? <> — 있을 때 평균 <strong>{Math.abs(topSig.coef).toFixed(2)}</strong>만큼 {effWord(topSig.coef)}았어요.</>
                        : <> — 1 늘 때마다 평균 <strong>{Math.abs(topSig.coef).toFixed(3)}</strong>만큼 {effWord(topSig.coef)}아져요.</>}
                    </>
                  )}
                </div>
                <div style={{ fontSize: "10.5px", color: MUTED, marginTop: "6px", opacity: 0.85 }} title="two-sided p-value">
                  BH p={topSig.p.toFixed(3)} · 95%CI [{topSig.ciLo.toFixed(3)}, {topSig.ciHi.toFixed(3)}]
                </div>
              </div>
            ) : (
              locale === "en"
                ? <div style={{ fontSize: "13px", color: MUTED, marginBottom: "12px" }} dangerouslySetInnerHTML={{ __html: T.noSigHtml }} />
                : <div style={{ fontSize: "13px", color: MUTED, marginBottom: "12px" }}>이 데이터에서는 <strong>통계적으로 유의한 요소가 없어요</strong>. 표본을 늘리거나 다른 요소를 넣어보세요(무유의 = 효과 없음이 아니라 <em>증거 부족</em>).</div>
            )}
            <div className="callout warn" style={{ margin: 0 }}>
              <div className="ico">⚠</div>
              <div className="body">
                <strong>{T.causationTitle}</strong>
                <p style={{ margin: ".25rem 0 0" }} dangerouslySetInnerHTML={{ __html: T.causationBody }} />
              </div>
            </div>
          </section>

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
