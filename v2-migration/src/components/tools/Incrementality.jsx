"use client";
import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import Papa from "papaparse";
import Chart from "chart.js/auto";
import { useAppStore } from "@/store/useDataStore";
import { INCR_MATH, parseHoldoutGroup } from "@/utils/incrMath";
import { INCR_PREPOST } from "@/utils/incrPrePostMath";
import { getMappedRows } from "@/utils/dashboardAggregator";
import { fmtCurrency, fmtNum, fmtPct } from "@/utils/format";
import { CHART_THEME, getCssVar } from "@/utils/chartUtils";
import DemoLoadButton from "@/components/DemoLoadButton";
import CsvGuide from "@/components/ds/CsvGuide";
import ResultActionCard from "@/components/ds/ResultActionCard";
import AnalysisDetails from "@/components/ds/AnalysisDetails";
import DownloadHub from "@/components/ds/DownloadHub";
import { buildResultManifest } from "@/lib/analysis-results/resultManifest";
import { downloadCsv as dlCsv, downloadText } from "@/utils/download";
import { buildIncrSuppressionDemo, buildIncrPrepostDemo } from "@/utils/demoData";

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : NaN; };
const looksDate = (v) => /^\d{4}[-/]\d{1,2}([-/]\d{1,2})?/.test(String(v || "").trim());

// CSV 셀 이스케이프(콤마·따옴표 §7).
const qc = (s) => (/[",\n]/.test(String(s)) ? `"${String(s).replace(/"/g, '""')}"` : String(s));
// 라벨-값 2열 요약 CSV(BOM+CRLF §7). rows=[[label,value],...]
function buildSummaryCsv(header, rows) {
  return "﻿" + [header, ...rows.map((r) => r.map(qc).join(","))].join("\r\n") + "\r\n";
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
  const demoDisabled = useAppStore((s) => s.demoDisabled);
  const currency = useAppStore((s) => s.displayCurrency);
  const setDisplayCurrency = useAppStore((s) => s.setDisplayCurrency);
  const [method, setMethod] = useState("suppression");
  const fileRef = useRef(null);
  const hasData = csvData?.raw?.length > 0;

  const handleFile = (file) => {
    if (!file) return;
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (res) => {
        if (!res.data || !res.data.length) return;
        const mapping = {}; (res.meta.fields || []).forEach((h) => { mapping[h] = h; });
        setCsvData({ raw: res.data, headers: res.meta.fields || [], mapping, fileName: file.name });
      },
    });
  };
  const loadDemo = () => {
    if (method === "suppression") setCsvData(buildIncrSuppressionDemo());
    else setCsvData(buildIncrPrepostDemo(method));
  };
  const resetCsv = () => setCsvData({ raw: [], headers: [], mapping: {}, fileName: "" });
  const isDemo = !!(csvData?.fileName && csvData.fileName.startsWith("demo_"));

  // 첫 진입(데이터 없음) 시 샘플 데이터 자동 로드(CsvUploader와 동일 패턴, SEO·첫인상).
  useEffect(() => {
    if (!hasData && !demoDisabled) loadDemo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="tab-pane active" id="tab-incr">
      {/* 히어로 (claude-ux §1 여정=질문) */}
      <section className="block" style={{ background: "linear-gradient(135deg, rgba(122,162,247,0.12), rgba(192,132,252,0.05))", border: "1px solid rgba(122,162,247,0.25)", borderRadius: "14px", padding: "18px 20px", marginBottom: "16px" }}>
        <h2 className="section-title" style={{ marginTop: 0, marginBottom: "6px" }}>{tr("광고를 켠 것(혹은 끈 것)이 진짜 얼마를 만들었나?", "How much did turning ads on (or off) actually create?")}</h2>
        <p style={{ fontSize: "12.5px", color: "var(--text-secondary)", margin: 0, lineHeight: 1.6, maxWidth: "680px" }}>
          {tr(<>어트리뷰션과 달리, <strong>광고가 없었어도 어차피 일어났을 전환</strong>을 빼고 순수 증분만 봅니다. 3가지 방법 중 상황에 맞는 걸 고르세요.</>,
            <>Unlike attribution, this excludes <strong>conversions that would have happened anyway without ads</strong> and shows pure incrementality. Pick whichever of the 3 methods fits your situation.</>)}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px", marginTop: "14px" }}>
          {(locale === "en" ? [
            ["🧪", "Control group (suppression)", "Randomly block ads for a subset → compare exposed vs unexposed concurrently. Cleanest."],
            ["🟢", "New launch (on)", "Compare before/after turning on something new → the lift it created."],
            ["🔴", "Shutdown (off)", "Compare before/after turning off something running → the drop from stopping it."],
          ] : [
            ["🧪", "통제군 (suppression)", "일부를 무작위로 광고 차단 → 노출 vs 미노출 동시 비교. 가장 깨끗."],
            ["🟢", "신규 켜기 (on)", "안 하던 걸 켠 시점 전후 비교 → 켠 것이 만든 상승분."],
            ["🔴", "종료 (off)", "켜뒀던 걸 끈 시점 전후 비교 → 끄면서 잃은 하락분."],
          ]).map(([ic, t, d], i) => (
            <div key={i} style={{ background: "var(--surface-container-lowest)", border: "1px solid var(--border)", borderRadius: "10px", padding: "11px 13px" }}>
              <div style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--text-primary)" }}>{ic} {t}</div>
              <div style={{ fontSize: "11.5px", color: "var(--text-muted)", marginTop: "4px", lineHeight: 1.5 }}>{d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 방법 탭 */}
      <div className="ab-tabs" style={{ marginBottom: "8px" }}>
        {METHODS.map((m) => (
          <button key={m.key} className={`ab-tab ${method === m.key ? "active" : ""}`} onClick={() => setMethod(m.key)}>
            {m.label}
          </button>
        ))}
      </div>
      <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "0 0 16px", lineHeight: 1.6 }}>
        {method === "suppression" && tr("같은 기간, 무작위로 광고를 차단한 홀드아웃 그룹 vs 노출 그룹을 비교합니다. 무작위 분할이면 인과 신뢰가 가장 높습니다.", "Compares a holdout group (ads randomly blocked) vs an exposed group over the same period. Random assignment gives the highest causal confidence.")}
        {method === "on" && tr("안 하던 광고/캠페인을 켠 시점(cutoff) 전후를 비교합니다. 대조군을 넣으면 계절·추세를 제거(DiD)합니다.", "Compares before/after the moment (cutoff) you turned on an ad/campaign that wasn't running. Adding a control group removes seasonality/trend (DiD).")}
        {method === "off" && tr("켜뒀던 광고/캠페인을 끈 시점(cutoff) 전후를 비교해 끄면서 잃은 성과를 봅니다. 대조군 있으면 DiD 권장.", "Compares before/after the moment (cutoff) you turned off a running ad/campaign to see what was lost. A control group + DiD is recommended.")}
      </p>

      {!hasData ? (
        <UploadPanel method={method} fileRef={fileRef} handleFile={handleFile} loadDemo={loadDemo} locale={locale} />
      ) : (
        <div>
          {isDemo && (
            <div className="required-banner" style={{ borderLeftColor: "#f7b955", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
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
            : <PrePostView csvData={csvData} direction={method} currency={currency} locale={locale} />}
        </div>
      )}
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
      <CsvGuide toolId={`5-23:${method}`} onDownloadTemplate={() => dlCsv("﻿" + tmpl.text, tmpl.base)} locale={locale} />
      <div className="csv-dropzone" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]); }} onClick={() => fileRef.current?.click()} style={{ cursor: "pointer" }}>
        <div className="csv-drop-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
        </div>
        <div className="csv-drop-text">{tr("CSV 파일 드래그 & 드롭", "Drag & drop CSV file")}</div>
        <div className="csv-drop-sub">{tr("또는 클릭하여 파일 선택", "or click to select a file")}</div>
        <input type="file" accept=".csv,text/csv" style={{ display: "none" }} ref={fileRef} onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = null; }} />
      </div>
      <DemoLoadButton onLoad={loadDemo} locale={locale} />
    </>
  );
}

/* ── ① 통제군 (suppression) ── */
function SuppressionView({ csvData, currency, locale = "ko" }) {
  const tr = useCallback((ko, en) => (locale === "en" ? en : ko), [locale]);
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
      const d = String(r.date);
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

  // 홀드아웃 창 자동 감지(두 그룹 전환율 차가 큰 구간). 없으면 전체.
  const detected = useMemo(() => {
    if (!series) return null;
    const { labels, expRate, holdRate } = series;
    const diffs = labels.map((_, i) => (expRate[i] != null && holdRate[i] != null) ? expRate[i] - holdRate[i] : 0);
    const maxD = Math.max(...diffs, 0);
    if (maxD < 0.3) return { start: labels[0], end: labels[labels.length - 1] }; // 안 벌어짐 → 전체
    const thr = maxD * 0.4;
    const idx = diffs.map((x, i) => x >= thr ? i : -1).filter((i) => i >= 0);
    return { start: labels[idx[0]], end: labels[idx[idx.length - 1]] };
  }, [series]);

  const [winStart, setWinStart] = useState("");
  const [winEnd, setWinEnd] = useState("");
  const start = winStart || detected?.start || "";
  const end = winEnd || detected?.end || "";

  // 창 기간 내 집계 → 증분 (창 밖 pre/post는 균형 확인용)
  const win = useMemo(() => {
    if (!series || !start || !end) return null;
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
  }, [series, start, end]);

  const chartInst = useRef(null);
  useEffect(() => {
    if (chartInst.current) { chartInst.current.destroy(); chartInst.current = null; }
    if (!series) return;
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
        { label: tr("노출 그룹(광고 봄)", "Exposed group (saw ads)"), data: expRate, borderColor: "#22c55e", backgroundColor: "transparent", pointRadius: 0, borderWidth: 2, tension: 0.15 },
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
  }, [series, start, end, tr]);

  if (totals.cDen <= 0 || totals.tDen <= 0) return <div className="callout warn"><div className="ico">!</div><div className="body"><strong>{tr("노출(exposed)·홀드아웃(holdout) 양쪽 데이터가 필요합니다", "Both exposed and holdout data are required")}</strong><p>{tr("holdout_group 컬럼에 두 그룹이 모두 있어야 증분을 계산합니다.", "The holdout_group column must contain both groups to calculate incrementality.")}</p></div></div>;

  const r = win?.incr;
  const inc = r ? Math.round(r.incrementalConv) : 0;
  const positive = r ? r.incrementalConv > 0 : false;

  // 결론 카드 props + 다운로드(계산된 인사이트만). 엔진 결과 재사용.
  const card = r && (() => {
    const headline = positive
      ? tr(
          `광고가 실제로 만든 증분 전환은 ${fmtNum(inc)}건입니다${r.iroas != null ? ` (iROAS ${r.iroas.toFixed(2)}×)` : ""}.`,
          `Ads actually created ${fmtNum(inc)} incremental conversions${r.iroas != null ? ` (iROAS ${r.iroas.toFixed(2)}×)` : ""}.`
        )
      : tr(
          "홀드아웃 대비 증분이 0 이하입니다 — 이 기간 광고의 순증분 효과가 확인되지 않습니다.",
          "Incrementality vs. holdout is zero or below — no net incremental ad effect is confirmed for this period."
        );
    const points = [];
    if (win.balanced === false) points.push({ cls: "bad", text: tr("홀드아웃 前 두 그룹이 이미 벌어져 있어 균형이 의심됩니다 — 증분이 왜곡됐을 수 있습니다.", "The two groups already differed before the holdout — balance is questionable and incrementality may be distorted.") });
    else if (win.balanced) points.push({ cls: "good", text: tr("홀드아웃 前 두 그룹이 균형이라 비교가 타당합니다.", "The groups were balanced before the holdout, so the comparison is valid.") });
    if (r.iroas != null) points.push({ text: r.iroas >= 1 ? tr("증분 매출이 광고비보다 큽니다(이득) — 유지·확대 검토.", "Incremental revenue exceeds ad spend (profitable) — consider keeping/scaling.") : tr("증분 기준 광고비가 매출보다 큽니다 — 효율 재점검.", "Ad spend exceeds incremental revenue — re-check efficiency.") });
    points.push({ cls: "muted", text: tr("무작위 분할이 아니면 인과로 단정하지 마세요.", "Don't assert causality unless this was a random split.") });
    const stats = [
      { label: tr("증분 전환", "Incremental conv."), value: fmtNum(inc) },
      { label: tr("상대 Lift", "Relative lift"), value: r.liftRel != null ? fmtPct(r.liftRel) : "—" },
    ];
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
    return { tone: positive ? "good" : "bad", headline, points, stats, csv, text };
  })();

  return (
    <section className="block">
      <h2 className="section-title"><span className="ix">§1</span>{tr("증분 결과 (홀드아웃 기간)", "Incrementality result (holdout period)")}</h2>

      {card && (
        <ResultActionCard
          toolId="5-23"
          tone={card.tone}
          title={tr("결론 — 광고가 만든 순증분", "Conclusion — net incremental from ads")}
          headline={card.headline}
          points={card.points}
          stats={card.stats}
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
                { icon: "📝", analyticsType: "text", label: tr("증분 요약 (텍스트)", "Summary (text)"), desc: tr("결론·지표·주의", "Conclusion, metrics, caveats"), onSelect: () => downloadText(card.text, "incrementality_suppression") },
              ]}
            />
          }
        />
      )}

      {series && (
        <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", alignItems: "flex-end", marginBottom: "12px" }}>
          <Field label={tr("홀드아웃 시작일", "Holdout start date")}><select className="map-select" value={start} onChange={(e) => setWinStart(e.target.value)}>{series.labels.map((d) => <option key={d} value={d}>{d}</option>)}</select></Field>
          <Field label={tr("홀드아웃 종료일", "Holdout end date")}><select className="map-select" value={end} onChange={(e) => setWinEnd(e.target.value)}>{series.labels.map((d) => <option key={d} value={d}>{d}</option>)}</select></Field>
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{tr("이 기간에만 광고를 차단했다고 보고 증분을 계산합니다.", "Incrementality is calculated assuming ads were blocked only during this period.")}</span>
        </div>
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

      {series && (
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
  const numericCols = useMemo(() => headers.filter((h) => h !== dateCol && (csvData.raw || []).slice(0, 8).some((r) => Number.isFinite(Number(r[h])) && String(r[h]).trim() !== "")), [headers, dateCol, csvData.raw]);
  const groupCols = useMemo(() => headers.filter((h) => h !== dateCol && !numericCols.includes(h)), [headers, dateCol, numericCols]);
  const [metricCol, setMetricCol] = useState(numericCols[0] || "");
  const [groupCol, setGroupCol] = useState(groupCols[0] || "");
  const [useDiD, setUseDiD] = useState(!!groupCols.length);

  const dates = useMemo(() => [...new Set((csvData.raw || []).map((r) => String(r[dateCol])))].filter(looksDate).sort(), [csvData.raw, dateCol]);
  const [cutoff, setCutoff] = useState("");
  const effCutoff = cutoff || dates[Math.floor(dates.length / 2)] || "";
  const chartRef = useRef(null); const chartInst = useRef(null);

  const result = useMemo(() => {
    if (!metricCol || !effCutoff) return null;
    const rows = csvData.raw || [];
    const groupVals = groupCol ? [...new Set(rows.map((r) => String(r[groupCol]).trim()))] : [];
    const ctrlVal = groupVals.find((g) => /control|대조|holdout|off/i.test(g));
    const treatVal = groupVals.find((g) => g !== ctrlVal);
    const pick = (pred) => rows.filter(pred);
    const seriesOf = (rowsF) => {
      const pre = [], post = [];
      for (const r of rowsF) {
        const v = Number(r[metricCol]); if (!Number.isFinite(v)) continue;
        (String(r[dateCol]) < effCutoff ? pre : post).push(v);
      }
      return { pre, post };
    };
    const treatRows = groupCol && treatVal ? pick((r) => String(r[groupCol]).trim() === treatVal) : rows;
    const t = seriesOf(treatRows);
    let control = null;
    if (useDiD && groupCol && ctrlVal) {
      const c = seriesOf(pick((r) => String(r[groupCol]).trim() === ctrlVal));
      if (c.pre.length && c.post.length) control = c;
    }
    return INCR_PREPOST.compute({ pre: t.pre, post: t.post, direction, control });
  }, [csvData.raw, metricCol, groupCol, effCutoff, dateCol, useDiD, direction]);

  // 라인 차트 (treatment 시계열 + cutoff 마커 + pre/post 평균선)
  useEffect(() => {
    if (chartInst.current) { chartInst.current.destroy(); chartInst.current = null; }
    if (!metricCol || !effCutoff) return;
    const ctx = document.getElementById("incr-prepost-chart"); if (!ctx) return;
    const rows = csvData.raw || [];
    const groupVals = groupCol ? [...new Set(rows.map((r) => String(r[groupCol]).trim()))] : [];
    const ctrlVal = groupVals.find((g) => /control|대조|holdout|off/i.test(g));
    const treatVal = groupVals.find((g) => g !== ctrlVal);
    const treatRows = (groupCol && treatVal ? rows.filter((r) => String(r[groupCol]).trim() === treatVal) : rows)
      .filter((r) => looksDate(r[dateCol])).sort((a, b) => String(a[dateCol]) < String(b[dateCol]) ? -1 : 1);
    const labels = treatRows.map((r) => String(r[dateCol]));
    const vals = treatRows.map((r) => Number(r[metricCol]));
    const cutoffIdx = labels.findIndex((l) => l >= effCutoff);
    const preMean = result?.preMean, postMean = result?.postMean;
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
  }, [csvData.raw, metricCol, groupCol, effCutoff, dateCol, result, direction, tr]);

  if (!numericCols.length) return <div className="callout warn"><div className="ico">!</div><div className="body"><strong>{tr("성과 지표(숫자) 컬럼이 필요합니다", "A performance metric (numeric) column is required")}</strong><p>{tr("date + 숫자 지표 컬럼이 있는 CSV를 올리세요.", "Upload a CSV with a date column plus a numeric metric column.")}</p></div></div>;

  const r = result;
  const delta = r?.delta;
  const isDiD = !!r?.did;
  const effVal = isDiD ? r.did.didDelta : delta;
  const lost = direction === "off";
  const good = lost ? effVal < 0 : effVal > 0; // on: 상승=좋음, off: 하락=원인확인
  const sigP = r?.sig?.pValue ?? r?.sig?.p;

  // 결론 카드 props + 다운로드(계산된 인사이트). 엔진 결과 재사용.
  const card = r && (() => {
    const sig = sigP != null && sigP < 0.05;
    const headline = lost
      ? tr(
          `끈 뒤 하루 평균이 ${(effVal >= 0 ? "+" : "") + fmtNum(effVal, 1)} 변했습니다 — 종료로 잃은(되돌릴 수 있는) 성과입니다${isDiD ? " (대조군 자연변화 제거)" : ""}.`,
          `After turning it off, the daily average changed by ${(effVal >= 0 ? "+" : "") + fmtNum(effVal, 1)} — performance lost (recoverable) from the shutdown${isDiD ? " (control's natural change removed)" : ""}.`
        )
      : tr(
          `켠 뒤 하루 평균이 ${(effVal >= 0 ? "+" : "") + fmtNum(effVal, 1)} 변했습니다 — 새로 얻은 성과입니다${isDiD ? " (대조군 자연변화 제거)" : ""}.`,
          `After turning it on, the daily average changed by ${(effVal >= 0 ? "+" : "") + fmtNum(effVal, 1)} — performance gained from the launch${isDiD ? " (control's natural change removed)" : ""}.`
        );
    const points = [];
    points.push({ cls: sig ? "good" : "muted", text: sig ? tr(`통계적으로 유의합니다 (p=${sigP.toFixed(4)}).`, `Statistically significant (p=${sigP.toFixed(4)}).`) : tr(`아직 통계적으로 유의하지 않습니다 (p=${sigP != null ? sigP.toFixed(3) : "—"}) — 표본을 더 모으세요.`, `Not statistically significant yet (p=${sigP != null ? sigP.toFixed(3) : "—"}) — gather more data.`) });
    if (!isDiD) points.push({ cls: "muted", text: tr("대조군을 넣어 DiD로 보정하면 계절·추세 영향을 줄일 수 있습니다.", "Adding a control group (DiD) reduces seasonality/trend effects.") });
    points.push({ cls: "muted", text: tr("무작위 실험이 아니면 인과를 단정하지 마세요.", "Don't assert causality unless this was a randomized experiment.") });
    const stats = [
      { label: tr("전환 전 평균(일)", "Pre avg (daily)"), value: fmtNum(r.preMean, 1) },
      { label: tr("전환 후 평균(일)", "Post avg (daily)"), value: fmtNum(r.postMean, 1) },
      { label: isDiD ? tr("순효과 Δ (DiD)", "Net Δ (DiD)") : tr("변화 Δ(일)", "Change Δ (daily)"), value: (effVal >= 0 ? "+" : "") + fmtNum(effVal, 1) },
      { label: lost ? tr("총 손실(기간)", "Total loss") : tr("총 증분(기간)", "Total incremental"), value: (r.incrementalTotal >= 0 ? "+" : "") + fmtNum(r.incrementalTotal, 0) },
    ];
    const csvRows = [
      [tr("전환 전 평균(일)", "Pre-cutoff daily average"), fmtNum(r.preMean, 1)],
      [tr("전환 후 평균(일)", "Post-cutoff daily average"), fmtNum(r.postMean, 1)],
      [isDiD ? tr("순효과 Δ (DiD)", "Net effect Δ (DiD)") : tr("변화 Δ(일)", "Change Δ (daily)"), (effVal >= 0 ? "+" : "") + fmtNum(effVal, 1)],
      [lost ? tr("총 손실(기간)", "Total loss (period)") : tr("총 증분(기간)", "Total incremental (period)"), (r.incrementalTotal >= 0 ? "+" : "") + fmtNum(r.incrementalTotal, 0)],
      [tr("유의성 p", "Significance p"), sigP != null ? sigP.toFixed(4) : "—"],
      [tr("전환 시점", "Cutoff date"), effCutoff],
      [tr("방법", "Method"), isDiD ? "DiD" : (lost ? tr("종료 전후", "Shutdown pre/post") : tr("신규 전후", "Launch pre/post"))],
    ];
    const csv = buildSummaryCsv(tr("지표,값", "Metric,Value"), csvRows);
    const text =
      (lost ? tr("# 증분 분석 — 종료(전후) 요약\n\n", "# Incrementality — Shutdown (pre/post) summary\n\n") : tr("# 증분 분석 — 신규 켜기(전후) 요약\n\n", "# Incrementality — New launch (pre/post) summary\n\n")) +
      `${headline}\n\n` +
      csvRows.map(([k, v]) => `- ${k}: ${v}`).join("\n") + "\n\n" +
      points.map((p) => `- ${p.text}`).join("\n") + "\n";
    return { tone: good ? "good" : "bad", headline, points, stats, csv, text };
  })();

  return (
    <>
      <section className="block" style={{ marginBottom: "12px" }}>
        <h2 className="section-title"><span className="ix">§1</span>{tr("비교 설정", "Comparison settings")}</h2>
        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "flex-end" }}>
          <Field label={tr("성과 지표", "Performance metric")}><select className="map-select" value={metricCol} onChange={(e) => setMetricCol(e.target.value)}>{numericCols.map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
          <Field label={tr(`전환 시점 (${direction === "off" ? "끈" : "켠"} 날)`, `Cutoff date (day turned ${direction === "off" ? "off" : "on"})`)}><select className="map-select" value={effCutoff} onChange={(e) => setCutoff(e.target.value)}>{dates.map((d) => <option key={d} value={d}>{d}</option>)}</select></Field>
          {groupCols.length > 0 && (
            <>
              <Field label={tr("그룹 컬럼 (대조군)", "Group column (control)")}><select className="map-select" value={groupCol} onChange={(e) => setGroupCol(e.target.value)}><option value="">{tr("(없음)", "(none)")}</option>{groupCols.map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
              <label style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "6px" }}><input type="checkbox" checked={useDiD} onChange={(e) => setUseDiD(e.target.checked)} disabled={!groupCol} /> {tr("DiD (대조군으로 계절·추세 제거)", "DiD (remove seasonality/trend via control group)")}</label>
            </>
          )}
        </div>
      </section>

      {r && (
        <section className="block">
          <h2 className="section-title"><span className="ix">§2</span>{lost ? tr("종료 임팩트 (잃은 성과)", "Shutdown impact (performance lost)") : tr("신규 임팩트 (얻은 성과)", "New-launch impact (performance gained)")}</h2>
          {card && (
            <ResultActionCard
              toolId="5-23"
              tone={card.tone}
              title={lost ? tr("결론 — 종료로 잃은 성과", "Conclusion — performance lost from shutdown") : tr("결론 — 신규로 얻은 성과", "Conclusion — performance gained from launch")}
              headline={card.headline}
              points={card.points}
              stats={card.stats}
              analysisDetails={
                <AnalysisDetails
                  locale={locale}
                  statusLabel={sigP != null && sigP < 0.05 ? tr("유의", "Significant") : tr("비유의", "Not significant")}
                  statusTone={sigP != null && sigP < 0.05 ? "good" : "neutral"}
                  metric={isDiD ? tr("순효과 Δ", "Net effect Δ") : tr("전후 변화 Δ", "Pre/post change Δ")}
                  unit={tr("일평균 전환·기간 합계", "Daily average conversion; period total")}
                  meaning={tr("전후 비교 또는 대조군 보정(DiD) — 자동 인과 확정 아님", "Pre/post comparison or control-adjusted DiD — not automatically causal")}
                  sampleSize={{ label: tr("전·후 표본", "Pre / post sample"), value: `${r.nPre} / ${r.nPost}`, detail: tr("관측 일수", "Observed days") }}
                  interval={sigP != null ? { label: tr("유의성", "Significance"), value: `p=${sigP.toFixed(4)}` } : null}
                  scope={`${effCutoff} (${lost ? tr("종료", "shutdown") : tr("시작", "launch")})`}
                  method={isDiD ? "DiD" : lost ? tr("종료 전후", "Shutdown pre/post") : tr("신규 전후", "Launch pre/post")}
                  version="incrementality-prepost"
                  cachePolicy={tr("브라우저 메모리 전용", "In-memory browser cache only")}
                  warnings={[
                    ...(!isDiD ? [tr("단순 전후 비교는 계절성·추세·프로모션과 섞일 수 있습니다.", "Simple pre/post comparisons can mix seasonality, trend, and promotions.")] : []),
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
                    { icon: "📝", analyticsType: "text", label: tr("증분 요약 (텍스트)", "Summary (text)"), desc: tr("결론·지표·주의", "Conclusion, metrics, caveats"), onSelect: () => downloadText(card.text, lost ? "incrementality_shutdown" : "incrementality_launch") },
                  ]}
                />
              }
            />
          )}
          <div className="alloc-card" style={{ borderLeft: `3px solid ${good ? "#22c55e" : "#fbbf24"}`, marginBottom: "12px" }}>
            <div className="ab-stat-row" style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
              <Stat label={tr("전환 전 평균(일)", "Pre-cutoff daily average")} value={fmtNum(r.preMean, 1)} />
              <Stat label={tr("전환 후 평균(일)", "Post-cutoff daily average")} value={fmtNum(r.postMean, 1)} />
              <Stat label={isDiD ? tr("순효과 Δ (DiD)", "Net effect Δ (DiD)") : tr("변화 Δ(일)", "Change Δ (daily)")} value={(effVal >= 0 ? "+" : "") + fmtNum(effVal, 1)} color={good ? "#22c55e" : "#ef4444"} hint={isDiD ? tr("대조군 변화 제거", "Control group change removed") : (r.deltaPct != null ? fmtPct(r.deltaPct) : "")} />
              <Stat label={lost ? tr("총 손실(기간)", "Total loss (period)") : tr("총 증분(기간)", "Total incremental (period)")} value={(r.incrementalTotal >= 0 ? "+" : "") + fmtNum(r.incrementalTotal, 0)} hint={tr("반사실 대비 합계", "Total vs. counterfactual")} />
              <Stat label={tr("유의성", "Significance")} value={sigP != null ? (sigP < 0.05 ? tr(`유의 (p=${sigP.toFixed(4)})`, `Significant (p=${sigP.toFixed(4)})`) : tr(`비유의 (p=${sigP.toFixed(3)})`, `Not significant (p=${sigP.toFixed(3)})`)) : "—"} />
            </div>
          </div>
          <div className="chart-container" style={{ height: "320px" }}><canvas id="incr-prepost-chart"></canvas></div>
          <div className="callout" style={{ marginTop: "10px" }}><div className="ico">💡</div><div className="body"><p style={{ margin: 0, fontSize: "12px", lineHeight: 1.6 }}>
            <strong>{tr("쉽게 말하면:", "In plain terms:")}</strong> {tr(
              <>전환 시점 {lost ? "끈" : "켠"} 뒤 하루 평균이 {fmtNum(r.preMean, 1)} → {fmtNum(r.postMean, 1)}로 {(effVal >= 0 ? "+" : "") + fmtNum(effVal, 1)} {effVal >= 0 ? "올랐" : "떨어졌"}습니다. {lost ? "이 하락분이 그걸 끄면서 잃은 성과" : "이 상승분이 새로 켜서 얻은 성과"}입니다.{isDiD && " (대조군의 자연 변화를 뺀 순효과)"}</>,
              <>After the day it was turned {lost ? "off" : "on"}, the daily average went from {fmtNum(r.preMean, 1)} to {fmtNum(r.postMean, 1)}, {effVal >= 0 ? "up" : "down"} by {(effVal >= 0 ? "+" : "") + fmtNum(effVal, 1)}. {lost ? "This drop is the performance lost from turning it off" : "This rise is the performance gained from turning it on"}.{isDiD && " (net effect after removing the control group's natural change)"}</>
            )}
          </p></div></div>
          <div className="callout warn" style={{ marginTop: "8px" }}><div className="ico">!</div><div className="body"><p style={{ margin: 0, fontSize: "11.5px", lineHeight: 1.6 }}>
            <strong>{tr("정직하게:", "To be honest:")}</strong> {tr(
              <>단순 전후 비교는 그 사이 계절·프로모션·시장 변화가 섞일 수 있습니다. {isDiD ? "대조군 DiD로 공통 추세는 제거했지만," : "대조군(변하지 않은 그룹)을 넣어 DiD로 보정하면 더 정확합니다."} 무작위 실험이 아니면 인과를 단정하지 마세요.</>,
              <>A simple before/after comparison can mix in seasonality, promotions, or market changes over that time. {isDiD ? "DiD with a control group removes common trend, but" : "Adding a control group (a group that didn&apos;t change) and correcting with DiD would be more accurate."} If it wasn&apos;t a randomized experiment, don&apos;t assert causality.</>
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
