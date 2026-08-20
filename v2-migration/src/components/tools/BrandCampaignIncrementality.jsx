"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Papa from "papaparse";
import Chart from "@/utils/chartGlobals";

import { useAppStore } from "@/store/useDataStore";
import ResultActionCard from "@/components/ds/ResultActionCard";
import DownloadHub from "@/components/ds/DownloadHub";
import CsvGuide from "@/components/ds/CsvGuide";
import { analysisResultEventKey, trackProductEvent, trackProductEventOnce } from "@/lib/analytics";
import { CHART_THEME, chartCommonOpts } from "@/utils/chartUtils";
import { downloadCsv } from "@/utils/download";
import { parseCampaignFlag, runBrandInterruptedTimeSeries } from "@/utils/brandIncrementalityMath";
import { fmtNum, parseNum } from "@/utils/format";
import { prepareSemanticParallelData } from "@/lib/data-import/prepareSemanticParallelData";

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
  const isDemo = String(csvData?.fileName || "").startsWith("demo_");

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
  // 데모는 필요한 역할이 고정돼 있으므로 시작 버튼을 누른 즉시 결과를 보여 준다.
  // 실제 파일은 사용자가 열 역할을 확인한 뒤에만 명시적으로 분석한다.
  const result = useMemo(() => (isDemo || analysisSignature === currentSignature) && resolvedDateColumn && resolvedOutcomeColumn && resolvedCampaignColumn
    ? runBrandInterruptedTimeSeries({ rows: buildRows() })
    : null, [analysisSignature, buildRows, currentSignature, isDemo, resolvedCampaignColumn, resolvedDateColumn, resolvedOutcomeColumn]);
  const profile = result?.diagnostics?.ar1Profile || null;
  const profileReady = result?.ok === true && Array.isArray(result.profileInterval) && result.profileInterval.length === 2 && profile;
  const profileEstimate = profileReady ? result.profileIncrementalTotal : null;
  const profileCounterfactual = profileReady ? result.profileCounterfactualTotal : null;
  const profileRate = profileCounterfactual ? profileEstimate / Math.abs(profileCounterfactual) : null;
  const directionalVerdictWithheld = !profileReady || profile.hitsBoundary || result.diagnostics.ar1EvidenceTier === "exploratory";
  const hasProfileLiftSignal = !directionalVerdictWithheld && result.profileInterval[0] > 0;

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
          { label: tx(locale, "캠페인 없었을 예상", "Expected without campaign"), data: result.points.map((point) => result.profileTrend ? result.profileTrend.intercept + result.profileTrend.slope * point.time : point.counterfactual), borderColor: theme.muted, borderDash: [6, 5], borderWidth: 2, pointRadius: 0, tension: 0.18 },
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
    setCsvData({ raw: rows, headers, mapping, fileName, ...prepareSemanticParallelData({ raw: rows, headers }) });
    setAnalysisSignature("");
    setError("");
  };
  const handleFile = (file) => {
    if (!file) return;
    setError("");
    trackProductEvent("data_import_start", { tool_id: "5-24", source: "csv", locale });
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      worker: true,
      complete: (parsed) => {
        const rows = Array.isArray(parsed.data) ? parsed.data : [];
        const headers = parsed.meta?.fields || [];
        if (!rows.length || !headers.length || (parsed.errors || []).some((item) => item?.type === "Quotes" || item?.code === "TooManyFields")) {
          trackProductEvent("data_import_failed", { tool_id: "5-24", source: "csv", state: "parse_error", locale });
          setError(tx(locale, "CSV를 읽지 못했습니다. 날짜·성과·집행 여부 열이 있는 파일인지 확인하세요.", "We could not read this CSV. Confirm it contains date, outcome, and campaign-status columns."));
          return;
        }
        loadRows(rows, file.name);
        trackProductEvent("data_import_success", { tool_id: "5-24", source: "csv", row_count: rows.length, column_count: headers.length, locale });
      },
      error: () => {
        trackProductEvent("data_import_failed", { tool_id: "5-24", source: "csv", state: "parse_error", locale });
        setError(tx(locale, "CSV를 읽는 중 오류가 발생했습니다.", "An error occurred while reading the CSV."));
      },
    });
  };
  const analyze = () => {
    if (!resolvedDateColumn || !resolvedOutcomeColumn || !resolvedCampaignColumn) {
      setError(tx(locale, "날짜·성과 지표·브랜드 캠페인 집행 여부 열을 모두 선택하세요.", "Select date, outcome, and brand-campaign status columns."));
      return;
    }
    setError("");
    trackProductEventOnce("analysis_started", analysisResultEventKey("5-24", "brand_incrementality", currentSignature, "", locale), {
      tool_id: "5-24", source: "csv", row_count: csvData.raw?.length || 0, analysis_type: "brand_incrementality", locale,
    });
    setAnalysisSignature(currentSignature);
  };
  const downloadTemplate = () => downloadCsv("﻿date,brand_search,campaign_on\r\n2025-01-01,180,off\r\n2025-02-05,280,on\r\n", "brand_campaign_its_template");
  const nonNumericOutcome = resolvedOutcomeColumn && !isNumericColumn(csvData.raw || [], resolvedOutcomeColumn);
  const readiness = [
    { id: "control", icon: "★", title: tx(locale, "대조 지역·오디언스가 있다", "I have a control region or audience"), body: tx(locale, "동시에 광고를 보지 않은 비교군이 있으면 가장 강한 홀드아웃·DiD 설계로 갑니다.", "A concurrent unexposed comparison enables the strongest holdout / DiD design."), cta: tx(locale, "통제군 증분 분석 열기", "Open control-group incrementality") },
    { id: "its", icon: "↗", title: tx(locale, "날짜별 성과와 ON/OFF 시점이 있다", "I have dated outcomes and a clear ON/OFF date"), body: tx(locale, "일별·주별·월별 cadence에 맞는 최소 관측 기간으로 AR(1) ITS 반사실을 추정합니다.", "Run an AR(1) ITS counterfactual with cadence-appropriate minimum history."), cta: tx(locale, "ITS 분석 준비", "Set up ITS") },
    { id: "prepost", icon: "△", title: tx(locale, "전후 합계만 있다", "I only have before / after totals"), body: tx(locale, "탐색적 전후 비교는 가능하지만 계절성과 공통 변화를 분리하기 어렵습니다.", "An exploratory pre/post read is possible, but seasonality and common change remain mixed."), cta: tx(locale, "전후 비교 열기", "Open pre/post comparison") },
  ];
  const brandHeadline = !profileReady
    ? tx(locale, "AR(1) 불확실성을 포함한 증분 구간을 만들 수 없습니다", "An interval including AR(1) uncertainty could not be formed")
    : directionalVerdictWithheld
      ? tx(locale, "방향 판정 보류 · 추정치는 탐색용입니다", "Direction withheld · estimate is exploratory")
      : hasProfileLiftSignal
        ? tx(locale, "관찰상 증가 신호가 남지만 인과 증명은 아닙니다", "An observational lift signal remains, but it is not causal proof")
        : tx(locale, "증가를 변화 없음과 구분하기 어렵습니다", "Lift cannot be separated from no change");
  // 결과 내보내기. 이 도구는 오래도록 **입력 템플릿만** 받을 수 있고 추정 증가분·
  // 반사실·AR(1) 구간을 화면 밖으로 꺼낼 방법이 없었다(§12.27 "계산한 인사이트만"에
  // 정면으로 어긋남 — 원자료가 아니라 계산 결과가 없어서 못 받던 경우).
  const csvCell = (value) => {
    const text = value == null ? "" : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const buildCsv = (rows) => `﻿${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
  const downloadSeries = () => {
    if (!result?.ok) return;
    const header = ["date", "campaign_on", "actual", "counterfactual", "incremental"];
    const rows = (result.points || []).map((point) => [
      point.date,
      point.date >= result.campaignStartDate ? "on" : "off",
      point.value,
      point.counterfactual,
      point.incremental,
    ]);
    downloadCsv(buildCsv([header, ...rows]), "brand_campaign_its_series");
  };
  const downloadSummary = () => {
    if (!result?.ok) return;
    const rows = [
      [tx(locale, "항목", "Field"), tx(locale, "값", "Value")],
      [tx(locale, "캠페인 시작일", "Campaign start date"), result.campaignStartDate],
      [tx(locale, "사전 기간 수", "Pre periods"), result.prePeriods],
      [tx(locale, "집행 기간 수", "Post periods"), result.postPeriods],
      [tx(locale, "실제 합계", "Actual total"), result.actualTotal],
      [tx(locale, "반사실 합계", "Counterfactual total"), profileCounterfactual],
      [tx(locale, "추정 증가분", "Estimated incremental"), profileEstimate],
      [tx(locale, "95% AR(1) 프로파일 하한", "95% AR(1) profile lower"), profileReady ? result.profileInterval[0] : ""],
      [tx(locale, "95% AR(1) 프로파일 상한", "95% AR(1) profile upper"), profileReady ? result.profileInterval[1] : ""],
      [tx(locale, "AR(1) rho (MLE)", "AR(1) rho (MLE)"), profile?.rhoMle ?? ""],
      [tx(locale, "판정", "Verdict"), brandHeadline],
      // 다운로드본만 따로 돌아다녀도 설계 한계를 잃지 않게 같이 적는다(§8).
      [tx(locale, "한계", "Limitation"), tx(locale,
        "통제군 없는 ITS 관찰 추정입니다. 계절성·PR·프로모션 영향은 분리되지 않습니다.",
        "Observational ITS without a control. Seasonality, PR, and promotions are not separated.")],
    ];
    downloadCsv(buildCsv(rows), "brand_campaign_its_summary");
  };
  const brandDecisionPrefill = result?.ok && !isDemo ? {
    conclusion: !profileReady
      ? tx(locale, "AR(1) 불확실성을 포함한 증분 구간을 만들 수 없어 추가 기간 또는 통제군이 필요합니다.", "An incrementality interval including AR(1) uncertainty could not be formed; add history or a control.")
      : hasProfileLiftSignal
        ? tx(locale, `관찰상 추정 증가분 ${formatValue(profileEstimate, locale)} 신호가 남지만 통제군 없는 인과 증명은 아닙니다.`, `An observed estimated lift of ${formatValue(profileEstimate, locale)} remains, but this is not causal proof without a control.`)
        : tx(locale, "현재 데이터에서는 증가를 변화 없음과 분리하기 어렵습니다.", "Current data cannot separate lift from no change."),
    action: hasProfileLiftSignal
      ? tx(locale, "다음 브랜드 캠페인에는 비집행 비교군을 남겨 증분 효과를 다시 검증한다", "Keep an unexposed comparison group for the next brand campaign and revalidate incrementality")
      : tx(locale, "추가 사전 기간 또는 통제군을 확보한 뒤 브랜드 증분을 다시 추정한다", "Add pre-period history or a control, then re-estimate brand incrementality"),
    metric: tx(locale, "추정 증가분", "Estimated incremental outcome"),
    baseline: formatValue(profileEstimate, locale),
    targetDirection: "neutral",
    sourcePeriod: tx(locale, `사전 ${result.prePeriods}기간 · 집행 ${result.postPeriods}기간`, `${result.prePeriods} pre periods · ${result.postPeriods} campaign periods`),
    reviewQuestion: tx(locale, "새 데이터와 비교군을 포함하면 브랜드 캠페인의 순증분을 더 신뢰성 있게 구분할 수 있는가?", "With new data and a comparison group, can the campaign's net increment be separated more reliably?"),
  } : null;

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
      {/* 업로드 안내는 공용 CsvGuide 계약(§12.21 ④)을 쓴다. 예전에는 이 자리에
          같은 내용이 손으로 적혀 있어 TOOL_GUIDE와 갈라질 수 있었다. */}
      <CsvGuide toolId="5-24" onDownloadTemplate={downloadTemplate} onTryExample={() => { trackProductEvent("example_run_started", { tool_id: "5-24", source: "tool", placement: "guide", locale }); loadRows(brandDemo(), "demo_brand_campaign_its.csv", { isDemo: true }); }} locale={locale} />
      {!hasData ? <div className="csv-uploader">
        <div className="csv-dropzone" role="button" tabIndex={0} onClick={() => inputRef.current?.click()} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") inputRef.current?.click(); }}>
          <div className="csv-drop-icon">⇧</div><div className="csv-drop-text">{tx(locale, "CSV 파일 드래그 & 드롭", "Drag & drop a CSV")}</div><div className="csv-drop-sub">{tx(locale, "또는 클릭하여 선택", "or click to choose a file")}</div>
        </div>
        <input ref={inputRef} type="file" accept=".csv,text/csv" hidden onChange={(event) => { handleFile(event.target.files?.[0]); event.target.value = ""; }} />
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

    {result && !result.ok && <section className="block" id="brand-its-result"><div className="callout warn"><div className="body"><strong>{tx(locale, "아직 정직한 ITS 추정을 만들 수 없습니다", "ITS is not yet identifiable")}</strong><p>{result.reason === "multiple_campaign_windows" ? tx(locale, "ON/OFF 구간이 여러 번입니다. 이번 버전은 한 번의 연속 캠페인 구간만 분석합니다. 구간 하나만 남기거나 통제군 설계를 사용하세요.", "There are multiple ON/OFF windows. This version analyzes one continuous campaign window; isolate one window or use a control-group design.") : result.reason === "insufficient_pre_periods" ? tx(locale, `집행 전 기간이 ${result.prePeriods}개입니다. 현재 cadence에는 최소 ${result.minPrePeriods}개 기간이 필요합니다.`, `There are ${result.prePeriods} pre periods; this cadence requires at least ${result.minPrePeriods}.`) : result.reason === "insufficient_post_periods" ? tx(locale, `집행 후 기간이 ${result.postPeriods}개입니다. 현재 cadence에는 최소 ${result.minPostPeriods}개 기간이 필요합니다.`, `There are ${result.postPeriods} post periods; this cadence requires at least ${result.minPostPeriods}.`) : result.reason === "zero_pretrend_variance" ? tx(locale, "집행 전 성과가 완벽한 직선이라 불확실성을 추정할 수 없습니다. 노이즈가 없는 샘플 데이터 또는 지나친 집계 여부를 확인하세요.", "The pre-period is a perfect line, so uncertainty cannot be estimated. Check for noiseless sample data or over-aggregation.") : result.reason === "ar1_variance_not_estimable" ? tx(locale, "사전 기간의 AR(1) 불확실성을 추정할 수 없습니다. 기간을 늘리거나 통제군 설계를 사용하세요.", "AR(1) uncertainty cannot be estimated from the pre-period. Add history or use a control-group design.") : tx(locale, "날짜·성과·집행 여부를 다시 확인하세요.", "Check date, outcome, and campaign-status columns.")}</p></div></div></section>}

    {result?.ok && <section className="block" id="brand-its-result">
      <ResultActionCard
        tone={hasProfileLiftSignal ? "good" : directionalVerdictWithheld ? "neutral" : "bad"}
        title={tx(locale, "브랜드 캠페인 증분 추정", "Estimated brand-campaign lift")}
        headline={brandHeadline}
        points={[{ text: tx(locale, `캠페인 시작일 ${result.campaignStartDate} 이후 실제 성과와 사전 추세 기반 반사실을 비교했습니다. 대조군이 없으므로 계절성·PR·프로모션 영향은 분리되지 않습니다.`, `We compare actual outcomes after ${result.campaignStartDate} with a pre-trend counterfactual. Without a control, seasonality, PR, and promotions are not separated.`) }]}
        stats={[
          { label: tx(locale, "추정 증가분", "Estimated incremental outcome"), value: formatValue(profileEstimate, locale), detail: profileRate == null ? "—" : `${profileRate >= 0 ? "+" : ""}${(profileRate * 100).toFixed(1)}% ${tx(locale, "기준선 대비", "vs baseline")}` },
          { label: tx(locale, "캠페인 없었을 예상", "Expected without campaign"), value: formatValue(profileCounterfactual, locale), detail: tx(locale, `${result.prePeriods}개 사전 기간`, `${result.prePeriods} pre periods`) },
          { label: tx(locale, "95% AR(1) 프로파일 구간", "95% AR(1) profile interval"), value: profileReady ? `${formatValue(result.profileInterval[0], locale)} ~ ${formatValue(result.profileInterval[1], locale)}` : "—" },
        ]}
        download={<DownloadHub
          toolId="5-24"
          locale={locale}
          label={tx(locale, "결과 받기", "Download results")}
          items={[
            { icon: "⬇", analyticsType: "csv", label: tx(locale, "기간별 실제·반사실 (CSV)", "Period series (CSV)"), desc: tx(locale, "날짜별 실제·캠페인 없었을 예상·차이", "Actual, counterfactual, and difference by date"), onSelect: downloadSeries },
            { icon: "⬇", analyticsType: "csv", label: tx(locale, "증분 추정 요약 (CSV)", "Incrementality summary (CSV)"), desc: tx(locale, "추정 증가분·AR(1) 구간·판정과 설계 한계", "Estimate, AR(1) interval, verdict, and design limits"), onSelect: downloadSummary },
          ]}
        />}
        toolId="5-24"
        analysisType="brand_incrementality"
        analysisKey={currentSignature}
        resultState={profileReady ? "ready" : "inconclusive"}
        locale={locale}
        decisionPrefill={brandDecisionPrefill}
      />
      <div className="callout"><div className="body"><strong>{!profileReady
        ? tx(locale, "AR(1) 계수 불확실성까지 포함한 구간을 만들 수 없습니다. 기간을 늘리거나 통제군 설계를 사용하세요.", "We cannot construct an interval that includes AR(1) parameter uncertainty. Add history or use a control-group design.")
        : directionalVerdictWithheld
          ? profile.hitsBoundary
            ? tx(locale, "자기상관의 가능한 범위가 넓어 증분 방향을 판정하지 않습니다. 추정치와 구간은 참고용입니다.", "The plausible autocorrelation range is too wide to determine direction. Treat the estimate and interval as reference only.")
            : tx(locale, `사전 ${result.prePeriods}기간은 짧아 증분 방향을 판정하지 않습니다. 추정치와 구간은 탐색용이며 증분 확정 근거가 아닙니다.`, `With only ${result.prePeriods} pre-periods, we do not determine incrementality direction. The estimate and interval are exploratory, not confirmation.`)
          : hasProfileLiftSignal
            ? tx(locale, "AR(1) 계수 불확실성까지 반영해도 관찰상 증가 신호가 남습니다. 그래도 통제군 없는 인과 증명은 아닙니다.", "An observational lift signal remains after accounting for AR(1) parameter uncertainty. This is still not causal proof without a control.")
            : tx(locale, "AR(1) 계수 불확실성까지 반영하면 증가를 변화 없음과 구분하기 어렵습니다.", "After accounting for AR(1) parameter uncertainty, lift cannot be distinguished from no change.")}</strong><p>{tx(locale, `캠페인 시작일 ${result.campaignStartDate} 이후 실제 성과와 사전 추세 기반 반사실을 비교했습니다. 대조군이 없으므로 계절성·PR·프로모션 영향은 분리되지 않습니다.`, `We compare actual outcomes after ${result.campaignStartDate} with a pre-trend counterfactual. Without a control, seasonality, PR, and promotions are not separated.`)}</p></div></div>
      <div className="chart-container" style={{ height: "320px", marginTop: "16px" }}><canvas ref={chartRef} /></div>
      <details style={{ marginTop: "14px" }}>
        <summary>{tx(locale, "근거·한계 확인", "Review evidence and limitations")}</summary>
        <ul>
          <li>{tx(locale, `사전 ${result.prePeriods}기간 · 집행 ${result.postPeriods}기간 · AR(1) MLE 사전 추세 일평균 변화 ${result.profileTrend?.slope == null ? "추정 불가" : result.profileTrend.slope.toFixed(2)}`, `${result.prePeriods} pre periods · ${result.postPeriods} campaign periods · AR(1) MLE pre-trend daily change ${result.profileTrend?.slope == null ? "not estimable" : result.profileTrend.slope.toFixed(2)}`)}</li>
          <li>{tx(locale, `95% 프로파일 구간은 rho MLE ${profile?.rhoMle == null ? "추정 불가" : profile.rhoMle.toFixed(2)}와 가능한 rho 범위 ${profile ? `${profile.rhoInterval[0].toFixed(2)} ~ ${profile.rhoInterval[1].toFixed(2)}` : "추정 불가"}를 함께 반영합니다.`, `The 95% profile interval includes rho MLE ${profile?.rhoMle == null ? "not estimable" : profile.rhoMle.toFixed(2)} and plausible rho range ${profile ? `${profile.rhoInterval[0].toFixed(2)} to ${profile.rhoInterval[1].toFixed(2)}` : "not estimable"}.`)}</li>
          <li>{tx(locale, `구간 하한은 rho ${profile?.lowerDriverRho == null ? "추정 불가" : profile.lowerDriverRho.toFixed(2)}, 상한은 rho ${profile?.upperDriverRho == null ? "추정 불가" : profile.upperDriverRho.toFixed(2)}에서 가장 보수적입니다.`, `The interval is most conservative at rho ${profile?.lowerDriverRho == null ? "not estimable" : profile.lowerDriverRho.toFixed(2)} for the lower end and ${profile?.upperDriverRho == null ? "not estimable" : profile.upperDriverRho.toFixed(2)} for the upper end.`)}</li>
          <li>{result.diagnostics.ar1EvidenceTier === "exploratory" ? tx(locale, `사전 ${result.prePeriods}기간은 탐색적 구간입니다. 수치가 양수여도 방향 판정을 제공하지 않습니다.`, `The ${result.prePeriods} pre-periods are exploratory. We do not provide a directional verdict even if the estimate is positive.`) : result.diagnostics.ar1EvidenceTier === "assumption_sensitive" ? tx(locale, `사전 ${result.prePeriods}기간은 AR(1) 가정에 민감한 구간입니다. 더 긴 사전기간 또는 통제군으로 확인하세요.`, `The ${result.prePeriods} pre-periods remain sensitive to the AR(1) assumption. Confirm with longer history or a control group.`) : tx(locale, `사전 ${result.prePeriods}기간은 참고 가능한 길이지만, AR(1) 가정과 통제군 부재 한계는 남습니다.`, `The ${result.prePeriods} pre-periods are usable as reference, but the AR(1) assumption and lack of a control remain limitations.`)}</li>
          <li>{result.diagnostics.hacReferenceStandardError == null ? tx(locale, "HAC 참고 표준오차는 추정하지 못했습니다. 결과 구간에는 사용하지 않습니다.", "The HAC reference SE could not be estimated and is not used for the result interval.") : tx(locale, `비교용 HAC 표준오차는 ${formatValue(result.diagnostics.hacReferenceStandardError, locale)} (랙 ${result.diagnostics.hacLag})입니다. 결과 구간에는 사용하지 않습니다.`, `Reference-only HAC SE is ${formatValue(result.diagnostics.hacReferenceStandardError, locale)} (lag ${result.diagnostics.hacLag}); it is not used for the result interval.`)}</li>
          <li>{result.diagnostics.hasPeriodGaps ? tx(locale, `${result.diagnostics.grain === "week" ? "주" : result.diagnostics.grain === "month" ? "월" : "일"} 단위 누락 기간이 ${result.diagnostics.missingPeriods}개 있습니다. 가장 긴 간격은 ${result.diagnostics.maxGapDays}일입니다.`, `There are ${result.diagnostics.missingPeriods} missing ${result.diagnostics.grain} period(s); the longest gap is ${result.diagnostics.maxGapDays} days.`) : tx(locale, `${result.diagnostics.grain === "week" ? "주간" : result.diagnostics.grain === "month" ? "월간" : "일별"} cadence에서 누락 기간은 발견되지 않았습니다.`, `No missing periods were detected for the ${result.diagnostics.grain} cadence.`)}</li>
          {result.diagnostics.invalidRows > 0 && <li>{tx(locale, `날짜·성과·집행 여부가 유효하지 않은 ${result.diagnostics.invalidRows}행은 제외했습니다.`, `${result.diagnostics.invalidRows} row(s) with invalid date, outcome, or campaign status were excluded.`)}</li>}
          <li>{tx(locale, "AR(1) 프로파일 구간은 rho 추정오차를 포함한 보수적 근사입니다. 계절성·PR·프로모션 교란을 제거하거나 통제군 없는 인과를 증명하지는 못합니다.", "The AR(1) profile interval is a conservative approximation that includes rho estimation uncertainty. It does not remove seasonality, PR, or promotion confounding, or prove causality without a control.")}</li>
          <li>{tx(locale, "다음 캠페인에서는 비집행 지역·오디언스를 남겨 홀드아웃/DiD로 인과 근거를 강화하세요.", "For the next campaign, retain an unexposed region or audience to strengthen causal evidence with holdout / DiD.")}</li>
        </ul>
      </details>
    </section>}
  </div>;
}
