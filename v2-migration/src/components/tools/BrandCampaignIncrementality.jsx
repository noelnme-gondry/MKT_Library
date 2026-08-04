"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Papa from "papaparse";
import Chart from "chart.js/auto";

import { useAppStore } from "@/store/useDataStore";
import { CHART_THEME, chartCommonOpts } from "@/utils/chartUtils";
import { downloadCsv } from "@/utils/download";
import { parseCampaignFlag, runBrandInterruptedTimeSeries } from "@/utils/brandIncrementalityMath";
import { fmtNum, parseNum } from "@/utils/format";

const tx = (locale, ko, en) => locale === "en" ? en : ko;
const isNumericColumn = (rows, header) => rows.slice(0, 100).filter((row) => Number.isFinite(parseNum(row?.[header]))).length >= Math.min(3, rows.length);

function findHeader(headers, mapping, field, patterns) {
  const mapped = headers.find((header) => mapping?.[header] === field);
  if (mapped) return mapped;
  return headers.find((header) => patterns.some((pattern) => pattern.test(String(header)))) || "";
}

function brandDemo() {
  const start = Date.UTC(2025, 0, 1);
  return Array.from({ length: 49 }, (_, index) => {
    const date = new Date(start + index * 86400000).toISOString().slice(0, 10);
    const weekdayPattern = [5, 2, -3, 1, 4, 8, 12][index % 7];
    const campaignOn = index >= 35 ? "on" : "off";
    return { date, brand_search: Math.round(180 + index * 1.6 + weekdayPattern + (index >= 35 ? 42 : 0)), campaign_on: campaignOn };
  });
}

function formatValue(value, locale) {
  if (!Number.isFinite(value)) return "—";
  return fmtNum(value, 0);
}

export default function BrandCampaignIncrementality({ locale = "ko" }) {
  const csvData = useAppStore((state) => state.csvData);
  const setCsvData = useAppStore((state) => state.setCsvData);
  const setDemoDisabled = useAppStore((state) => state.setDemoDisabled);
  const [dataPath, setDataPath] = useState("its");
  const [dateColumn, setDateColumn] = useState("");
  const [outcomeColumn, setOutcomeColumn] = useState("");
  const [campaignColumn, setCampaignColumn] = useState("");
  const [analysisSignature, setAnalysisSignature] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef(null);
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const hasData = (csvData?.raw || []).length > 0 && (csvData?.headers || []).length > 0;

  const headers = csvData.headers || [];
  const resolvedDateColumn = dateColumn || findHeader(headers, csvData.mapping, "date", [/^date$/i, /날짜|일자/]);
  const resolvedOutcomeColumn = outcomeColumn || findHeader(headers, csvData.mapping, "brand_search", [/brand.*search/i, /브랜드.*검색/i]) || findHeader(headers, csvData.mapping, "direct_traffic", [/direct.*traffic/i, /직접.*유입/i]) || findHeader(headers, csvData.mapping, "installs", [/install|설치/i]) || findHeader(headers, csvData.mapping, "actions", [/action|conversion|signup|가입|전환/i]);
  const resolvedCampaignColumn = campaignColumn || findHeader(headers, csvData.mapping, "campaign_on", [/campaign.*(on|status|active)/i, /집행.*여부|브랜드.*캠페인|캠페인.*온/i]);
  const buildRows = useCallback(() => (csvData.raw || []).map((row) => ({
    date: row?.[resolvedDateColumn],
    outcome: row?.[resolvedOutcomeColumn],
    campaignOn: row?.[resolvedCampaignColumn],
  })), [csvData.raw, resolvedCampaignColumn, resolvedDateColumn, resolvedOutcomeColumn]);
  const currentSignature = `${csvData.fileName}|${csvData.raw?.length || 0}|${resolvedDateColumn}|${resolvedOutcomeColumn}|${resolvedCampaignColumn}`;
  const result = useMemo(() => analysisSignature === currentSignature && resolvedDateColumn && resolvedOutcomeColumn && resolvedCampaignColumn
    ? runBrandInterruptedTimeSeries({ rows: buildRows() })
    : null, [analysisSignature, buildRows, currentSignature, resolvedCampaignColumn, resolvedDateColumn, resolvedOutcomeColumn]);

  useEffect(() => {
    if (!result?.ok || !chartRef.current) return undefined;
    chartInstance.current?.destroy();
    const theme = CHART_THEME;
    const commonOptions = chartCommonOpts();
    chartInstance.current = new Chart(chartRef.current, {
      type: "line",
      data: {
        labels: result.points.map((point) => point.date),
        datasets: [
          { label: tx(locale, "실제", "Actual"), data: result.points.map((point) => point.value), borderColor: theme.primary, backgroundColor: theme.primary, borderWidth: 2, pointRadius: 1.8, tension: 0.18 },
          { label: tx(locale, "캠페인 없었을 예상", "Expected without campaign"), data: result.points.map((point) => point.counterfactual), borderColor: theme.muted, borderDash: [6, 5], borderWidth: 2, pointRadius: 0, tension: 0.18 },
        ],
      },
      options: {
        ...commonOptions,
        plugins: { ...commonOptions.plugins, legend: { ...commonOptions.plugins.legend, labels: { ...commonOptions.plugins.legend.labels, color: theme.text } } },
        scales: { x: { ...commonOptions.scales.x, ticks: { ...commonOptions.scales.x.ticks, maxTicksLimit: 8 } }, y: commonOptions.scales.y },
      },
    });
    requestAnimationFrame(() => chartInstance.current?.resize());
    return () => chartInstance.current?.destroy();
  }, [locale, result]);

  const loadRows = (rows, fileName, { isDemo = false } = {}) => {
    const headers = Object.keys(rows[0] || {});
    const mapping = Object.fromEntries(headers.map((header) => [header,
      header === "date" ? "date" : header === "campaign_on" ? "campaign_on" : header === "brand_search" ? "brand_search" : "__ignore__",
    ]));
    if (isDemo) setDemoDisabled(false);
    setCsvData({ raw: rows, headers, mapping, fileName });
    setAnalysisSignature("");
    setError("");
  };
  const handleFile = (file) => {
    if (!file) return;
    setError("");
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      worker: true,
      complete: (parsed) => {
        const rows = Array.isArray(parsed.data) ? parsed.data : [];
        const headers = parsed.meta?.fields || [];
        if (!rows.length || !headers.length || (parsed.errors || []).some((item) => item?.type === "Quotes" || item?.code === "TooManyFields")) {
          setError(tx(locale, "CSV를 읽지 못했습니다. 날짜·성과·집행 여부 열이 있는 파일인지 확인하세요.", "We could not read this CSV. Confirm it contains date, outcome, and campaign-status columns."));
          return;
        }
        loadRows(rows, file.name);
      },
      error: () => setError(tx(locale, "CSV를 읽는 중 오류가 발생했습니다.", "An error occurred while reading the CSV.")),
    });
  };
  const analyze = () => {
    if (!resolvedDateColumn || !resolvedOutcomeColumn || !resolvedCampaignColumn) {
      setError(tx(locale, "날짜·성과 지표·브랜드 캠페인 집행 여부 열을 모두 선택하세요.", "Select date, outcome, and brand-campaign status columns."));
      return;
    }
    setError("");
    setAnalysisSignature(currentSignature);
  };
  const downloadTemplate = () => downloadCsv("﻿date,brand_search,campaign_on\r\n2025-01-01,180,off\r\n2025-02-05,280,on\r\n", "brand_campaign_its_template");
  const nonNumericOutcome = resolvedOutcomeColumn && !isNumericColumn(csvData.raw || [], resolvedOutcomeColumn);
  const readiness = [
    { id: "control", icon: "★", title: tx(locale, "대조 지역·오디언스가 있다", "I have a control region or audience"), body: tx(locale, "동시에 광고를 보지 않은 비교군이 있으면 가장 강한 홀드아웃·DiD 설계로 갑니다.", "A concurrent unexposed comparison enables the strongest holdout / DiD design."), cta: tx(locale, "통제군 증분 분석 열기", "Open control-group incrementality") },
    { id: "its", icon: "↗", title: tx(locale, "날짜별 성과와 ON/OFF 시점이 있다", "I have dated outcomes and a clear ON/OFF date"), body: tx(locale, "일별·주별·월별 cadence에 맞는 최소 관측 기간으로 HAC 보정 ITS 반사실을 추정합니다.", "Run a HAC-adjusted ITS counterfactual with cadence-appropriate minimum history."), cta: tx(locale, "ITS 분석 준비", "Set up ITS") },
    { id: "prepost", icon: "△", title: tx(locale, "전후 합계만 있다", "I only have before / after totals"), body: tx(locale, "탐색적 전후 비교는 가능하지만 계절성과 공통 변화를 분리하기 어렵습니다.", "An exploratory pre/post read is possible, but seasonality and common change remain mixed."), cta: tx(locale, "전후 비교 열기", "Open pre/post comparison") },
  ];

  return <div className="tab-pane active" id="tab-brand-incrementality">
    <section className="block" style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--primary) 12%, var(--bg-2)), var(--bg-2))", border: "1px solid var(--border)", borderRadius: "14px", padding: "20px", marginBottom: "16px" }}>
      <span className="eyebrow">BRAND LIFT · NO MMM</span>
      <h2 className="section-title" style={{ marginTop: "6px" }}>{tx(locale, "브랜드 캠페인이 실제로 추가 만든 성과를 추정하세요", "Estimate the outcomes your brand campaign actually added")}</h2>
      <p className="muted" style={{ maxWidth: "760px", lineHeight: 1.65 }}>{tx(locale, "데이터 준비 수준부터 고르면 가장 강한 설계로 연결합니다. ITS는 집행 전 추세를 기준선으로 삼는 관찰 연구이므로, 대조군이 없으면 ‘인과 확정’이 아니라 추정 증가분으로만 표시합니다.", "Choose from the data you have and we route you to the strongest available design. ITS is observational: without a control, results are labeled as estimated lift, not confirmed causality.")}</p>
    </section>

    <section className="block" aria-labelledby="brand-readiness-title">
      <h2 id="brand-readiness-title" className="section-title">{tx(locale, "어떤 데이터를 준비했나요?", "What data do you have?")}</h2>
      <div className="phase-grid">
        {readiness.map((item) => item.id === "its" ? <button key={item.id} type="button" className={`phase-card phase-card-tool ${dataPath === "its" ? "active" : ""}`} onClick={() => setDataPath("its")} style={{ textAlign: "left", cursor: "pointer" }}>
          <div className="phase-card-title">{item.icon} {item.title}</div><div className="phase-card-desc">{item.body}</div><div className="phase-card-cta">{item.cta}</div>
        </button> : <Link key={item.id} className="phase-card phase-card-tool" href={locale === "en" ? "/en/tools/incrementality" : "/tools/incrementality"} style={{ textDecoration: "none" }}>
          <div className="phase-card-title">{item.icon} {item.title}</div><div className="phase-card-desc">{item.body}</div><div className="phase-card-cta">{item.cta}</div>
        </Link>)}
      </div>
    </section>

    {dataPath === "its" && <section className="block" id="brand-its-setup">
      <h2 className="section-title">{tx(locale, "ITS 데이터 준비", "Prepare ITS data")}</h2>
      <p className="muted">{tx(locale, "한 행은 하루·한 주·한 달입니다. 브랜드 검색·직접 유입·가입 중 하나를 성과 지표로 쓰고, 캠페인 집행 여부는 집행 전 OFF → 집행 후 ON인 한 번의 연속 구간이어야 합니다.", "One row is a day, week, or month. Choose brand search, direct traffic, or signups as the outcome. Campaign status must be one continuous OFF-before / ON-after window.")}</p>
      {!hasData ? <div className="csv-uploader">
        <div className="csv-dropzone" role="button" tabIndex={0} onClick={() => inputRef.current?.click()} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") inputRef.current?.click(); }}>
          <div className="csv-drop-icon">⇧</div><div className="csv-drop-text">{tx(locale, "CSV 파일 드래그 & 드롭", "Drag & drop a CSV")}</div><div className="csv-drop-sub">{tx(locale, "또는 클릭하여 선택", "or click to choose a file")}</div>
        </div>
        <input ref={inputRef} type="file" accept=".csv,text/csv" hidden onChange={(event) => { handleFile(event.target.files?.[0]); event.target.value = ""; }} />
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "10px" }}><button type="button" className="ab-pill" onClick={downloadTemplate}>{tx(locale, "CSV 양식 다운로드", "Download CSV template")}</button><button type="button" className="ab-pill" onClick={() => loadRows(brandDemo(), "demo_brand_campaign_its.csv", { isDemo: true })}>{tx(locale, "예시 데이터 보기", "View example data")}</button></div>
      </div> : <>
        <div className="file-state"><div className="meta-text"><span className="dot"></span><strong>{csvData.fileName}</strong><span className="csv-loaded-stats">{csvData.raw.length.toLocaleString()}{tx(locale, "행", " rows")}</span></div><button className="ab-pill" type="button" onClick={() => setCsvData({ raw: [], headers: [], mapping: {}, fileName: "" })}>{tx(locale, "CSV 변경", "Change CSV")}</button></div>
        <div className="mapping-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "10px", margin: "14px 0" }}>
          {[{ label: tx(locale, "날짜", "Date"), value: resolvedDateColumn, set: setDateColumn, allowed: csvData.headers }, { label: tx(locale, "성과 지표", "Outcome"), value: resolvedOutcomeColumn, set: setOutcomeColumn, allowed: csvData.headers.filter((header) => isNumericColumn(csvData.raw, header)) }, { label: tx(locale, "브랜드 캠페인 집행 여부", "Brand campaign status"), value: resolvedCampaignColumn, set: setCampaignColumn, allowed: csvData.headers }].map((field) => <label key={field.label} style={{ display: "grid", gap: "5px", fontSize: "12px" }}><span>{field.label}</span><select value={field.value} onChange={(event) => { field.set(event.target.value); setAnalysisSignature(""); }}><option value="">{tx(locale, "열 선택", "Select column")}</option>{field.allowed.map((header) => <option key={header} value={header}>{header}</option>)}</select></label>)}
        </div>
        {resolvedCampaignColumn && (csvData.raw || []).some((row) => parseCampaignFlag(row?.[resolvedCampaignColumn]) == null) && <p className="callout warn">{tx(locale, "집행 여부 열은 on/off, 1/0, 집행/중단처럼 해석 가능한 값만 사용합니다.", "Campaign status must use recognizable values such as on/off, 1/0, or active/inactive.")}</p>}
        {nonNumericOutcome && <p className="callout warn">{tx(locale, "선택한 성과 열에서 숫자를 읽지 못했습니다.", "The selected outcome column does not contain readable numbers.")}</p>}
        <button type="button" className="btn primary" onClick={analyze}>{tx(locale, "증분 추정하기", "Estimate incrementality")} <span aria-hidden>→</span></button>
      </>}
      {error && <p className="csv-upload-error" role="alert">{error}</p>}
    </section>}

    {result && !result.ok && <section className="block"><div className="callout warn"><div className="body"><strong>{tx(locale, "아직 정직한 ITS 추정을 만들 수 없습니다", "ITS is not yet identifiable")}</strong><p>{result.reason === "multiple_campaign_windows" ? tx(locale, "ON/OFF 구간이 여러 번입니다. 이번 버전은 한 번의 연속 캠페인 구간만 분석합니다. 구간 하나만 남기거나 통제군 설계를 사용하세요.", "There are multiple ON/OFF windows. This version analyzes one continuous campaign window; isolate one window or use a control-group design.") : result.reason === "insufficient_pre_periods" ? tx(locale, `집행 전 기간이 ${result.prePeriods}개입니다. 현재 cadence에는 최소 ${result.minPrePeriods}개 기간이 필요합니다.`, `There are ${result.prePeriods} pre periods; this cadence requires at least ${result.minPrePeriods}.`) : result.reason === "insufficient_post_periods" ? tx(locale, `집행 후 기간이 ${result.postPeriods}개입니다. 현재 cadence에는 최소 ${result.minPostPeriods}개 기간이 필요합니다.`, `There are ${result.postPeriods} post periods; this cadence requires at least ${result.minPostPeriods}.`) : result.reason === "zero_pretrend_variance" ? tx(locale, "집행 전 성과가 완벽한 직선이라 불확실성을 추정할 수 없습니다. 노이즈가 없는 샘플 데이터 또는 지나친 집계 여부를 확인하세요.", "The pre-period is a perfect line, so uncertainty cannot be estimated. Check for noiseless sample data or over-aggregation.") : result.reason === "hac_variance_not_estimable" ? tx(locale, "사전 기간의 HAC 불확실성을 안정적으로 추정할 수 없습니다. 기간을 늘리거나 통제군 설계를 사용하세요.", "HAC uncertainty cannot be estimated reliably from the pre-period. Add history or use a control-group design.") : tx(locale, "날짜·성과·집행 여부를 다시 확인하세요.", "Check date, outcome, and campaign-status columns.")}</p></div></div></section>}

    {result?.ok && <section className="block" id="brand-its-result">
      <h2 className="section-title">{tx(locale, "브랜드 캠페인 증분 추정", "Estimated brand-campaign lift")}</h2>
      <div className="metric-grid" style={{ marginBottom: "16px" }}>
        <div className="metric-card"><span>{tx(locale, "추정 증가분", "Estimated incremental outcome")}</span><strong>{formatValue(result.incrementalTotal, locale)}</strong><small>{result.incrementalRate == null ? "—" : `${result.incrementalRate >= 0 ? "+" : ""}${(result.incrementalRate * 100).toFixed(1)}% ${tx(locale, "기준선 대비", "vs baseline")}`}</small></div>
        <div className="metric-card"><span>{tx(locale, "캠페인 없었을 예상", "Expected without campaign")}</span><strong>{formatValue(result.counterfactualTotal, locale)}</strong><small>{tx(locale, `${result.prePeriods}개 사전 기간 추세`, `${result.prePeriods} pre-period trend`)}</small></div>
        <div className="metric-card"><span>95% CI</span><strong>{formatValue(result.ci95[0], locale)} ~ {formatValue(result.ci95[1], locale)}</strong><small>{tx(locale, "모델 불확실성 기준", "model uncertainty")}</small></div>
      </div>
      <div className="callout"><div className="body"><strong>{result.ci95[0] > 0 ? tx(locale, "관찰된 증가분은 HAC 보정 불확실성 범위보다 큽니다.", "Observed lift exceeds the HAC-adjusted uncertainty range.") : tx(locale, "증가 신호는 있지만, HAC 보정 불확실성을 넘었다고 말하기 어렵습니다.", "There is a lift signal, but it does not clearly exceed HAC-adjusted uncertainty.")}</strong><p>{tx(locale, `캠페인 시작일 ${result.campaignStartDate} 이후 실제 성과와 사전 추세 기반 반사실을 비교했습니다. 대조군이 없으므로 계절성·PR·프로모션 영향은 분리되지 않습니다.`, `We compare actual outcomes after ${result.campaignStartDate} with a pre-trend counterfactual. Without a control, seasonality, PR, and promotions are not separated.`)}</p></div></div>
      <div className="chart-container" style={{ height: "320px", marginTop: "16px" }}><canvas ref={chartRef} /></div>
      <details style={{ marginTop: "14px" }}><summary>{tx(locale, "근거·한계 확인", "Review evidence and limitations")}</summary><ul><li>{tx(locale, `사전 ${result.prePeriods}기간 · 집행 ${result.postPeriods}기간 · 사전 추세 일평균 변화 ${result.trend.slopePerDay.toFixed(2)}`, `${result.prePeriods} pre periods · ${result.postPeriods} campaign periods · pre-trend daily change ${result.trend.slopePerDay.toFixed(2)}`)}</li><li>{tx(locale, `사전 추세 적합도 R² ${result.trend.rSquared == null ? "추정 불가" : result.trend.rSquared.toFixed(2)}`, `Pre-trend R² ${result.trend.rSquared == null ? "not estimable" : result.trend.rSquared.toFixed(2)}`)}</li><li>{tx(locale, `Newey–West HAC 표준오차(랙 ${result.diagnostics.hacLag})와 t 분포로 95% CI를 계산했습니다. iid 가정 표준오차 ${formatValue(result.iidStandardError, locale)}보다 ${formatValue(result.standardError, locale)}를 사용합니다.`, `The 95% CI uses Newey–West HAC standard errors (lag ${result.diagnostics.hacLag}) and a t distribution: ${formatValue(result.standardError, locale)} rather than iid ${formatValue(result.iidStandardError, locale)}.`)}</li><li>{result.diagnostics.hasPeriodGaps ? tx(locale, `${result.diagnostics.grain === "week" ? "주" : result.diagnostics.grain === "month" ? "월" : "일"} 단위 누락 기간이 ${result.diagnostics.missingPeriods}개 있습니다. 가장 긴 간격은 ${result.diagnostics.maxGapDays}일입니다.`, `There are ${result.diagnostics.missingPeriods} missing ${result.diagnostics.grain} period(s); the longest gap is ${result.diagnostics.maxGapDays} days.`) : tx(locale, `${result.diagnostics.grain === "week" ? "주간" : result.diagnostics.grain === "month" ? "월간" : "일별"} cadence에서 누락 기간은 발견되지 않았습니다.`, `No missing periods were detected for the ${result.diagnostics.grain} cadence.`)}</li>{result.diagnostics.invalidRows > 0 && <li>{tx(locale, `날짜·성과·집행 여부가 유효하지 않은 ${result.diagnostics.invalidRows}행은 제외했습니다.`, `${result.diagnostics.invalidRows} row(s) with invalid date, outcome, or campaign status were excluded.`)}</li>}<li>{tx(locale, "HAC는 잔차 자기상관으로 과소평가되던 불확실성을 보정하지만, 대조군 없는 관찰 연구의 계절성·PR·프로모션 교란은 제거하지 못합니다.", "HAC corrects uncertainty that serially correlated residuals can understate, but it cannot remove seasonality, PR, or promotion confounding without a control.")}</li><li>{tx(locale, "다음 캠페인에서는 비집행 지역·오디언스를 남겨 홀드아웃/DiD로 인과 근거를 강화하세요.", "For the next campaign, retain an unexposed region or audience to strengthen causal evidence with holdout / DiD.")}</li></ul></details>
    </section>}
  </div>;
}
