"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Papa from "papaparse";
import Chart from "chart.js/auto";
import { useAppStore } from "@/store/useDataStore";
import { getCssVar } from "@/utils/chartUtils";
import {
  buildPaidOrganicTrend,
  buildPaidOrganicTrendDemo,
  guessPaidOrganicColumns,
} from "@/utils/paidOrganicTrend";

const COPY = {
  ko: {
    eyebrow: "빠른 패턴 체크",
    title: "Paid·Organic 변화맵",
    deck: "주별 Paid와 Organic의 움직임을 한 장에서 확인합니다. 최근 주차일수록 점이 진해집니다.",
    uploadTitle: "주별 성과 CSV를 올려주세요",
    uploadDesc: "필수: 날짜·Paid 성과·(전체 성과 또는 Organic 성과). 일별 데이터도 주간으로 자동 합산합니다.",
    upload: "CSV 선택",
    demo: "예시로 보기",
    mapping: "컬럼 확인",
    mappingDesc: "Organic 컬럼이 없으면 전체 성과 − Paid 성과로 계산합니다.",
    date: "날짜·주차",
    total: "전체 성과",
    paid: "Paid 성과",
    organic: "Organic 성과",
    optional: "선택 안 함",
    sourceDirect: "Organic 원본 컬럼 사용",
    sourceDerived: "Organic = 전체 − Paid",
    recentOrganic: "최근 4주 Organic",
    recentPaid: "최근 4주 Paid",
    opposite: "반대 방향 주차",
    chartTitle: "주별 WoW 변화 궤적",
    chartDesc: "X축은 Organic WoW, Y축은 Paid WoW입니다. 선은 시간순이며 가장 진한 점이 최신 주차입니다.",
    newest: "최신",
    watchTitle: "Paid↑ · Organic↓ 패턴이 반복됩니다",
    watchBody: "어트리뷰션 이동인지 실제 잠식인지 이 차트만으로는 구분할 수 없습니다. 지출·계절·시차를 포함한 정밀 진단으로 확인하세요.",
    growthTitle: "Paid와 Organic이 함께 성장하는 주가 많습니다",
    growthBody: "현재 변화맵에서는 뚜렷한 대체 패턴보다 동반 상승이 더 자주 보입니다. 단, 이 결과도 인과 효과를 증명하지 않습니다.",
    mixedTitle: "한 방향으로 반복되는 패턴은 아직 뚜렷하지 않습니다",
    mixedBody: "최근 주차가 더 쌓이거나 큰 집행 변화가 생긴 뒤 다시 확인하세요. 작은 등락은 잠식 신호로 세지 않습니다.",
    cta: "카니발 정밀 진단 열기",
    ctaHint: "지출 컬럼까지 포함해 시차·순증분·채널별 신호를 확인합니다.",
    invalid: (rows, weeks) => `읽지 못한 행 ${rows}개 · Total보다 Paid가 큰 주 ${weeks}개 제외`,
    insufficient: "비교 가능한 주차가 2개 이상 필요합니다. 날짜와 숫자 컬럼을 확인하세요.",
    privacy: "원본 CSV는 서버로 전송되지 않고 이 브라우저 메모리에서만 처리됩니다.",
  },
  en: {
    eyebrow: "QUICK PATTERN CHECK",
    title: "Paid · Organic Movement Map",
    deck: "See how weekly Paid and Organic outcomes move together. Newer weeks appear as darker points.",
    uploadTitle: "Upload weekly outcome data",
    uploadDesc: "Required: date, Paid outcome, and either Total or Organic outcome. Daily rows are aggregated to weeks.",
    upload: "Choose CSV",
    demo: "View example",
    mapping: "Confirm columns",
    mappingDesc: "When Organic is unavailable, it is calculated as Total minus Paid.",
    date: "Date / week",
    total: "Total outcome",
    paid: "Paid outcome",
    organic: "Organic outcome",
    optional: "Not selected",
    sourceDirect: "Using the Organic source column",
    sourceDerived: "Organic = Total − Paid",
    recentOrganic: "Latest 4wk Organic",
    recentPaid: "Latest 4wk Paid",
    opposite: "Opposite-direction weeks",
    chartTitle: "Weekly WoW movement path",
    chartDesc: "X is Organic WoW and Y is Paid WoW. The line follows time; the darkest point is the latest week.",
    newest: "Latest",
    watchTitle: "Paid↑ · Organic↓ repeats across recent weeks",
    watchBody: "This chart alone cannot separate attribution movement from real displacement. Continue to the detailed diagnosis with spend, seasonality, and lag evidence.",
    growthTitle: "Paid and Organic often grow together",
    growthBody: "Co-growth appears more often than a clear substitution pattern. This still does not prove causal media impact.",
    mixedTitle: "No repeated direction is clear yet",
    mixedBody: "Check again after more weeks or a material spend change. Small movements are not counted as a displacement signal.",
    cta: "Open detailed cannibalization diagnosis",
    ctaHint: "Add spend columns to inspect lag, net incrementality, and channel-level evidence.",
    invalid: (rows, weeks) => `${rows} unreadable row(s) · ${weeks} week(s) with Paid above Total excluded`,
    insufficient: "At least two comparable weeks are required. Check the date and numeric columns.",
    privacy: "The source CSV stays in browser memory and is never sent to a server.",
  },
};

function rgba(color, alpha) {
  const value = String(color || "").trim();
  const hex = value.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = Number.parseInt(hex[1], 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
  }
  const rgb = value.match(/^rgba?\(([^)]+)\)$/i);
  if (rgb) return `rgba(${rgb[1].split(",").slice(0, 3).join(",")},${alpha})`;
  return `rgba(79,126,247,${alpha})`;
}

function fmtPct(value) {
  if (!Number.isFinite(value)) return "—";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(1)}%`;
}

function fmtNumber(value) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export default function PaidOrganicTrend({ locale = "ko" }) {
  const C = COPY[locale] || COPY.ko;
  const csvData = useAppStore((state) => state.csvData);
  const setCsvData = useAppStore((state) => state.setCsvData);
  const isDarkMode = useAppStore((state) => state.isDarkMode);
  const guessedMapping = useMemo(() => guessPaidOrganicColumns(csvData?.headers || []), [csvData?.headers]);
  const [mappingState, setMappingState] = useState(() => ({ raw: csvData?.raw, values: guessedMapping }));
  const mapping = mappingState.raw === csvData?.raw ? mappingState.values : guessedMapping;
  const [uploadError, setUploadError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef(null);
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const hasData = Boolean(csvData?.raw?.length);

  const result = useMemo(
    () => buildPaidOrganicTrend(csvData?.raw || [], mapping),
    [csvData?.raw, mapping],
  );

  const readFile = (file) => {
    if (!file) return;
    setUploadError("");
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      worker: true,
      complete: (parsed) => {
        const headers = parsed.meta?.fields || [];
        if (!headers.length || !parsed.data?.length || parsed.errors?.some((error) => error.type === "Quotes")) {
          setUploadError(locale === "en" ? "The CSV could not be read. Check its header row and quotes." : "CSV를 읽지 못했습니다. 헤더 행과 따옴표 형식을 확인하세요.");
          return;
        }
        setCsvData({ raw: parsed.data, headers, mapping: {}, fileName: file.name });
      },
      error: () => setUploadError(locale === "en" ? "The file could not be opened." : "파일을 열지 못했습니다."),
    });
  };

  useEffect(() => {
    chartRef.current?.destroy();
    chartRef.current = null;
    if (!canvasRef.current || result.recent.length < 1) return undefined;
    const primary = getCssVar("--chart-primary") || getCssVar("--primary") || "#4f7ef7";
    const text = getCssVar("--text-muted") || "#75839a";
    const grid = getCssVar("--border") || "rgba(120,135,155,.2)";
    const danger = getCssVar("--danger") || "#ef6b73";
    const points = result.recent;
    const quadrantPlugin = {
      id: "paidOrganicQuadrant",
      beforeDraw(chart) {
        const { ctx, chartArea, scales } = chart;
        if (!chartArea || !scales.x || !scales.y) return;
        const x0 = Math.max(chartArea.left, Math.min(chartArea.right, scales.x.getPixelForValue(0)));
        const y0 = Math.max(chartArea.top, Math.min(chartArea.bottom, scales.y.getPixelForValue(0)));
        ctx.save();
        ctx.fillStyle = rgba(danger, isDarkMode ? 0.11 : 0.07);
        ctx.fillRect(chartArea.left, chartArea.top, Math.max(0, x0 - chartArea.left), Math.max(0, y0 - chartArea.top));
        ctx.fillStyle = rgba(danger, isDarkMode ? 0.8 : 0.72);
        ctx.font = "600 10px ui-monospace, SFMono-Regular, Menlo, monospace";
        ctx.fillText("PAID ↑ · ORGANIC ↓", chartArea.left + 10, chartArea.top + 17);
        ctx.restore();
      },
      afterDatasetsDraw(chart) {
        const meta = chart.getDatasetMeta(0);
        const point = meta.data.at(-1);
        if (!point) return;
        const label = points.at(-1)?.week || "";
        chart.ctx.save();
        chart.ctx.fillStyle = getCssVar("--text-primary") || "#172232";
        chart.ctx.font = "700 10px ui-monospace, SFMono-Regular, Menlo, monospace";
        chart.ctx.fillText(label, Math.min(point.x + 9, chart.chartArea.right - 72), Math.max(point.y - 9, chart.chartArea.top + 12));
        chart.ctx.restore();
      },
    };
    const pointColors = points.map((_, index) => rgba(primary, 0.22 + (index / Math.max(1, points.length - 1)) * 0.78));
    const pointBorders = points.map((_, index) => index === points.length - 1 ? (getCssVar("--text-primary") || "#172232") : rgba(primary, 0.45));
    chartRef.current = new Chart(canvasRef.current.getContext("2d"), {
      type: "scatter",
      plugins: [quadrantPlugin],
      data: {
        datasets: [{
          label: locale === "en" ? "Weekly path" : "주별 경로",
          data: points,
          showLine: true,
          borderColor: rgba(primary, 0.38),
          borderWidth: 1.5,
          tension: 0.12,
          pointBackgroundColor: pointColors,
          pointBorderColor: pointBorders,
          pointBorderWidth: points.map((_, index) => index === points.length - 1 ? 2 : 1),
          pointRadius: points.map((_, index) => index === points.length - 1 ? 6 : 4.2),
          pointHoverRadius: 7,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 260 },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "rgba(15,23,42,.94)",
            padding: 11,
            callbacks: {
              title: (items) => items[0]?.raw?.week || "",
              label: (context) => [
                `Organic WoW ${fmtPct(context.raw.x)} · ${fmtNumber(context.raw.organic)}`,
                `Paid WoW ${fmtPct(context.raw.y)} · ${fmtNumber(context.raw.paid)}`,
              ],
            },
          },
        },
        scales: {
          x: {
            title: { display: true, text: "Organic WoW (%)", color: text, font: { weight: 700 } },
            ticks: { color: text, callback: (value) => `${value}%` },
            grid: { color: (context) => Number(context.tick?.value) === 0 ? rgba(text, 0.8) : grid, lineWidth: (context) => Number(context.tick?.value) === 0 ? 1.8 : 1 },
          },
          y: {
            title: { display: true, text: "Paid WoW (%)", color: text, font: { weight: 700 } },
            ticks: { color: text, callback: (value) => `${value}%` },
            grid: { color: (context) => Number(context.tick?.value) === 0 ? rgba(text, 0.8) : grid, lineWidth: (context) => Number(context.tick?.value) === 0 ? 1.8 : 1 },
          },
        },
      },
    });
    requestAnimationFrame(() => chartRef.current?.resize());
    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [isDarkMode, locale, result.recent]);

  const setColumn = (key, value) => setMappingState({ raw: csvData?.raw, values: { ...mapping, [key]: value } });
  const sourceLabel = mapping.organic ? C.sourceDirect : C.sourceDerived;
  const verdictCopy = result.verdict === "watch"
    ? [C.watchTitle, C.watchBody, "watch"]
    : result.verdict === "co-growth"
      ? [C.growthTitle, C.growthBody, "growth"]
      : [C.mixedTitle, C.mixedBody, "mixed"];

  return (
    <div className="paid-organic-tool">
      <div className="page-eyebrow">{C.eyebrow}</div>
      <h1 className="page-title">{C.title}</h1>
      <p className="page-deck">{C.deck}</p>

      {!hasData ? (
        <section
          className={`paid-organic-upload${isDragging ? " is-dragging" : ""}`}
          onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => { event.preventDefault(); setIsDragging(false); readFile(event.dataTransfer.files?.[0]); }}
        >
          <div className="paid-organic-upload__mark" aria-hidden="true">↗</div>
          <div>
            <h2>{C.uploadTitle}</h2>
            <p>{C.uploadDesc}</p>
            <small>{C.privacy}</small>
          </div>
          <div className="paid-organic-upload__actions">
            <button type="button" className="btn primary" onClick={() => fileRef.current?.click()}>{C.upload}</button>
            <button type="button" className="btn" onClick={() => setCsvData(buildPaidOrganicTrendDemo(locale))}>{C.demo}</button>
          </div>
          <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(event) => readFile(event.target.files?.[0])} />
          {uploadError && <p className="paid-organic-upload__error" role="alert">{uploadError}</p>}
        </section>
      ) : (
        <>
          <section className="paid-organic-mapping" aria-labelledby="paid-organic-mapping-title">
            <header>
              <div><span>01 · INPUT</span><h2 id="paid-organic-mapping-title">{C.mapping}</h2></div>
              <p>{C.mappingDesc}</p>
            </header>
            <div className="paid-organic-mapping__grid">
              {[
                ["date", C.date, true],
                ["total", C.total, !mapping.organic],
                ["paid", C.paid, true],
                ["organic", C.organic, false],
              ].map(([key, label, required]) => (
                <label key={key}>
                  <span>{label}{required ? " *" : ""}</span>
                  <select value={mapping[key] || ""} onChange={(event) => setColumn(key, event.target.value)}>
                    <option value="">{C.optional}</option>
                    {(csvData.headers || []).map((header) => <option key={header} value={header}>{header}</option>)}
                  </select>
                </label>
              ))}
            </div>
            <footer><span>{sourceLabel}</span><b>{csvData.fileName}</b></footer>
          </section>

          {result.points.length >= 1 ? (
            <>
              <section className="paid-organic-summary" aria-label={locale === "en" ? "Movement summary" : "변화 요약"}>
                <article><span>{C.recentOrganic}</span><strong className={result.recentOrganicChange < 0 ? "is-down" : "is-up"}>{fmtPct(result.recentOrganicChange)}</strong></article>
                <article><span>{C.recentPaid}</span><strong className={result.recentPaidChange < 0 ? "is-down" : "is-up"}>{fmtPct(result.recentPaidChange)}</strong></article>
                <article><span>{C.opposite}</span><strong>{result.oppositeCount}/{result.meaningfulCount || 0}</strong></article>
              </section>

              <section className="paid-organic-chart-card">
                <header><div><span>02 · MOVEMENT MAP</span><h2>{C.chartTitle}</h2></div><p>{C.chartDesc}</p></header>
                <div className="paid-organic-chart"><canvas ref={canvasRef}></canvas></div>
                {(result.invalidRows > 0 || result.invalidWeeks > 0) && <small className="paid-organic-quality">{C.invalid(result.invalidRows, result.invalidWeeks)}</small>}
              </section>

              <section className={`paid-organic-verdict is-${verdictCopy[2]}`}>
                <div><span>03 · NEXT CHECK</span><h2>{verdictCopy[0]}</h2><p>{verdictCopy[1]}</p></div>
                <div className="paid-organic-verdict__action">
                  <Link href={locale === "en" ? "/en/tools/cannibalization-diagnosis" : "/tools/cannibalization-diagnosis"}>{C.cta} <b aria-hidden="true">→</b></Link>
                  <small>{C.ctaHint}</small>
                </div>
              </section>
            </>
          ) : (
            <div className="callout warn paid-organic-insufficient" role="status"><div className="ico">!</div><div className="body">{C.insufficient}</div></div>
          )}
        </>
      )}
    </div>
  );
}
