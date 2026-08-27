"use client";
import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import Papa from "papaparse";
import Chart from "@/utils/chartGlobals";
import { useAppStore } from "@/store/useDataStore";
import { INCR_MATH, parseHoldoutGroup } from "@/utils/incrMath";
import { INCR_PREPOST, INCR_PREPOST_CONTRACT, normalizeIncrDate } from "@/utils/incrPrePostMath";
import { getMappedRows } from "@/utils/dashboardAggregator";
import { fmtCurrency, fmtNum, fmtPct } from "@/utils/format";
import { CHART_THEME, getCssVar } from "@/utils/chartUtils";
import CsvGuide from "@/components/ds/CsvGuide";
import ResultActionCard from "@/components/ds/ResultActionCard";
import AnalysisDetails from "@/components/ds/AnalysisDetails";
import DownloadHub from "@/components/ds/DownloadHub";
import AnalysisBlockedTelemetry from "@/components/data-import/AnalysisBlockedTelemetry";
import { buildResultManifest } from "@/lib/analysis-results/resultManifest";
import { trackProductEvent } from "@/lib/analytics";
import { downloadCsv as dlCsv, downloadText } from "@/utils/download";
import { buildIncrSuppressionDemo, buildIncrPrepostDemo } from "@/utils/demoData";
import { prepareSemanticParallelData } from "@/lib/data-import/prepareSemanticParallelData";
import { prepareCsvParseInput } from "@/lib/data-import/csvParseInput";
import { csvFailureState, csvImportErrorMessage } from "@/lib/data-import/csvImportPolicy";
import { showToast } from "@/utils/toast";

const num = (v) => {
  if (v == null || String(v).trim() === "") return NaN;
  const n = Number(String(v).replace(/[,\s]/g, ""));
  return Number.isFinite(n) ? n : NaN;
};
const looksDate = (v) => {
  const matched = String(v || "").trim().match(/^(\d{4})[-/](\d{1,2})(?:[-/](\d{1,2}))?$/);
  if (!matched) return false;
  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const day = matched[3] == null ? 1 : Number(matched[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
};

// CSV 셀 이스케이프(콤마·따옴표 §7).
const qc = (s) => (/[",\n]/.test(String(s)) ? `"${String(s).replace(/"/g, '""')}"` : String(s));
// 라벨-값 2열 요약 CSV(BOM+CRLF §7). rows=[[label,value],...]
function buildSummaryCsv(header, rows) {
  return "﻿" + [header, ...rows.map((r) => r.map(qc).join(","))].join("\r\n") + "\r\n";
}

function aggregateDailyMetric(rows, dateCol, metricCol) {
  const byDate = new Map();
  for (const row of rows || []) {
    const date = normalizeIncrDate(row?.[dateCol]);
    const value = num(row?.[metricCol]);
    if (!date || !Number.isFinite(value)) continue;
    byDate.set(date, (byDate.get(date) || 0) + value);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value }));
}

function auditSelectedMetricRows(rows, dateCol, metricCol) {
  let invalidRows = 0;
  let invalidDateRows = 0;
  let invalidMetricRows = 0;
  for (const row of rows || []) {
    const hasInvalidDate = !normalizeIncrDate(row?.[dateCol]);
    const hasInvalidMetric = !Number.isFinite(num(row?.[metricCol]));
    if (hasInvalidDate) invalidDateRows += 1;
    if (hasInvalidMetric) invalidMetricRows += 1;
    if (hasInvalidDate || hasInvalidMetric) invalidRows += 1;
  }
  return { rowCount: rows?.length || 0, invalidRows, invalidDateRows, invalidMetricRows };
}

const METHODS_KO = [
  { key: "suppression", label: "① 통제군 (동시 비교)", tip: "★★★ 가장 신뢰 높음" },
  { key: "on", label: "② 신규 켜기 (전후)", tip: "★★ 준실험" },
  { key: "off", label: "③ 종료 (전후)", tip: "★★ 준실험" },
];
const METHODS_EN = [
  { key: "suppression", label: "① Control group (concurrent)", tip: "★★★ Highest confidence" },
  { key: "on", label: "② New launch (pre/post)", tip: "★★ Quasi-experiment" },
  { key: "off", label: "③ Shutdown (pre/post)", tip: "★★ Quasi-experiment" },
];

export default function Incrementality({ locale = "ko" } = {}) {
  const tr = (ko, en) => (locale === "en" ? en : ko);
  const METHODS = locale === "en" ? METHODS_EN : METHODS_KO;
  const csvData = useAppStore((s) => s.csvData);
  const setCsvData = useAppStore((s) => s.setCsvData);
  const clearCsvGroup = useAppStore((s) => s.clearCsvGroup);
  const currency = useAppStore((s) => s.displayCurrency);
  const setDisplayCurrency = useAppStore((s) => s.setDisplayCurrency);
  const [method, setMethod] = useState("suppression");
  const fileRef = useRef(null);
  const hasData = csvData?.raw?.length > 0;
  const selectMethod = useCallback((nextMethod) => {
    setMethod(nextMethod);
    // 방법별 샘플의 열 계약이 다르다. 탭만 바꾸고 이전 샘플을 남기면 다른
    // 방법의 데이터가 그럴듯한 숫자로 해석될 수 있어, 샘플만 안전하게 교체한다.
    if (csvData?.fileName?.startsWith("demo_")) {
      const nextDemo = nextMethod === "suppression" ? buildIncrSuppressionDemo() : buildIncrPrepostDemo(nextMethod);
      if (nextDemo.fileName !== csvData.fileName) setCsvData(nextDemo);
    }
  }, [csvData, setCsvData]);
  const onMethodKeyDown = useCallback((event, methodKey) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const keys = METHODS.map((item) => item.key);
    const current = keys.indexOf(methodKey);
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? keys.length - 1
        : (current + (event.key === "ArrowRight" ? 1 : -1) + keys.length) % keys.length;
    const nextMethod = keys[nextIndex];
    selectMethod(nextMethod);
    window.requestAnimationFrame(() => document.getElementById(`incrementality-tab-${nextMethod}`)?.focus());
  }, [METHODS, selectMethod]);

  const handleFile = async (file) => {
    if (!file) return;
    trackProductEvent("data_import_start", { tool_id: "5-23", source: "csv", locale });
    let parseInput;
    try {
      parseInput = await prepareCsvParseInput(file);
    } catch (error) {
      trackProductEvent("data_import_failed", { tool_id: "5-23", source: "csv", state: csvFailureState(error), locale });
      showToast({ variant: "error", title: locale === "en" ? "CSV upload failed" : "CSV 업로드 실패", body: csvImportErrorMessage(error?.code, locale) });
      return;
    }
    Papa.parse(parseInput, {
      header: true, skipEmptyLines: true,
      complete: (res) => {
        const rows = Array.isArray(res.data) ? res.data : [];
        const headers = res.meta?.fields || [];
        if (!rows.length) {
          trackProductEvent("data_import_failed", { tool_id: "5-23", source: "csv", state: "empty_file", locale });
          return;
        }
        const hasFatalParseError = (res.errors || []).some((error) =>
          error?.type === "Quotes"
          || error?.type === "Delimiter"
          || error?.type === "Abort"
          || error?.code === "TooManyFields");
        if (hasFatalParseError) {
          trackProductEvent("data_import_failed", { tool_id: "5-23", source: "csv", state: "parse_error", locale });
          return;
        }
        const mapping = {}; headers.forEach((h) => { mapping[h] = h; });
        setCsvData({ raw: rows, headers, mapping, fileName: file.name, workspaceSource: { blob: file.slice(), kind: "csv", originalFileName: file.name }, ...prepareSemanticParallelData({ raw: rows, headers }) });
        trackProductEvent("data_import_success", { tool_id: "5-23", source: "csv", row_count: rows.length, column_count: headers.length, locale });
      },
      error: () => trackProductEvent("data_import_failed", { tool_id: "5-23", source: "csv", state: "parse_error", locale }),
    });
  };
  const loadDemo = () => {
    if (method === "suppression") setCsvData(buildIncrSuppressionDemo());
    else setCsvData(buildIncrPrepostDemo(method));
  };
  const resetCsv = () => clearCsvGroup();
  const isDemo = !!(csvData?.fileName && csvData.fileName.startsWith("demo_"));

  // 자동 로드하지 않는다. 도구에 들어가자마자 샘플 분석 화면이 뜨면 "내 데이터를
  // 올리는 곳"이라는 사실이 가려지고, 화면의 숫자가 내 것인지 예시인지도 헷갈린다.
  // 예시는 업로드 안내(CsvGuide)의 "예시로 보기"로 명시적으로 부른다.

  return (
    <div className="tab-pane active" id="tab-incr">
      {/* 방법 선택을 첫 행동으로 올리고, 비교 설명은 필요할 때만 펼친다. */}
      <section className="block" id="s-incr-method" style={{ background: "linear-gradient(135deg, rgba(122,162,247,0.12), rgba(192,132,252,0.05))", border: "1px solid rgba(122,162,247,0.25)", borderRadius: "14px", padding: "18px 20px", marginBottom: "16px" }}>
        <h2 className="section-title" style={{ marginTop: 0, marginBottom: "6px" }}>{tr("광고를 켠 것(혹은 끈 것)이 진짜 얼마를 만들었나?", "How much did turning ads on (or off) actually create?")}</h2>
        <p style={{ fontSize: "12.5px", color: "var(--text-secondary)", margin: 0, lineHeight: 1.6, maxWidth: "680px" }}>
          {tr(<>광고가 없어도 생겼을 성과를 빼고 <strong>순수 증분</strong>만 봅니다. 지금 가진 데이터 형태를 고르세요.</>,
            <>Subtract outcomes that would have happened without ads and measure <strong>net incrementality</strong>. Choose the data shape you have.</>)}
        </p>
        <details style={{ marginTop: "9px", color: "var(--text-muted)", fontSize: "11.5px" }}>
          <summary style={{ cursor: "pointer" }}>{tr("세 방법의 차이 보기", "Compare the three methods")}</summary>
          <p style={{ margin: "7px 0 0", lineHeight: 1.55 }}>
            {tr("통제군은 같은 기간의 노출·미노출을 비교해 가장 강합니다. 신규 켜기와 종료는 전후를 비교하며, 대조군이 있으면 계절·추세를 더 잘 분리합니다.", "Control groups compare exposed and unexposed users concurrently and provide the strongest design. Launch and shutdown compare before/after; a control group helps separate seasonality and trend.")}
          </p>
        </details>
      </section>

      {/* 방법 탭 */}
      <div className="ab-tabs" role="tablist" aria-label={tr("증분 분석 방법", "Incrementality methods")} style={{ marginBottom: "8px" }}>
        {METHODS.map((m) => (
          <button
            key={m.key}
            type="button"
            id={`incrementality-tab-${m.key}`}
            role="tab"
            aria-selected={method === m.key}
            aria-controls="incrementality-method-panel"
            tabIndex={method === m.key ? 0 : -1}
            className={`ab-tab ${method === m.key ? "active" : ""}`}
            onClick={() => selectMethod(m.key)}
            onKeyDown={(event) => onMethodKeyDown(event, m.key)}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div
        id="incrementality-method-panel"
        role="tabpanel"
        aria-labelledby={`incrementality-tab-${method}`}
        tabIndex={0}
      >
      <p style={{ fontSize: "11.5px", color: "var(--text-muted)", margin: "0 0 12px", lineHeight: 1.5 }}>
        {method === "suppression" && tr("같은 기간, 무작위로 광고를 차단한 홀드아웃 그룹 vs 노출 그룹을 비교합니다. 무작위 분할이면 인과 신뢰가 가장 높습니다.", "Compares a holdout group (ads randomly blocked) vs an exposed group over the same period. Random assignment gives the highest causal confidence.")}
        {method === "on" && tr("안 하던 광고/캠페인을 켠 시점(cutoff) 전후를 비교합니다. 대조군으로 공통 변화를 보정하되, 개입 전 평행추세를 통과해야 DiD 결과를 냅니다.", "Compares before/after the moment (cutoff) you turned on an ad/campaign that wasn't running. A control adjusts for common change, but DiD is reported only after the pre-intervention parallel-trends check passes.")}
        {method === "off" && tr("켜뒀던 광고/캠페인을 끈 시점(cutoff) 전후를 비교합니다. 대조군 DiD도 개입 전 평행추세를 통과해야 결과를 냅니다.", "Compares before/after the moment (cutoff) you turned off a running ad/campaign. Control-group DiD is reported only after the pre-intervention parallel-trends check passes.")}
      </p>

      {!hasData ? (
        <UploadPanel method={method} fileRef={fileRef} handleFile={handleFile} loadDemo={loadDemo} locale={locale} />
      ) : (
        <div>
          {isDemo && (
            <div className="required-banner" style={{ borderLeftColor: "var(--warning)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
              <div>
                <strong>{tr("🧪 지금 보고 있는 화면은 샘플(예시) 데이터입니다", "🧪 You're currently viewing sample (example) data")}</strong>
                <p style={{ margin: "0.25rem 0 0" }}>{tr("실제 내 데이터가 아니며, 서버로 전송되지 않습니다. 내 CSV를 업로드하면 바로 교체됩니다.", "This isn't your real data, and nothing is sent to any server. Upload your own CSV to replace it instantly.")}</p>
              </div>
              <button className="ab-button" onClick={resetCsv}>{tr("📁 내 CSV 업로드하기", "📁 Upload my CSV")}</button>
            </div>
          )}
          <div className="file-state" style={{ marginBottom: "12px" }}>
            <div className="meta-text">
              <span className="dot" style={{ background: isDemo ? "#f59e0b" : "#22c55e" }}></span>
              {isDemo ? <strong>{tr("샘플 데이터로 미리보기 중", "Previewing with sample data")}</strong> : <strong>{csvData.fileName}</strong>}
              <span className="csv-loaded-stats tnum">{csvData.raw.length.toLocaleString()}{tr("행", " rows")}{isDemo ? tr(" · 실제 데이터 아님", " · not real data") : ""}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{tr("통화", "Currency")}</span>
              <button className={`ab-pill ${currency === "KRW" ? "active" : ""}`} onClick={() => setDisplayCurrency("KRW")}>₩</button>
              <button className={`ab-pill ${currency === "USD" ? "active" : ""}`} onClick={() => setDisplayCurrency("USD")}>$</button>
              {!isDemo && <button className="ab-pill csv-change-btn" onClick={resetCsv}>{tr("⟳ CSV 변경", "⟳ Change CSV")}</button>}
            </div>
          </div>
          {method === "suppression"
            ? <SuppressionView csvData={csvData} currency={currency} locale={locale} />
            : <PrePostView key={method} csvData={csvData} direction={method} currency={currency} locale={locale} />}
        </div>
      )}
    </div>
    </div>
  );
}

function UploadPanel({ method, fileRef, handleFile, loadDemo, locale = "ko" }) {
  const tr = (ko, en) => (locale === "en" ? en : ko);
  const isSup = method === "suppression";
  const tmpl = isSup
    ? { base: "template_incr_suppression", text: "date,holdout_group,numerator,denominator,spend,revenue_d7\r\n2024-05-01,exposed,516,8600,1548000,16512000\r\n2024-05-01,holdout,378,8600,0,12096000\r\n" }
    : { base: "template_incr_prepost", text: "date,group,conversions\r\n2024-04-01,treatment,100\r\n2024-04-01,control,90\r\n2024-05-20,treatment,155\r\n2024-05-20,control,92\r\n" };
  return (
    <>
      <CsvGuide toolId={`5-23:${method}`} onDownloadTemplate={() => dlCsv("﻿" + tmpl.text, tmpl.base)} onTryExample={loadDemo} locale={locale} />
      <div className="csv-dropzone" role="button" tabIndex={0} aria-label={tr("증분 분석 CSV 파일 선택", "Choose an incrementality CSV file")} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]); }} onClick={() => fileRef.current?.click()} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileRef.current?.click(); } }} style={{ cursor: "pointer" }}>
        <div className="csv-drop-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
        </div>
        <div className="csv-drop-text">{tr("CSV 파일 드래그 & 드롭", "Drag & drop CSV file")}</div>
        <div className="csv-drop-sub">{tr("또는 클릭하여 파일 선택", "or click to select a file")}</div>
        <input type="file" accept=".csv,text/csv" style={{ display: "none" }} ref={fileRef} onClick={(e) => e.stopPropagation()} onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = null; }} />
      </div>
    </>
  );
}

/* ── ① 통제군 (suppression) ── */
function SuppressionView({ csvData, currency, locale = "ko" }) {
  const tr = useCallback((ko, en) => (locale === "en" ? en : ko), [locale]);
  const invalidRows = useMemo(() => getMappedRows(csvData).filter((r) => {
    const group = parseHoldoutGroup(r.holdout_group);
    const numerator = num(r.numerator);
    const denominator = num(r.denominator);
    return !looksDate(r.date) || group == null || !Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0 || numerator < 0 || numerator > denominator;
  }).length, [csvData]);
  // 날짜별 그룹 집계 (전환율·모수·비용·매출)
  const series = useMemo(() => {
    const rows = getMappedRows(csvData);
    const hasDate = rows.some((r) => looksDate(r.date));
    if (!hasDate) return null;
    const byDate = new Map();
    rows.forEach((r) => {
      if (!looksDate(r.date)) return;
      const g = parseHoldoutGroup(r.holdout_group);
      if (g !== "control" && g !== "test") return;
      const d = normalizeIncrDate(r.date);
      if (!d) return;
      if (!byDate.has(d)) byDate.set(d, { exp: { n: 0, d: 0, s: 0, rev: 0 }, hold: { n: 0, d: 0, s: 0, rev: 0 } });
      const slot = byDate.get(d)[g === "test" ? "exp" : "hold"];
      slot.n += num(r.numerator) || 0; slot.d += num(r.denominator) || 0;
      slot.s += num(r.spend) || 0; slot.rev += num(r.revenue_d7 ?? r.revenue) || 0;
    });
    const labels = [...byDate.keys()].sort();
    if (labels.length < 2) return null;
    const cell = (d, k) => byDate.get(d)[k];
    return {
      labels,
      expRate: labels.map((d) => { const s = cell(d, "exp"); return s.d > 0 ? (s.n / s.d) * 100 : null; }),
      holdRate: labels.map((d) => { const s = cell(d, "hold"); return s.d > 0 ? (s.n / s.d) * 100 : null; }),
      byDate,
    };
  }, [csvData]);

  // 전체 그룹 존재 여부(창 무관)
  const totals = useMemo(() => {
    const rows = getMappedRows(csvData);
    let cDen = 0, tDen = 0;
    rows.forEach((r) => {
      const g = parseHoldoutGroup(r.holdout_group);
      if (g === "control") cDen += num(r.denominator) || 0;
      else if (g === "test") tDen += num(r.denominator) || 0;
    });
    return { cDen, tDen };
  }, [csvData]);

  const [winStart, setWinStart] = useState("");
  const [winEnd, setWinEnd] = useState("");
  const start = winStart;
  const end = winEnd;
  const hasExplicitWindow = !!start && !!end;
  const isWindowOrderValid = hasExplicitWindow && start <= end;

  // 창 기간 내 집계 → 증분 (창 밖 pre/post는 균형 확인용)
  const win = useMemo(() => {
    if (!series || !isWindowOrderValid) return null;
    const { labels, byDate } = series;
    let cN = 0, cD = 0, tN = 0, tD = 0, sp = 0, rv = 0;      // 창 내
    let preExpN = 0, preExpD = 0, preHoldN = 0, preHoldD = 0; // 창 전(균형 확인)
    labels.forEach((d) => {
      const e = byDate.get(d).exp, h = byDate.get(d).hold;
      if (d >= start && d <= end) {
        tN += e.n; tD += e.d; sp += e.s; rv += e.rev;
        cN += h.n; cD += h.d;
      } else if (d < start) {
        preExpN += e.n; preExpD += e.d; preHoldN += h.n; preHoldD += h.d;
      }
    });
    if (cD <= 0 || tD <= 0) return null;
    const incr = INCR_MATH.compute({ num: tN, den: tD, spend: sp, rev: rv > 0 ? rv : null }, { num: cN, den: cD });
    const preExp = preExpD > 0 ? (preExpN / preExpD) * 100 : null;
    const preHold = preHoldD > 0 ? (preHoldN / preHoldD) * 100 : null;
    const preDiff = (preExp != null && preHold != null) ? preExp - preHold : null;
    const balanced = preDiff != null ? Math.abs(preDiff) < 0.5 : null; // 0.5%p 이내면 균형
    return { incr, cN, cD, tN, tD, sp, preExp, preHold, preDiff, balanced, hasPre: preExpD > 0 };
  }, [series, start, end, isWindowOrderValid]);

  const chartInst = useRef(null);
  useEffect(() => {
    if (chartInst.current) { chartInst.current.destroy(); chartInst.current = null; }
    if (!series || !isWindowOrderValid) return;
    const ctx = document.getElementById("incr-suppression-chart"); if (!ctx) return;
    const { labels, expRate, holdRate } = series;
    const sIdx = labels.indexOf(start), eIdx = labels.indexOf(end);
    // 홀드아웃 시작·종료 세로선 (inline 플러그인)
    const markerPlugin = {
      id: "holdoutMarkers",
      afterDatasetsDraw(chart) {
        const { ctx: c, chartArea, scales } = chart; const x = scales.x; if (!x) return;
        [[sIdx, tr("홀드아웃 시작", "Holdout start")], [eIdx, tr("홀드아웃 종료", "Holdout end")]].forEach(([i, lab]) => {
          if (i == null || i < 0) return;
          const px = x.getPixelForValue(i);
          c.save();
          c.strokeStyle = "#f59e0b"; c.setLineDash([4, 4]); c.lineWidth = 1.5;
          c.beginPath(); c.moveTo(px, chartArea.top); c.lineTo(px, chartArea.bottom); c.stroke();
          c.setLineDash([]); c.fillStyle = "#f59e0b"; c.font = "10px sans-serif";
          c.fillText(lab, Math.min(px + 3, chartArea.right - 60), chartArea.top + 11);
          c.restore();
        });
      },
    };
    chartInst.current = new Chart(ctx, {
      type: "line",
      data: { labels, datasets: [
        { label: tr("노출 그룹(광고 봄)", "Exposed group (saw ads)"), data: expRate, borderColor: CHART_THEME.secondary, backgroundColor: "transparent", pointRadius: 0, borderWidth: 2, tension: 0.15 },
        { label: tr("홀드아웃(광고 차단)", "Holdout (ads blocked)"), data: holdRate, borderColor: getCssVar("--text-muted"), backgroundColor: "transparent", pointRadius: 0, borderWidth: 2, borderDash: [5, 4], tension: 0.15 },
      ] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: CHART_THEME.text } }, tooltip: { callbacks: { label: (cx) => `${cx.dataset.label}: ${cx.parsed.y != null ? cx.parsed.y.toFixed(2) + "%" : "—"}` } } },
        scales: {
          x: { ticks: { color: CHART_THEME.muted, autoSkip: true, maxTicksLimit: 10 }, grid: { color: getCssVar("--border") } },
          y: { ticks: { color: CHART_THEME.muted, callback: (v) => v + "%" }, grid: { color: getCssVar("--border") }, title: { display: true, text: tr("전환율", "Conversion rate"), color: CHART_THEME.muted } },
        },
      },
      plugins: [markerPlugin],
    });
    requestAnimationFrame(() => chartInst.current && chartInst.current.resize());
    return () => { if (chartInst.current) { chartInst.current.destroy(); chartInst.current = null; } };
  }, [series, start, end, isWindowOrderValid, tr]);

  if (invalidRows) return <div className="callout warn"><div className="ico">!</div><div className="body"><strong>{tr("증분을 계산할 수 없는 행이 있습니다", "Some rows cannot be used for incrementality")}</strong><p>{tr(`${invalidRows.toLocaleString()}행의 날짜·그룹·전환수·분모를 확인하세요. 날짜는 실제 달력 날짜여야 하며, 전환수는 0 이상 분모 이하여야 하고 분모는 0보다 커야 합니다.`, `Check date, group, conversions, and denominator in ${invalidRows.toLocaleString()} row(s). Dates must be valid calendar dates; conversions must be between 0 and the denominator, and the denominator must be greater than 0.`)}</p></div></div>;
  if (totals.cDen <= 0 || totals.tDen <= 0) return <div className="callout warn"><div className="ico">!</div><div className="body"><strong>{tr("노출(exposed)·홀드아웃(holdout) 양쪽 데이터가 필요합니다", "Both exposed and holdout data are required")}</strong><p>{tr("holdout_group 컬럼에 두 그룹이 모두 있어야 증분을 계산합니다.", "The holdout_group column must contain both groups to calculate incrementality.")}</p></div></div>;

  const r = win?.incr;
  const inc = r ? Math.round(r.incrementalConv) : 0;
  const positive = r ? r.incrementalConv > 0 : false;

  // 결론 카드 props + 다운로드(계산된 인사이트만). 엔진 결과 재사용.
  const card = r && (() => {
    // CI가 0을 걸치면 확정 서술을 하지 않는다. 무유의는 "효과 없음"의 증거가 아니라
    // 현재 표본에서의 판단 보류다(§8.6, 감사 P1-1).
    const headline = !r.conclusive
      ? tr(
          `증분 추정치는 ${fmtNum(inc)}건이지만 95% 신뢰구간이 0을 지나 판단을 보류합니다 — 표본이 더 필요합니다.`,
          `The point estimate is ${fmtNum(inc)} incremental conversions, but the 95% CI crosses zero — inconclusive; more sample is needed.`
        )
      : positive
      ? tr(
          `광고가 실제로 만든 증분 전환은 ${fmtNum(inc)}건입니다${r.iroas != null ? ` (iROAS ${r.iroas.toFixed(2)}×)` : ""}.`,
          `Ads actually created ${fmtNum(inc)} incremental conversions${r.iroas != null ? ` (iROAS ${r.iroas.toFixed(2)}×)` : ""}.`
        )
      : tr(
          "홀드아웃 대비 증분이 통계적으로 음수입니다 — 이 기간 광고의 순증분 효과가 확인되지 않습니다.",
          "Incrementality vs. holdout is statistically negative — no net incremental ad effect is confirmed for this period."
        );
    const points = [];
    if (!r.conclusive) points.push({ cls: "muted", text: tr("‘효과 없음’이 아니라 ‘아직 판단할 수 없음’입니다 — 기간을 늘리거나 홀드아웃 규모를 키우세요.", "This is 'not yet decidable', not 'no effect' — extend the period or increase the holdout size.") });
    if (win.balanced === false) points.push({ cls: "bad", text: tr("홀드아웃 前 두 그룹이 이미 벌어져 있어 균형이 의심됩니다 — 증분이 왜곡됐을 수 있습니다.", "The two groups already differed before the holdout — balance is questionable and incrementality may be distorted.") });
    else if (win.balanced) points.push({ cls: "good", text: tr("홀드아웃 前 두 그룹이 균형이라 비교가 타당합니다.", "The groups were balanced before the holdout, so the comparison is valid.") });
    if (r.iroas != null) points.push({ text: win.balanced === false
      ? tr("그룹 불균형으로 iROAS를 확대 근거로 쓰지 말고 실험을 재설계하세요.", "Do not use iROAS to justify scaling while the groups are imbalanced; redesign the experiment.")
      : win.balanced
        ? r.iroas >= 1
          ? tr("증분 매출이 광고비보다 큽니다. 확대 전 같은 설계의 후속 홀드아웃으로 재검증하세요.", "Incremental revenue exceeds ad spend. Revalidate with a follow-up holdout using the same design before scaling.")
          : tr("증분 기준 광고비가 매출보다 큽니다. 같은 설계의 후속 홀드아웃으로 재검증하세요.", "Ad spend exceeds incremental revenue. Revalidate with a follow-up holdout using the same design.")
        : tr("사전 균형을 확인할 수 없어 iROAS를 운영 행동 근거로 쓰지 않습니다.", "Pre-period balance is unavailable, so iROAS should not drive an operating action.") });
    points.push({ cls: "muted", text: tr("무작위 분할이 아니면 인과로 단정하지 마세요.", "Don't assert causality unless this was a random split.") });
    const stats = [
      { label: tr("증분 전환", "Incremental conv."), value: fmtNum(inc) },
      { label: tr("상대 Lift", "Relative lift"), value: r.liftRel != null ? fmtPct(r.liftRel) : "—" },
    ];
    if (r.ciLow95 != null && r.ciHigh95 != null)
      stats.push({ label: tr("전환율 차이 95% CI", "Conv.-rate diff 95% CI"), value: `${fmtPct(r.ciLow95)} ~ ${fmtPct(r.ciHigh95)}` });
    if (r.pValue != null) stats.push({ label: "p", value: r.pValue < 0.001 ? "<0.001" : r.pValue.toFixed(3) });
    if (r.cpia != null) stats.push({ label: tr("증분 전환당 비용", "Cost/incr. conv."), value: fmtCurrency(r.cpia, { currency }) });
    if (r.iroas != null) stats.push({ label: "iROAS", value: `${r.iroas.toFixed(2)}×` });

    const csvRows = [
      [tr("홀드아웃 전환율", "Holdout conversion rate"), fmtPct(r.cRate)],
      [tr("노출 전환율", "Exposed conversion rate"), fmtPct(r.tRate)],
      [tr("상대 Lift", "Relative lift"), r.liftRel != null ? fmtPct(r.liftRel) : "—"],
      [tr("증분 전환", "Incremental conversions"), inc],
      [tr("증분 전환당 비용", "Cost per incremental conversion"), r.cpia != null ? fmtCurrency(r.cpia, { currency }) : "—"],
      ["iROAS", r.iroas != null ? `${r.iroas.toFixed(2)}×` : "—"],
      [tr("홀드아웃 기간", "Holdout period"), `${start} ~ ${end}`],
      [tr("그룹 균형(홀드아웃 前)", "Group balance (pre-holdout)"), win.balanced == null ? "—" : win.balanced ? tr("균형", "balanced") : tr("불균형 의심", "imbalance suspected")],
    ];
    const csv = buildSummaryCsv(tr("지표,값", "Metric,Value"), csvRows);
    const text =
      tr("# 증분 분석 — 통제군(홀드아웃) 요약\n\n", "# Incrementality — Control-group (holdout) summary\n\n") +
      `${headline}\n\n` +
      csvRows.map(([k, v]) => `- ${k}: ${v}`).join("\n") + "\n\n" +
      points.map((p) => `- ${p.text}`).join("\n") + "\n";
    // 판단 보류는 good도 bad도 아니다 — 회색(neutral)으로 두어 배지와 헤드라인이 모순되지 않게 한다(claude-ux §4).
    return { tone: !r.conclusive ? "neutral" : positive ? "good" : "bad", headline, points, stats, csv, text };
  })();
  const decisionSourcePeriod = r ? `${start} ~ ${end}` : "";
  const decisionMetric = Number.isFinite(r?.iroas) ? "iROAS" : tr("증분 전환", "Incremental conversions");
  const decisionBaseline = Number.isFinite(r?.iroas)
    ? `${r.iroas.toFixed(2)}×`
    : Number.isFinite(r?.incrementalConv) ? fmtNum(inc) : "";
  // 홀드아웃 전 균형 판정이 있을 때만 도구가 명시한 안전한 초안을 제공한다.
  // 균형 미확인은 실행 가능한 근거로 추론하지 않으며, 불균형은 확대 대신 재설계한다.
  const decisionPrefill = r && win?.balanced != null && decisionSourcePeriod
    ? win.balanced
      ? {
          conclusion: tr(
            `${decisionSourcePeriod}의 사전 균형 확인 홀드아웃에서 ${decisionMetric} ${decisionBaseline}이 관측됐습니다. 무작위 배정이 확인되기 전에는 인과효과로 확정하지 않습니다.`,
            `The balanced pre-period holdout for ${decisionSourcePeriod} observed ${decisionMetric} of ${decisionBaseline}. Do not treat it as a confirmed causal effect unless random assignment is verified.`,
          ),
          action: tr(
            `같은 대상에서 무작위 홀드아웃을 제한적으로 반복해 ${decisionMetric} 방향을 재검증한다`,
            `Run a limited randomized holdout with the same audience to revalidate the direction of ${decisionMetric}`,
          ),
          hypothesis: tr(
            `후속 무작위 홀드아웃에서도 ${decisionMetric}가 현재 기준값과 같은 방향으로 재현될 것이다`,
            `A follow-up randomized holdout should reproduce the direction of ${decisionMetric} versus the current baseline`,
          ),
          metric: decisionMetric,
          baseline: decisionBaseline,
          sourcePeriod: decisionSourcePeriod,
          reviewQuestion: tr(
            `후속 홀드아웃에서 사전 균형이 다시 확인됐고 ${decisionMetric} 방향이 재현됐는가?`,
            `Did the follow-up holdout confirm pre-period balance again and reproduce the direction of ${decisionMetric}?`,
          ),
        }
      : {
          conclusion: tr(
            `${decisionSourcePeriod} 홀드아웃은 시작 전 그룹 불균형으로 현재 증분값을 확대 근거로 사용할 수 없습니다.`,
            `The ${decisionSourcePeriod} holdout had pre-period group imbalance, so its incremental estimate must not be used to justify scaling.`,
          ),
          action: tr(
            "확대하지 않고 무작위 배정과 사전 균형 기준을 먼저 고정해 홀드아웃 실험을 재설계한다",
            "Do not scale; redesign the holdout with random assignment and a pre-specified balance rule",
          ),
          hypothesis: tr(
            "재설계한 홀드아웃에서 시작 전 그룹 균형이 확인되면 증분 추정의 왜곡 위험이 줄어들 것이다",
            "Confirming pre-period balance in the redesigned holdout should reduce the risk of a distorted incremental estimate",
          ),
          metric: tr("홀드아웃 사전 균형", "Pre-holdout balance"),
          baseline: "",
          sourcePeriod: decisionSourcePeriod,
          reviewQuestion: tr(
            "재설계한 실험에서 시작 전 그룹 균형이 확인된 뒤 증분 방향이 재현됐는가?",
            "Did the redesigned experiment confirm pre-period balance before reproducing the incremental direction?",
          ),
        }
    : null;
  const blockedState = !hasExplicitWindow
    ? "missing_analysis_window"
    : !isWindowOrderValid
      ? "invalid_analysis_window"
      : !card
        ? "insufficient_data"
        : null;

  return (
    <section className="block" id="s-incr-result">
      {blockedState && (
        <AnalysisBlockedTelemetry
          toolId="5-23"
          source={csvData?.fileName?.startsWith("demo_") ? "demo" : csvData?.importSource || "csv"}
          state={blockedState}
          signature={`suppression|${series?.labels.indexOf(start) ?? -1}|${series?.labels.indexOf(end) ?? -1}|${csvData?.raw?.length || 0}`}
          rowCount={csvData?.raw?.length || 0}
          analysisType="incrementality"
          locale={locale}
        />
      )}
      <h2 className="section-title">{tr("홀드아웃 기간 설정 및 결과", "Holdout period setup and result")}</h2>

      {series && (
        <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", alignItems: "flex-end", marginBottom: "12px" }}>
          <Field label={tr("홀드아웃 시작일", "Holdout start date")}>
            <select className="map-select" value={start} onChange={(e) => { const next = e.target.value; setWinStart(next); if (winEnd && winEnd < next) setWinEnd(""); }}>
              <option value="">{tr("운영 기록에서 선택", "Select from experiment record")}</option>
              {series.labels.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </Field>
          <Field label={tr("홀드아웃 종료일", "Holdout end date")}>
            <select className="map-select" value={end} onChange={(e) => setWinEnd(e.target.value)} disabled={!start}>
              <option value="">{tr("운영 기록에서 선택", "Select from experiment record")}</option>
              {series.labels.filter((d) => !start || d >= start).map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </Field>
          <span style={{ fontSize: "11px", color: "var(--text-muted)", maxWidth: "440px", lineHeight: 1.5 }}>{tr("실험 계획이나 광고 운영 기록에 적힌 실제 차단 기간을 직접 지정해야 계산합니다.", "The calculation only runs after you enter the actual blocked period from the experiment plan or ad-operations record.")}</span>
        </div>
      )}

      {!hasExplicitWindow && (
        <div className="callout warn" style={{ marginBottom: "12px" }}><div className="ico">!</div><div className="body"><strong>{tr("홀드아웃 기간을 먼저 지정하세요", "Specify the holdout period first")}</strong><p>{tr("결과 그래프에서 차이가 큰 구간을 보고 기간을 고르면 효과가 과대평가될 수 있습니다. 결과를 보기 전 정한 시작일·종료일만 사용합니다.", "Choosing the period after inspecting where the outcome lines diverge can overstate the effect. Use only start and end dates defined before viewing the result.")}</p></div></div>
      )}

      {hasExplicitWindow && !isWindowOrderValid && (
        <div className="callout warn" style={{ marginBottom: "12px" }}><div className="ico">!</div><div className="body"><strong>{tr("종료일은 시작일과 같거나 뒤여야 합니다", "The end date must be on or after the start date")}</strong></div></div>
      )}

      {card && (
        <ResultActionCard
          toolId="5-23"
          locale={locale}
          analysisKey={`suppression|${csvData.raw?.length || 0}|${csvData.headers?.length || 0}|${series?.labels.indexOf(start) ?? -1}|${series?.labels.indexOf(end) ?? -1}`}
          analysisType="incrementality"
          resultState="ready"
          trackAnalysisStart
          tone={card.tone}
          title={tr("결론 — 광고가 만든 순증분", "Conclusion — net incremental from ads")}
          headline={card.headline}
          points={card.points}
          stats={card.stats}
          workbookExport={() => ({
            calculationMode: "exact_after_preprocessing",
            calculationTables: [{
              name: "HOLDOUT_INCREMENTALITY",
              title: tr("홀드아웃 증분 계산", "Holdout incrementality calculation"),
              note: tr("그룹·기간 집계 입력에서 전환율·반사실·증분·iROAS를 수식으로 재현", "Recalculates rates, counterfactual, incrementality, and iROAS from grouped period inputs"),
              rows: [
                ["control_conversions_input", "control_denominator_input", "exposed_conversions_input", "exposed_denominator_input", "exposed_spend_input", "exposed_revenue_input", "control_rate", "exposed_rate", "counterfactual_conversions", "incremental_conversions", "relative_lift", "incremental_revenue", "cost_per_incremental_conversion", "iroas"],
                [
                  win.cN, win.cD, win.tN, win.tD, win.sp || 0, Number.isFinite(win.incr?.incrementalRev) && Math.abs(win.incr?.incrementalConv || 0) > 1e-12 && win.tN > 0 ? (win.incr.incrementalRev / win.incr.incrementalConv) * win.tN : 0,
                  { formula: "=IFERROR(A2/B2,0)", numberFormat: "0.00%" },
                  { formula: "=IFERROR(C2/D2,0)", numberFormat: "0.00%" },
                  { formula: "=D2*G2" },
                  { formula: "=C2-I2" },
                  { formula: "=IFERROR(H2/G2-1,0)", numberFormat: "0.0%" },
                  { formula: "=IFERROR(J2*(F2/C2),0)" },
                  { formula: "=IFERROR(E2/J2,0)" },
                  { formula: "=IFERROR(L2/E2,0)" },
                ],
              ],
            }],
            method: {
              name: "control-group-holdout",
              version: "incrementality-suppression",
              assumptions: [tr("그룹·홀드아웃 기간 집계는 브라우저 분석 시점의 전처리 입력입니다.", "Group and holdout-window totals are preprocessing inputs from the browser analysis.")],
              limitations: [tr("무작위 배정이 아니면 인과효과로 확정할 수 없습니다. 신뢰구간·유의성은 브라우저 엔진 출력입니다.", "Without random assignment, this cannot confirm a causal effect. Confidence intervals and significance are browser-engine outputs.")],
            },
          })}
          decisionReview={Boolean(decisionPrefill)}
          decisionPrefill={decisionPrefill}
          analysisDetails={
            <AnalysisDetails
              locale={locale}
              statusLabel={win.balanced === false ? tr("균형 주의", "Balance concern") : win.balanced ? tr("균형 확인", "Balanced") : tr("판정 보류", "Inconclusive")}
              statusTone={win.balanced === false ? "bad" : win.balanced ? "good" : "neutral"}
              metric={tr("증분 전환", "Incremental conversions")}
              unit={tr("전환 건수", "Conversion count")}
              meaning={tr("홀드아웃 대비 차이 — 일반 어트리뷰션이 아님", "Difference vs. holdout — not standard attribution")}
              sampleSize={{ label: tr("비교 분모", "Comparison denominator"), value: win.cD + win.tD, detail: tr("홀드아웃 + 노출 그룹", "Holdout + exposed groups") }}
              scope={`${start} ~ ${end}`}
              method={tr("통제군 홀드아웃", "Control-group holdout")}
              version="incrementality-suppression"
              cachePolicy={tr("브라우저 메모리 전용", "In-memory browser cache only")}
              warnings={[
                ...(win.balanced === false ? [tr("홀드아웃 전 그룹 균형이 맞지 않아 증분값이 왜곡될 수 있습니다.", "Pre-holdout group balance is questionable; incrementality may be distorted.")] : []),
                tr("사전 MDE·검정력이 없으면 증분 결과의 검정력을 역산하지 않습니다. 증거 수준은 균형·기간·효과 방향을 함께 읽으세요.", "Without a pre-specified MDE and target power, post-hoc power is not back-calculated. Read the evidence level from balance, window, and effect direction together."),
              ]}
            />
          }
          download={
            <DownloadHub
              toolId="5-23"
              locale={locale}
              label={tr("결과 받기", "Download")}
              align="right"
              manifest={buildResultManifest({
                toolId: "5-23",
                mode: "holdout",
                source: csvData?.fileName?.startsWith("demo_") ? "demo" : "csv",
                inputSignature: `${csvData?.fileName || "dataset"}|${csvData?.raw?.length || 0}`,
                filter: { start, end },
                grain: "holdout-period",
                metricDefinitions: ["incremental", "lift", "iROAS"].map((key) => ({ key })),
                engineVersion: "incrementality-suppression",
                status: "COMPLETE",
                warnings: win.balanced === false ? ["Pre-holdout balance is questionable"] : [],
              })}
              items={[
                { icon: "📄", analyticsType: "csv", label: tr("증분 요약 (CSV)", "Summary (CSV)"), desc: tr("전환율·Lift·증분·iROAS", "Rates, lift, incremental, iROAS"), onSelect: () => dlCsv(card.csv, "incrementality_suppression") },
                { icon: "📝", analyticsType: "text", label: tr("증분 요약 (텍스트)", "Summary (text)"), desc: tr("결론·지표·주의", "Conclusion, metrics, caveats"), onSelect: () => downloadText(card.text, "incrementality_suppression", "md", locale) },
              ]}
            />
          }
        />
      )}

      {series && win?.hasPre && (
        <div className={`callout ${win.balanced ? "ok" : "warn"}`} style={{ marginBottom: "10px" }}><div className="ico">{win.balanced ? "✓" : "!"}</div><div className="body"><p style={{ margin: 0, fontSize: "12px", lineHeight: 1.6 }}>
          <strong>{tr("그룹 균형 확인 (홀드아웃 전):", "Group balance check (before holdout):")}</strong> {tr("노출", "Exposed")} {fmtPct(win.preExp, 2, { asRatio: false })} {tr("vs 홀드아웃", "vs holdout")} {fmtPct(win.preHold, 2, { asRatio: false })} — {tr("차이", "difference")} {fmtPct(win.preDiff, 2, { asRatio: false })}p. {win.balanced ? tr("시작 전엔 거의 같음 → 두 그룹이 비교 가능(균형)했다는 증거.", "Nearly identical before the start → evidence the two groups were comparable (balanced).") : tr("시작 전부터 차이가 큼 → 그룹 균형이 의심되어 증분이 왜곡될 수 있음.", "Already a large gap before the start → group balance is questionable and incrementality may be distorted.")}
        </p></div></div>
      )}

      {r && (
        <div className="alloc-card" style={{ borderLeft: `3px solid ${positive ? "#22c55e" : "#ef4444"}` }}>
          <div className="ab-stat-row" style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
            <Stat label={tr("홀드아웃 전환율", "Holdout conversion rate")} value={fmtPct(r.cRate)} hint={`${fmtNum(win.cN)}/${fmtNum(win.cD)}`} />
            <Stat label={tr("노출 전환율", "Exposed conversion rate")} value={fmtPct(r.tRate)} hint={`${fmtNum(win.tN)}/${fmtNum(win.tD)}`} />
            <Stat label={tr("상대 Lift", "Relative lift")} value={r.liftRel != null ? fmtPct(r.liftRel) : "—"} color={positive ? "#22c55e" : "#ef4444"} />
            <Stat label={tr("증분 전환", "Incremental conversions")} value={fmtNum(inc)} hint={tr("광고가 새로 만든 전환", "Conversions newly created by ads")} />
            {r.cpia != null && <Stat label={tr("증분 전환당 비용", "Cost per incremental conversion")} value={fmtCurrency(r.cpia, { currency })} />}
            {r.iroas != null && <Stat label="iROAS" value={`${r.iroas.toFixed(2)}×`} color={r.iroas >= 1 ? "#22c55e" : "#ef4444"} hint={tr("증분 매출/광고비", "Incremental revenue / ad spend")} />}
          </div>
        </div>
      )}

      {series && isWindowOrderValid && (
        <div style={{ marginTop: "14px" }}>
          <h3 style={{ fontSize: "13px", margin: "0 0 6px", color: "var(--text-secondary)" }}>{tr("날짜별 전환율 — 노출 vs 홀드아웃", "Conversion rate by date — exposed vs holdout")}</h3>
          <p style={{ fontSize: "11.5px", color: "var(--text-muted)", margin: "0 0 8px" }}>{tr("홀드아웃 기간(주황 세로선 사이)에만 두 선이 벌어져야 정상 — 그 간격이 광고 증분. 기간 밖은 거의 겹쳐야 그룹이 균형입니다.", "The two lines should only diverge during the holdout period (between the orange vertical lines) — that gap is the ad incrementality. Outside that period they should nearly overlap if the groups are balanced.")}</p>
          <div className="chart-container" style={{ height: "300px" }}><canvas id="incr-suppression-chart"></canvas></div>
        </div>
      )}

      {r && (
        <div className="callout" style={{ marginTop: "14px" }}><div className="ico">💡</div><div className="body"><p style={{ margin: 0, fontSize: "12px", lineHeight: 1.6 }}>
          <strong>{tr("쉽게 말하면:", "In plain terms:")}</strong> {tr(<>홀드아웃 기간에 광고를 안 본 그룹도 자연 전환이 있습니다. 그 몫을 뺀 <strong>증분 전환 {fmtNum(inc)}건</strong>이 광고가 실제로 만든 값입니다.</>, <>Even the group that didn&apos;t see ads during the holdout period had some natural conversions. Subtracting that, <strong>{fmtNum(inc)} incremental conversions</strong> is what ads actually created.</>)}{r.iroas != null && <> iROAS {r.iroas.toFixed(2)}× — {r.iroas >= 1 ? tr("광고비보다 증분 매출이 큼(이득).", "Incremental revenue exceeds ad spend (profitable).") : tr("증분 기준 광고비가 매출보다 큼.", "Ad spend exceeds incremental revenue.")}</>}
        </p></div></div>
      )}
      <div className="callout warn" style={{ marginTop: "8px" }}><div className="ico">!</div><div className="body"><p style={{ margin: 0, fontSize: "11.5px", lineHeight: 1.6 }}>
        <strong>{tr("정직하게:", "To be honest:")}</strong> {tr(<>홀드아웃이 <strong>무작위 분할</strong>이고, 홀드아웃 前 두 그룹이 균형(위 확인)일 때만 인과로 해석됩니다. 표본이 적으면 신뢰도가 떨어집니다.</>, <>This can only be interpreted causally if the holdout is a <strong>random split</strong> and the two groups were balanced before the holdout (see above). Confidence drops with a small sample.</>)}
      </p></div></div>
    </section>
  );
}

/* ── ②③ 전후 비교 (pre/post) ── */
function PrePostView({ csvData, direction, currency, locale = "ko" }) {
  const tr = useCallback((ko, en) => (locale === "en" ? en : ko), [locale]);
  const headers = useMemo(() => csvData.headers || [], [csvData.headers]);
  // 컬럼 자동 감지
  const dateCol = useMemo(() => headers.find((h) => (csvData.raw || []).slice(0, 5).some((r) => looksDate(r[h]))) || headers[0], [headers, csvData.raw]);
  const numericCols = useMemo(() => headers.filter((h) => h !== dateCol && (csvData.raw || []).slice(0, 8).some((r) => Number.isFinite(num(r[h])))), [headers, dateCol, csvData.raw]);
  const groupCols = useMemo(() => headers.filter((h) => h !== dateCol && !numericCols.includes(h)), [headers, dateCol, numericCols]);
  const [metricCol, setMetricCol] = useState(numericCols[0] || "");
  const [groupCol, setGroupCol] = useState(groupCols[0] || "");
  const [useDiD, setUseDiD] = useState(!!groupCols.length);
  const [controlGroup, setControlGroup] = useState("");
  const [treatmentGroup, setTreatmentGroup] = useState("");
  const groupVals = useMemo(() => groupCol ? [...new Set((csvData.raw || []).map((r) => String(r[groupCol]).trim()).filter(Boolean))] : [], [csvData.raw, groupCol]);
  const detectedControl = groupVals.find((g) => /control|대조|holdout/i.test(g));
  const selectedControl = groupVals.includes(controlGroup) ? controlGroup : detectedControl;
  const selectedTreatment = groupVals.includes(treatmentGroup) && treatmentGroup !== selectedControl
    ? treatmentGroup
    : groupVals.find((g) => g !== selectedControl);

  const dates = useMemo(() => [...new Set((csvData.raw || []).map((r) => normalizeIncrDate(r[dateCol])).filter(Boolean))].sort(), [csvData.raw, dateCol]);
  const selectedTreatmentDates = useMemo(() => {
    const rows = csvData.raw || [];
    const treatmentRows = groupCol && selectedTreatment
      ? rows.filter((row) => String(row[groupCol]).trim() === selectedTreatment)
      : rows;
    return aggregateDailyMetric(treatmentRows, dateCol, metricCol).map((point) => point.date);
  }, [csvData.raw, groupCol, selectedTreatment, dateCol, metricCol]);
  const [cutoff, setCutoff] = useState("");
  const effCutoff = cutoff;
  const chartInst = useRef(null);

  const selectedInputAudit = useMemo(() => {
    const rows = csvData.raw || [];
    const treatmentRows = groupCol && selectedTreatment
      ? rows.filter((row) => String(row[groupCol]).trim() === selectedTreatment)
      : groupCol
        ? []
        : rows;
    const controlRows = useDiD && groupCol && selectedControl
      ? rows.filter((row) => String(row[groupCol]).trim() === selectedControl)
      : [];
    const treatment = auditSelectedMetricRows(treatmentRows, dateCol, metricCol);
    const control = auditSelectedMetricRows(controlRows, dateCol, metricCol);
    return {
      treatment,
      control,
      invalidRows: treatment.invalidRows + control.invalidRows,
      invalidDateRows: treatment.invalidDateRows + control.invalidDateRows,
      invalidMetricRows: treatment.invalidMetricRows + control.invalidMetricRows,
    };
  }, [csvData.raw, groupCol, selectedTreatment, selectedControl, useDiD, dateCol, metricCol]);
  const hasInvalidSelectedRows = selectedInputAudit.invalidRows > 0;

  const result = useMemo(() => {
    if (!metricCol || !effCutoff || hasInvalidSelectedRows) return null;
    const rows = csvData.raw || [];
    const ctrlVal = selectedControl;
    const treatVal = selectedTreatment;
    if (useDiD && (!ctrlVal || !treatVal)) return null;
    const pick = (pred) => rows.filter(pred);
    const seriesOf = (rowsF) => {
      const daily = aggregateDailyMetric(rowsF, dateCol, metricCol);
      return {
        pre: daily.filter((point) => point.date < effCutoff),
        post: daily.filter((point) => point.date >= effCutoff),
      };
    };
    const treatRows = groupCol && treatVal ? pick((r) => String(r[groupCol]).trim() === treatVal) : rows;
    const t = seriesOf(treatRows);
    let control = null;
    if (useDiD && groupCol && ctrlVal) {
      const c = seriesOf(pick((r) => String(r[groupCol]).trim() === ctrlVal));
      if (c.pre.length && c.post.length) control = c;
    }
    return INCR_PREPOST.compute({ pre: t.pre, post: t.post, direction, control });
  }, [csvData.raw, metricCol, groupCol, selectedControl, selectedTreatment, effCutoff, dateCol, useDiD, direction, hasInvalidSelectedRows]);

  const isDiDBlocked = useDiD && !!effCutoff && !hasInvalidSelectedRows && (!result?.did || result.did.ok !== true);
  const r = isDiDBlocked ? null : result;

  // 라인 차트 (treatment 시계열 + cutoff 마커 + pre/post 평균선)
  useEffect(() => {
    if (chartInst.current) { chartInst.current.destroy(); chartInst.current = null; }
    if (!metricCol || !effCutoff || !r) return;
    const ctx = document.getElementById("incr-prepost-chart"); if (!ctx) return;
    const rows = csvData.raw || [];
    const treatVal = selectedTreatment;
    const treatRows = groupCol && treatVal ? rows.filter((row) => String(row[groupCol]).trim() === treatVal) : rows;
    const daily = aggregateDailyMetric(treatRows, dateCol, metricCol);
    const labels = daily.map((point) => point.date);
    const vals = daily.map((point) => point.value);
    const cutoffIdx = labels.findIndex((l) => l >= effCutoff);
    const preMean = r.did?.ok ? r.did.treatPreMean : r.preMean;
    const postMean = r.did?.ok ? r.did.treatPostMean : r.postMean;
    chartInst.current = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          { label: metricCol, data: vals, borderColor: getCssVar("--primary"), backgroundColor: "transparent", pointRadius: 0, borderWidth: 2, tension: 0.15 },
          { label: tr("cutoff 이전 평균", "Pre-cutoff average"), data: labels.map((_, i) => (i < cutoffIdx ? preMean : null)), borderColor: getCssVar("--text-muted"), borderDash: [5, 4], pointRadius: 0, borderWidth: 1.5 },
          { label: tr("cutoff 이후 평균", "Post-cutoff average"), data: labels.map((_, i) => (i >= cutoffIdx ? postMean : null)), borderColor: direction === "off" ? "#ef4444" : "#22c55e", borderDash: [5, 4], pointRadius: 0, borderWidth: 1.5 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: CHART_THEME.text } },
          tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${fmtNum(c.parsed.y)}` } },
        },
        scales: {
          x: { ticks: { color: CHART_THEME.muted, autoSkip: true, maxTicksLimit: 10 }, grid: { color: getCssVar("--border") } },
          y: { ticks: { color: CHART_THEME.muted }, grid: { color: getCssVar("--border") } },
        },
      },
    });
    requestAnimationFrame(() => chartInst.current && chartInst.current.resize());
    return () => { if (chartInst.current) { chartInst.current.destroy(); chartInst.current = null; } };
  }, [csvData.raw, metricCol, groupCol, selectedTreatment, effCutoff, dateCol, r, direction, tr]);

  if (!numericCols.length) return <div className="callout warn"><div className="ico">!</div><div className="body"><strong>{tr("성과 지표(숫자) 컬럼이 필요합니다", "A performance metric (numeric) column is required")}</strong><p>{tr("date + 숫자 지표 컬럼이 있는 CSV를 올리세요.", "Upload a CSV with a date column plus a numeric metric column.")}</p></div></div>;

  const delta = r?.delta;
  const isDiD = r?.did?.ok === true;
  const effVal = isDiD ? r.did.didDelta : delta;
  const displayPreMean = isDiD ? r.did.treatPreMean : r?.preMean;
  const displayPostMean = isDiD ? r.did.treatPostMean : r?.postMean;
  const displayPreN = isDiD ? r.did.pairedPreN : r?.nPre;
  const displayPostN = isDiD ? r.did.pairedPostN : r?.nPost;
  const totalEffect = isDiD ? r.did.incrementalTotal : r?.incrementalTotal;
  const unmatchedDateCount = isDiD ? (r.did.unmatchedTreatmentDates || 0) + (r.did.unmatchedControlDates || 0) : 0;
  const lost = direction === "off";
  const sigP = isDiD ? (r?.did?.sig?.pValue ?? null) : (r?.sig?.pValue ?? r?.sig?.p ?? null);
  const hasSignificance = Number.isFinite(sigP);
  const sig = hasSignificance && sigP < 0.05;
  const confirmedLoss = lost && effVal < 0 && sig;
  const confirmedGain = !lost && effVal > 0 && sig;
  const good = confirmedLoss || confirmedGain;

  // 결론 카드 props + 다운로드(계산된 인사이트). 엔진 결과 재사용.
  const card = r && (() => {
    const change = `${effVal >= 0 ? "+" : ""}${fmtNum(effVal, 1)}`;
    const headline = !sig
      ? tr(`전환 뒤 일평균이 ${change} 변했습니다. 현재 표본만으로 전환의 효과를 확정할 수 없습니다${isDiD ? " (대조군 자연변화 제거)" : ""}.`, `The daily average changed by ${change} after the switch. The current sample does not establish an effect of the switch${isDiD ? " (control's natural change removed)" : ""}.`)
      : lost
        ? effVal < 0
          ? tr(`끈 뒤 일평균이 ${change} 변했습니다 — 종료와 연관된 손실 후보입니다${isDiD ? " (대조군 자연변화 제거)" : ""}.`, `After turning it off, the daily average changed by ${change} — a candidate loss associated with the shutdown${isDiD ? " (control's natural change removed)" : ""}.`)
          : tr(`끈 뒤 일평균이 ${change} 변했습니다 — 종료로 인한 손실은 확인되지 않습니다${isDiD ? " (대조군 자연변화 제거)" : ""}.`, `After turning it off, the daily average changed by ${change} — a shutdown loss is not supported${isDiD ? " (control's natural change removed)" : ""}.`)
        : effVal > 0
          ? tr(`켠 뒤 일평균이 ${change} 변했습니다 — 신규 실행과 연관된 증가 후보입니다${isDiD ? " (대조군 자연변화 제거)" : ""}.`, `After turning it on, the daily average changed by ${change} — a candidate increase associated with the launch${isDiD ? " (control's natural change removed)" : ""}.`)
          : tr(`켠 뒤 일평균이 ${change} 변했습니다 — 신규 실행에 의한 증가는 확인되지 않습니다${isDiD ? " (대조군 자연변화 제거)" : ""}.`, `After turning it on, the daily average changed by ${change} — a launch-driven increase is not supported${isDiD ? " (control's natural change removed)" : ""}.`);
    const points = [];
    points.push({ cls: sig ? "good" : "muted", text: sig
      ? tr(`통계적으로 유의합니다 (p=${sigP.toFixed(4)}).`, `Statistically significant (p=${sigP.toFixed(4)}).`)
      : hasSignificance
        ? tr(`현재 표본에서는 통계적으로 유의하지 않습니다 (p=${sigP.toFixed(3)}) — 사전 계획한 기간·표본까지만 유지한 뒤 재판정하세요.`, `The current sample is not statistically significant (p=${sigP.toFixed(3)}). Continue only to the pre-planned duration or sample size, then reassess.`)
        : tr("공통 날짜와 변동이 부족해 유의성을 추정할 수 없습니다.", "Significance cannot be estimated because there are too few common dates or too little variation.") });
    if (isDiD) points.push({ cls: unmatchedDateCount > 0 ? "muted" : "good", text: tr(`DiD는 공통 날짜만 매칭했습니다 (전 ${r.did.pairedPreN}일 · 후 ${r.did.pairedPostN}일)${unmatchedDateCount > 0 ? `; 매칭되지 않은 그룹-날짜 ${unmatchedDateCount}개는 제외했습니다.` : "."}`, `DiD matched common dates only (${r.did.pairedPreN} pre · ${r.did.pairedPostN} post)${unmatchedDateCount > 0 ? `; ${unmatchedDateCount} unmatched group-date entries were excluded.` : "."}`) });
    if (isDiD) points.push({ cls: "muted", text: tr(`사전추세 위반은 발견되지 않았습니다 (격차 기울기 ${fmtNum(r.did.pretrend.slopePerDay, 2)}/일 · p=${r.did.pretrend.pValue.toFixed(3)}). 이는 평행추세를 증명하는 검정은 아닙니다.`, `No pretrend violation was detected (gap slope ${fmtNum(r.did.pretrend.slopePerDay, 2)}/day · p=${r.did.pretrend.pValue.toFixed(3)}). This does not prove parallel trends.`) });
    if (!isDiD) points.push({ cls: "muted", text: tr("대조군을 넣어 DiD로 보정하면 계절·추세 영향을 줄일 수 있습니다.", "Adding a control group (DiD) reduces seasonality/trend effects.") });
    points.push({ cls: "muted", text: tr("무작위 실험이 아니면 인과를 단정하지 마세요.", "Don't assert causality unless this was a randomized experiment.") });
    const stats = [
      { label: tr("전환 전 평균(일)", "Pre avg (daily)"), value: fmtNum(displayPreMean, 1) },
      { label: tr("전환 후 평균(일)", "Post avg (daily)"), value: fmtNum(displayPostMean, 1) },
      { label: isDiD ? tr("순효과 Δ (DiD)", "Net Δ (DiD)") : tr("변화 Δ(일)", "Change Δ (daily)"), value: (effVal >= 0 ? "+" : "") + fmtNum(effVal, 1) },
      { label: lost ? tr("총 손실(기간)", "Total loss") : tr("총 증분(기간)", "Total incremental"), value: (totalEffect >= 0 ? "+" : "") + fmtNum(totalEffect, 0) },
    ];
    const csvRows = [
      [tr("전환 전 평균(일)", "Pre-cutoff daily average"), fmtNum(displayPreMean, 1)],
      [tr("전환 후 평균(일)", "Post-cutoff daily average"), fmtNum(displayPostMean, 1)],
      [isDiD ? tr("순효과 Δ (DiD)", "Net effect Δ (DiD)") : tr("변화 Δ(일)", "Change Δ (daily)"), (effVal >= 0 ? "+" : "") + fmtNum(effVal, 1)],
      [lost ? tr("총 손실(기간)", "Total loss (period)") : tr("총 증분(기간)", "Total incremental (period)"), (totalEffect >= 0 ? "+" : "") + fmtNum(totalEffect, 0)],
      [tr("유의성 p", "Significance p"), hasSignificance ? sigP.toFixed(4) : tr("추정 불가", "Not estimable")],
      [tr("전환 시점", "Cutoff date"), effCutoff],
      [tr("방법", "Method"), isDiD ? "DiD" : (lost ? tr("종료 전후", "Shutdown pre/post") : tr("신규 전후", "Launch pre/post"))],
    ];
    if (isDiD) {
      csvRows.push([tr("공통 날짜(전/후)", "Common dates (pre/post)"), `${r.did.pairedPreN}/${r.did.pairedPostN}`]);
      csvRows.push([tr("사전추세 검사", "Pretrend check"), tr(`위반 미탐지 (기울기 ${fmtNum(r.did.pretrend.slopePerDay, 2)}/일, p=${r.did.pretrend.pValue.toFixed(4)})`, `No violation detected (slope ${fmtNum(r.did.pretrend.slopePerDay, 2)}/day, p=${r.did.pretrend.pValue.toFixed(4)})`)]);
    }
    const csv = buildSummaryCsv(tr("지표,값", "Metric,Value"), csvRows);
    const text =
      (lost ? tr("# 증분 분석 — 종료(전후) 요약\n\n", "# Incrementality — Shutdown (pre/post) summary\n\n") : tr("# 증분 분석 — 신규 켜기(전후) 요약\n\n", "# Incrementality — New launch (pre/post) summary\n\n")) +
      `${headline}\n\n` +
      csvRows.map(([k, v]) => `- ${k}: ${v}`).join("\n") + "\n\n" +
      points.map((p) => `- ${p.text}`).join("\n") + "\n";
    return { tone: good ? "good" : "neutral", headline, points, stats, csv, text };
  })();
  const decisionDates = isDiD
    ? [...(r?.did?.commonPreDates || []), ...(r?.did?.commonPostDates || [])]
    : selectedTreatmentDates;
  const decisionSourcePeriod = r && decisionDates.length
    ? tr(
        `${decisionDates[0]} ~ ${decisionDates[decisionDates.length - 1]} · 전환 시점 ${effCutoff}`,
        `${decisionDates[0]} ~ ${decisionDates[decisionDates.length - 1]} · cutoff ${effCutoff}`,
      )
    : "";
  const decisionEffect = Number.isFinite(effVal) ? `${effVal >= 0 ? "+" : ""}${fmtNum(effVal, 1)}` : "";
  // 식별된 DiD는 제한 재검증만, 단순 전후는 대조군을 추가한 DiD 재검증만 제안한다.
  // 임의 성과 컬럼의 값을 증분 전환 baseline으로 추론하지 않으므로 baseline은 비운다.
  const decisionPrefill = r && decisionSourcePeriod && decisionEffect
    ? isDiD
      ? {
          conclusion: tr(
            `${decisionSourcePeriod}의 식별된 DiD에서 ${metricCol} 순효과 ${decisionEffect}/일이 관측됐습니다. 무작위 실험이 아니므로 인과효과로 확정하지 않습니다.`,
            `The identified DiD for ${decisionSourcePeriod} observed a net ${metricCol} effect of ${decisionEffect} per day. It is not a confirmed causal effect because the design was not randomized.`,
          ),
          action: tr(
            "같은 대조군과 사전 정의한 전환 시점을 유지해 제한된 후속 기간의 DiD를 재검증한다",
            "Keep the same control and pre-specified cutoff, then revalidate DiD over a limited follow-up window",
          ),
          hypothesis: tr(
            `후속 DiD에서도 ${metricCol} 순효과가 현재와 같은 방향이면 재현 가능한 신호로 볼 수 있을 것이다`,
            `A follow-up DiD showing the same direction for net ${metricCol} would support a reproducible signal`,
          ),
          metric: tr(`${metricCol} 순효과 (DiD)`, `${metricCol} net effect (DiD)`),
          baseline: "",
          sourcePeriod: decisionSourcePeriod,
          reviewQuestion: tr(
            "후속 DiD에서 사전추세 위반 없이 같은 방향의 순효과가 재현됐는가?",
            "Did the follow-up DiD reproduce the same net-effect direction without a pretrend violation?",
          ),
        }
      : {
          conclusion: tr(
            `${decisionSourcePeriod} 단순 전후 비교에서 ${metricCol} 일평균 변화 ${decisionEffect}가 관측됐지만 대조군이 없어 인과효과로 해석할 수 없습니다.`,
            `The simple pre/post comparison for ${decisionSourcePeriod} observed a ${decisionEffect} change in daily average ${metricCol}, but it cannot be interpreted causally without a control.`,
          ),
          action: tr(
            "변경하지 않은 대조군을 추가하고 같은 전환 시점으로 DiD를 재검증한다",
            "Add an unchanged control group and revalidate with DiD using the same cutoff",
          ),
          hypothesis: tr(
            `대조군의 공통 변화를 제거한 뒤에도 ${metricCol} 변화 방향이 남는지 확인한다`,
            `Check whether the direction of ${metricCol} remains after removing the control group's common change`,
          ),
          metric: tr(`${metricCol} 순효과 (DiD 재검증)`, `${metricCol} net effect (DiD revalidation)`),
          baseline: "",
          sourcePeriod: decisionSourcePeriod,
          reviewQuestion: tr(
            "DiD 재검증에서 사전추세 위반 없이 같은 방향의 순효과가 남았는가?",
            "After DiD revalidation, did the same net-effect direction remain without a pretrend violation?",
          ),
        }
    : null;
  const blockedState = !effCutoff
    ? "missing_cutoff"
    : hasInvalidSelectedRows
      ? "invalid_rows"
      : isDiDBlocked
        ? "identification_failed"
        : !r
          ? "insufficient_periods"
          : null;

  return (
    <>
      {blockedState && (
        <AnalysisBlockedTelemetry
          toolId="5-23"
          source={csvData?.fileName?.startsWith("demo_") ? "demo" : csvData?.importSource || "csv"}
          state={blockedState}
          signature={`prepost|${direction}|${dates.indexOf(effCutoff)}|${numericCols.indexOf(metricCol)}|${useDiD ? 1 : 0}|${csvData?.raw?.length || 0}`}
          rowCount={csvData?.raw?.length || 0}
          analysisType="incrementality"
          locale={locale}
        />
      )}
      <section className="block" style={{ marginBottom: "12px" }}>
        <h2 className="section-title">{tr("비교 설정", "Comparison settings")}</h2>
        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "flex-end" }}>
          <Field label={tr("성과 지표", "Performance metric")}><select className="map-select" value={metricCol} onChange={(e) => setMetricCol(e.target.value)}>{numericCols.map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
          <Field label={tr(`전환 시점 (${direction === "off" ? "끈" : "켠"} 날)`, `Cutoff date (day turned ${direction === "off" ? "off" : "on"})`)}>
            <select className="map-select" value={effCutoff} onChange={(e) => setCutoff(e.target.value)}>
              <option value="">{tr("운영 기록에서 선택", "Select from operations record")}</option>
              {dates.slice(1).map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </Field>
          {groupCols.length > 0 && (
            <>
              <Field label={tr("그룹 컬럼 (대조군)", "Group column (control)")}><select className="map-select" value={groupCol} onChange={(e) => { const next = e.target.value; setGroupCol(next); setControlGroup(""); setTreatmentGroup(""); if (!next) setUseDiD(false); }}><option value="">{tr("(없음)", "(none)")}</option>{groupCols.map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
              {groupCol && <Field label={tr("대조군 값", "Control value")}><select className="map-select" value={selectedControl || ""} onChange={(e) => setControlGroup(e.target.value)}><option value="">{tr("선택", "Select")}</option>{groupVals.map((g) => <option key={g} value={g}>{g}</option>)}</select></Field>}
              {groupCol && <Field label={tr("처리군 값", "Treatment value")}><select className="map-select" value={selectedTreatment || ""} onChange={(e) => setTreatmentGroup(e.target.value)}><option value="">{tr("선택", "Select")}</option>{groupVals.filter((g) => g !== selectedControl).map((g) => <option key={g} value={g}>{g}</option>)}</select></Field>}
              <label style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "6px" }}><input type="checkbox" checked={useDiD} onChange={(e) => setUseDiD(e.target.checked)} disabled={!groupCol} /> {tr("DiD (대조군으로 공통 변화 보정)", "DiD (adjust common change with a control)")}</label>
            </>
          )}
        </div>
        <p style={{ margin: "9px 0 0", fontSize: "11px", lineHeight: 1.5, color: "var(--text-muted)" }}>{tr(`전환 시점은 결과 차트를 보기 전에 캠페인 운영 기록에 적힌 실제 시작일 또는 종료일로 지정하세요. 같은 날짜에 여러 행이 있으면 일별 합계로 먼저 집계합니다. DiD는 공통 개입 전 날짜가 최소 ${INCR_PREPOST_CONTRACT.minPretrendDates}일 필요합니다.`, `Set the cutoff from the actual launch or shutdown date in the campaign operations record before viewing the outcome chart. Multiple rows on the same date are aggregated to a daily total first. DiD requires at least ${INCR_PREPOST_CONTRACT.minPretrendDates} common pre-intervention dates.`)}</p>
      </section>

      {!effCutoff && (
        <div className="callout warn"><div className="ico">!</div><div className="body"><strong>{tr("전환 시점을 먼저 지정하세요", "Specify the cutoff date first")}</strong><p>{tr("데이터 중간 날짜를 자동으로 고르거나 결과가 크게 달라지는 날짜를 사후 선택하지 않습니다. 운영 기록에 남은 실제 날짜를 선택해야 분석합니다.", "The tool does not auto-select the middle date or retrospectively choose a date with the largest outcome change. Select the actual date recorded in operations before analysis runs.")}</p></div></div>
      )}

      {hasInvalidSelectedRows && (
        <div className="callout warn"><div className="ico">!</div><div className="body"><strong>{tr("선택한 데이터에 사용할 수 없는 행이 있어 분석을 중단했습니다", "Analysis stopped because the selected data contains unusable rows")}</strong><p>{tr(`총 ${selectedInputAudit.invalidRows.toLocaleString()}행입니다 (잘못된 날짜 ${selectedInputAudit.invalidDateRows.toLocaleString()}행 · 비어 있거나 숫자가 아닌 지표 ${selectedInputAudit.invalidMetricRows.toLocaleString()}행; 처리군 ${selectedInputAudit.treatment.invalidRows.toLocaleString()}행 · 대조군 ${selectedInputAudit.control.invalidRows.toLocaleString()}행). 값을 고치기 전에는 결과·차트·다운로드를 만들지 않습니다.`, `${selectedInputAudit.invalidRows.toLocaleString()} row(s) are affected (invalid date: ${selectedInputAudit.invalidDateRows.toLocaleString()} · blank or non-numeric metric: ${selectedInputAudit.invalidMetricRows.toLocaleString()}; treatment: ${selectedInputAudit.treatment.invalidRows.toLocaleString()} · control: ${selectedInputAudit.control.invalidRows.toLocaleString()}). No result, chart, or download is produced until these values are fixed.`)}</p></div></div>
      )}

      {useDiD && (!selectedControl || !selectedTreatment) && (
        <div className="callout warn"><div className="ico">!</div><div className="body"><strong>{tr("DiD에는 대조군과 처리군을 각각 지정해야 합니다", "DiD needs an explicit control and treatment group")}</strong><p>{tr("그룹 값이 자동으로 분명하지 않으면 위 선택기에서 두 그룹을 직접 고르세요. 선택 전에는 DiD 결론을 만들지 않습니다.", "If the group values are not unambiguous, select both groups above. No DiD conclusion is produced until they are chosen.")}</p></div></div>
      )}

      {effCutoff && !hasInvalidSelectedRows && !isDiDBlocked && !r && (
        <div className="callout warn"><div className="ico">!</div><div className="body"><strong>{tr("전환 전·후에 모두 유효한 관측이 필요합니다", "Valid observations are required both before and after the cutoff")}</strong><p>{tr("선택한 지표와 전환 시점을 확인하세요. 한쪽 기간이 비어 있으면 결과를 만들지 않습니다.", "Check the selected metric and cutoff date. No result is produced when either side of the cutoff is empty.")}</p></div></div>
      )}

      {isDiDBlocked && (
        <div className="callout warn"><div className="ico">!</div><div className="body"><strong>{tr("DiD를 추정할 수 없습니다 (NOT_IDENTIFIED)", "DiD cannot be estimated (NOT_IDENTIFIED)")}</strong><p>{result?.did?.reason === "pretrend_violation"
          ? tr(`개입 전 처리군−대조군 격차가 시간에 따라 유의하게 움직였습니다 (공통 ${result.did.pretrend.n}일 · 일별 기울기 ${fmtNum(result.did.pretrend.slopePerDay, 2)} · p=${result.did.pretrend.pValue.toFixed(4)}). 평행추세 가정이 깨져 결론·차트·다운로드를 차단합니다.`, `The treatment-control gap changed significantly before the intervention (${result.did.pretrend.n} common dates · slope ${fmtNum(result.did.pretrend.slopePerDay, 2)} per day · p=${result.did.pretrend.pValue.toFixed(4)}). The parallel-trends assumption fails, so the conclusion, chart, and downloads are blocked.`)
          : result?.did?.reason === "insufficient_pretrend_dates"
            ? tr(`평행추세를 검사하려면 공통 개입 전 날짜가 최소 ${INCR_PREPOST_CONTRACT.minPretrendDates}일 필요합니다. 현재 ${result.did.pretrend.n}일이므로 결론·차트·다운로드를 차단합니다.`, `At least ${INCR_PREPOST_CONTRACT.minPretrendDates} common pre-intervention dates are required to check parallel trends. Only ${result.did.pretrend.n} are available, so the conclusion, chart, and downloads are blocked.`)
            : result?.did?.reason === "pretrend_not_estimable" ? tr("공통 개입 전 날짜는 있지만 격차 추세의 불확실성을 안정적으로 계산할 수 없습니다. 결론·차트·다운로드를 차단합니다.", "Common pre-intervention dates exist, but uncertainty in the gap trend cannot be estimated reliably. The conclusion, chart, and downloads are blocked.") : tr("전환 전·후 각각에 처리군과 대조군이 함께 존재하는 같은 날짜가 필요합니다. 누락일을 배열 순서로 억지 매칭하지 않으며, 공통 날짜가 없으면 결론·차트·다운로드를 차단합니다.", "Treatment and control must share calendar dates in both the pre- and post-periods. Missing dates are never force-matched by array position; the conclusion and downloads remain blocked when common dates are unavailable.")}</p></div></div>
      )}

      {r && (
        <section className="block" id="s-incr-result">
          <h2 className="section-title">{lost ? tr(confirmedLoss ? "종료 임팩트 (손실 후보)" : "종료 후 변화", confirmedLoss ? "Shutdown impact (loss candidate)" : "Post-shutdown change") : tr(confirmedGain ? "신규 임팩트 (증가 후보)" : "신규 실행 후 변화", confirmedGain ? "New-launch impact (increase candidate)" : "Post-launch change")}</h2>
          {card && (
            <ResultActionCard
              toolId="5-23"
              locale={locale}
              analysisKey={`prepost|${direction}|${csvData.raw?.length || 0}|${csvData.headers?.length || 0}|${dates.indexOf(effCutoff)}|${numericCols.indexOf(metricCol)}|${groupCols.indexOf(groupCol)}|${groupVals.indexOf(selectedControl)}|${groupVals.indexOf(selectedTreatment)}|${useDiD ? 1 : 0}`}
              analysisType="incrementality"
              resultState="ready"
              trackAnalysisStart
              tone={card.tone}
              title={lost ? tr(confirmedLoss ? "결론 — 종료와 연관된 손실 후보" : "결론 — 종료 후 관측 변화", confirmedLoss ? "Conclusion — loss candidate after shutdown" : "Conclusion — observed post-shutdown change") : tr(confirmedGain ? "결론 — 신규 실행과 연관된 증가 후보" : "결론 — 신규 실행 후 관측 변화", confirmedGain ? "Conclusion — increase candidate after launch" : "Conclusion — observed post-launch change")}
              headline={card.headline}
              points={card.points}
              stats={card.stats}
              workbookExport={() => ({
                calculationMode: "exact_after_preprocessing",
                calculationTables: [{
                  name: "PREPOST_INCREMENTALITY",
                  title: tr("전후·DiD 증분 계산", "Pre/post and DiD incrementality calculation"),
                  note: tr("공통 날짜 집계 입력에서 처리군 변화·대조군 변화·순효과·기간 합계를 수식으로 재현", "Recalculates treatment change, control change, net effect, and period total from common-date aggregate inputs"),
                  rows: [
                    ["is_did", "treatment_pre_mean_input", "treatment_post_mean_input", "control_pre_mean_input", "control_post_mean_input", "post_periods_input", "treatment_delta", "control_delta", "net_effect", "period_total_effect", "significance_p_engine"],
                    [
                      isDiD ? 1 : 0,
                      displayPreMean ?? 0,
                      displayPostMean ?? 0,
                      isDiD ? r.did.ctrlPreMean : 0,
                      isDiD ? r.did.ctrlPostMean : 0,
                      displayPostN || 0,
                      { formula: "=C2-B2" },
                      { formula: "=IF(A2=1,E2-D2,0)" },
                      { formula: "=G2-H2" },
                      { formula: "=I2*F2" },
                      Number.isFinite(sigP) ? sigP : "",
                    ],
                  ],
                }],
                method: {
                  name: isDiD ? "difference-in-differences" : "pre-post",
                  version: "incrementality-prepost",
                  assumptions: [tr("전후 평균은 현재 컷오프와 공통 날짜 매칭을 반영한 전처리 입력입니다.", "Pre/post means are preprocessing inputs reflecting the current cutoff and common-date matching.")],
                  limitations: [tr("단순 전후는 계절성·추세와 섞일 수 있고, DiD도 평행추세를 증명하지 않습니다. 유의성은 엔진 출력입니다.", "Simple pre/post can mix seasonality and trend; DiD does not prove parallel trends. Significance is an engine output.")],
                },
              })}
              decisionReview={Boolean(decisionPrefill)}
              decisionPrefill={decisionPrefill}
              analysisDetails={
                <AnalysisDetails
                  locale={locale}
                  statusLabel={!hasSignificance ? tr("유의성 추정 불가", "Significance not estimable") : sig ? tr("유의", "Significant") : tr("비유의", "Not significant")}
                  statusTone={sig ? "good" : "neutral"}
                  metric={isDiD ? tr("순효과 Δ", "Net effect Δ") : tr("전후 변화 Δ", "Pre/post change Δ")}
                  unit={tr("일평균 전환·기간 합계", "Daily average conversion; period total")}
                  meaning={tr("전후 비교 또는 대조군 보정(DiD) — 자동 인과 확정 아님", "Pre/post comparison or control-adjusted DiD — not automatically causal")}
                  sampleSize={{ label: tr("전·후 표본", "Pre / post sample"), value: `${displayPreN} / ${displayPostN}`, detail: isDiD ? tr("처리·대조 공통 관측일", "Common treatment-control dates") : tr("관측 일수", "Observed days") }}
                  interval={hasSignificance ? { label: tr("유의성", "Significance"), value: `p=${sigP.toFixed(4)}` } : null}
                  scope={`${effCutoff} (${lost ? tr("종료", "shutdown") : tr("시작", "launch")})`}
                  method={isDiD ? "DiD" : lost ? tr("종료 전후", "Shutdown pre/post") : tr("신규 전후", "Launch pre/post")}
                  version="incrementality-prepost"
                  cachePolicy={tr("브라우저 메모리 전용", "In-memory browser cache only")}
                  warnings={[
                    ...(!isDiD ? [tr("단순 전후 비교는 계절성·추세·프로모션과 섞일 수 있습니다.", "Simple pre/post comparisons can mix seasonality, trend, and promotions.")] : []),
                    ...(isDiD && unmatchedDateCount > 0 ? [tr(`처리군·대조군의 공통 날짜만 사용했고, 매칭되지 않은 그룹-날짜 ${unmatchedDateCount}개는 제외했습니다.`, `Only common treatment-control dates were used; ${unmatchedDateCount} unmatched group-date entries were excluded.`)] : []),
                    ...(isDiD ? [tr(`개입 전 공통 ${r.did.pretrend.n}일의 실제 날짜 간격으로 처리군−대조군 격차 추세를 검사했습니다. 유의한 위반은 없었지만 평행추세가 증명된 것은 아닙니다.`, `The treatment-control gap trend was checked over ${r.did.pretrend.n} common pre-intervention dates using actual calendar spacing. No significant violation was detected, but parallel trends are not proven.`)] : []),
                    tr("사전 MDE·검정력이 없으면 검정력을 역산하지 않습니다. 단순 전후는 증거 수준이 낮고 DiD/무작위 홀드아웃이 더 강합니다.", "Without a pre-specified MDE and target power, post-hoc power is not back-calculated. Simple pre/post evidence is weaker than DiD or randomized holdout evidence."),
                  ]}
                />
              }
              download={
                <DownloadHub
                  toolId="5-23"
                  locale={locale}
                  label={tr("결과 받기", "Download")}
                  align="right"
                  items={[
                    { icon: "📄", analyticsType: "csv", label: tr("증분 요약 (CSV)", "Summary (CSV)"), desc: tr("전후 평균·Δ·유의성", "Pre/post avg, Δ, significance"), onSelect: () => dlCsv(card.csv, lost ? "incrementality_shutdown" : "incrementality_launch") },
                    { icon: "📝", analyticsType: "text", label: tr("증분 요약 (텍스트)", "Summary (text)"), desc: tr("결론·지표·주의", "Conclusion, metrics, caveats"), onSelect: () => downloadText(card.text, lost ? "incrementality_shutdown" : "incrementality_launch", "md", locale) },
                  ]}
                />
              }
            />
          )}
          <div className="alloc-card" style={{ borderLeft: `3px solid ${good ? "#22c55e" : "#fbbf24"}`, marginBottom: "12px" }}>
            <div className="ab-stat-row" style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
              <Stat label={tr("전환 전 평균(일)", "Pre-cutoff daily average")} value={fmtNum(displayPreMean, 1)} />
              <Stat label={tr("전환 후 평균(일)", "Post-cutoff daily average")} value={fmtNum(displayPostMean, 1)} />
              <Stat label={isDiD ? tr("순효과 Δ (DiD)", "Net effect Δ (DiD)") : tr("변화 Δ(일)", "Change Δ (daily)")} value={(effVal >= 0 ? "+" : "") + fmtNum(effVal, 1)} color={good ? "#22c55e" : "#ef4444"} hint={isDiD ? tr("대조군 변화 제거", "Control group change removed") : (r.deltaPct != null ? fmtPct(r.deltaPct) : "")} />
              <Stat label={lost ? tr("총 손실(기간)", "Total loss (period)") : tr("총 증분(기간)", "Total incremental (period)")} value={(totalEffect >= 0 ? "+" : "") + fmtNum(totalEffect, 0)} hint={isDiD ? tr("공통 후 기간의 DiD 순효과 합", "DiD net effect across common post dates") : tr("반사실 대비 합계", "Total vs. counterfactual")} />
              <Stat label={tr("유의성", "Significance")} value={!hasSignificance ? tr("추정 불가", "Not estimable") : sig ? tr(`유의 (p=${sigP.toFixed(4)})`, `Significant (p=${sigP.toFixed(4)})`) : tr(`비유의 (p=${sigP.toFixed(3)})`, `Not significant (p=${sigP.toFixed(3)})`)} />
            </div>
          </div>
          <div className="chart-container" style={{ height: "320px" }}><canvas id="incr-prepost-chart"></canvas></div>
          <div className="callout" style={{ marginTop: "10px" }}><div className="ico">💡</div><div className="body"><p style={{ margin: 0, fontSize: "12px", lineHeight: 1.6 }}>
            <strong>{tr("쉽게 말하면:", "In plain terms:")}</strong> {tr(
              <>전환 시점 {lost ? "끈" : "켠"} 뒤 처리군 하루 평균이 {fmtNum(displayPreMean, 1)} → {fmtNum(displayPostMean, 1)}로 바뀌었습니다. {isDiD ? `같은 날짜의 대조군 변화를 뺀 순효과는 ${(effVal >= 0 ? "+" : "") + fmtNum(effVal, 1)}입니다.` : `${(effVal >= 0 ? "+" : "") + fmtNum(effVal, 1)} ${effVal >= 0 ? "올랐" : "떨어졌"}습니다.`}</>,
              <>After the day it was turned {lost ? "off" : "on"}, the treatment daily average changed from {fmtNum(displayPreMean, 1)} to {fmtNum(displayPostMean, 1)}. {isDiD ? `The net effect after subtracting the control on matching dates is ${(effVal >= 0 ? "+" : "") + fmtNum(effVal, 1)}.` : `It ${effVal >= 0 ? "increased" : "decreased"} by ${(effVal >= 0 ? "+" : "") + fmtNum(effVal, 1)}.`}</>
            )}
          </p></div></div>
          <div className="callout warn" style={{ marginTop: "8px" }}><div className="ico">!</div><div className="body"><p style={{ margin: 0, fontSize: "11.5px", lineHeight: 1.6 }}>
            <strong>{tr("정직하게:", "To be honest:")}</strong> {tr(
              <>단순 전후 비교는 그 사이 계절·프로모션·시장 변화가 섞일 수 있습니다. {isDiD ? "대조군 DiD로 관측된 공통 변화를 보정하고 사전추세 위반을 검사했지만," : "대조군(변하지 않은 그룹)을 넣어 DiD로 보정하면 더 정확합니다."} 무작위 실험이 아니면 인과를 단정하지 마세요.</>,
              <>A simple before/after comparison can mix in seasonality, promotions, or market changes over that time. {isDiD ? "Control-group DiD adjusts for observed common change and checks for a pretrend violation, but" : "Adding a control group (a group that didn&apos;t change) and correcting with DiD would be more accurate."} If it wasn&apos;t a randomized experiment, don&apos;t assert causality.</>
            )}
          </p></div></div>
        </section>
      )}
    </>
  );
}

function Stat({ label, value, hint, color }) {
  return (
    <div className="ab-stat">
      <div className="ab-stat-label">{label}</div>
      <div className="ab-stat-value tnum" style={color ? { color } : undefined}>{value}</div>
      {hint && <div className="ab-stat-hint">{hint}</div>}
    </div>
  );
}
function Field({ label, children }) {
  return (
    <div className="ab-field" style={{ minWidth: "160px" }}>
      <label style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>{label}</label>
      {children}
    </div>
  );
}
