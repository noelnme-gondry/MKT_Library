"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Chart from "@/utils/chartGlobals";
import CsvUploader from "@/components/CsvUploader";
import ToolPageShell from "@/components/ToolPageShell";
import ResultActionCard from "@/components/ds/ResultActionCard";
import DataTable from "@/components/ds/DataTable";
import DownloadHub from "@/components/ds/DownloadHub";
import { useAppStore } from "@/store/useDataStore";
import { getMappedRows } from "@/utils/dashboardAggregator";
import { CHART_THEME, chartCommonOpts } from "@/utils/chartUtils";
import { csvBody, downloadCsv } from "@/utils/download";
import { fmtCurrency, fmtNum, fmtPct, parseNum } from "@/utils/format";
import {
  discreteHazard,
  kaplanMeier,
  logRankTest,
  medianSurvival,
  normalizeDateSurvivalRows,
  normalizeSurvivalRows,
  parseSubscriptionUtcDate,
  restrictedMeanSurvival,
  survivalEvidence,
  observedHorizonUnitEconomics,
} from "@/utils/subscriptionSurvivalMath";

const TOOL_ID = "5-28";
const SEGMENTS = ["channel", "plan", "promo"];

const tx = (locale, ko, en) => locale === "en" ? en : ko;

function firstDefined(row, keys) {
  return keys.find((key) => Object.prototype.hasOwnProperty.call(row || {}, key) && row[key] != null && String(row[key]).trim() !== "")
    ? row[keys.find((key) => Object.prototype.hasOwnProperty.call(row || {}, key) && row[key] != null && String(row[key]).trim() !== "")]
    : undefined;
}

// This adapter is intentionally narrow. The mapping workstream owns the V1/V2
// field registry; the UI only accepts the projected legacy keys it needs.
function toSurvivalRows(rows, segmentKey) {
  return (rows || []).map((row) => ({
    tenure_periods: firstDefined(row, ["tenure_periods", "subscription_tenure"]),
    event_observed: firstDefined(row, ["event_observed", "churn_event"]),
    entry_period: firstDefined(row, ["entry_period", "subscription_entry"]),
    segment: segmentKey ? row?.[segmentKey] : undefined,
    cac: firstDefined(row, ["cac", "customer_acquisition_cost"]),
  }));
}

function toDateSurvivalRows(rows, segmentKey) {
  return (rows || []).map((row) => ({
    subscription_start_date: firstDefined(row, ["subscription_start_date", "subscription_started_at", "subscription_start", "start_date", "started_at"]),
    churn_date: firstDefined(row, ["churn_date", "subscription_churn_date", "cancel_date", "cancelled_at", "canceled_at", "ended_at"]),
    observation_end_date: firstDefined(row, ["observation_end_date", "subscription_end_date", "observed_until", "as_of_date", "snapshot_date"]),
    entry_period: firstDefined(row, ["entry_period", "subscription_entry"]),
    segment: segmentKey ? row?.[segmentKey] : undefined,
    cac: firstDefined(row, ["cac", "customer_acquisition_cost"]),
  }));
}

function prepareSurvivalRows(rows, config) {
  if (config.inputMode === "dates") {
    return normalizeDateSurvivalRows(toDateSurvivalRows(rows, config.segmentKey), {
      timeUnit: config.timeUnit,
      observationEndDate: config.observationEndDate,
    });
  }
  return normalizeSurvivalRows(toSurvivalRows(rows, config.segmentKey), { timeUnit: config.timeUnit });
}

function segmentRows(rows) {
  const groups = new Map();
  rows.forEach((row) => {
    const name = String(row.segment || "(미지정)").trim() || "(미지정)";
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(row);
  });
  return [...groups.entries()].map(([name, values]) => ({ name, rows: values }));
}

function segmentCurves(groups) {
  return groups.map((group) => {
    const table = kaplanMeier(group.rows);
    return { name: group.name, table, maxObserved: table.at(-1)?.time ?? null };
  });
}

function survivalAtHorizon(table, horizon) {
  if (!table?.length || !(horizon >= 0)) return null;
  return table.filter((row) => row.time <= horizon).at(-1)?.survival ?? 1;
}

function atRiskAtHorizon(rows, horizon) {
  if (!(horizon >= 0)) return null;
  return (rows || []).filter((row) => row.entry <= horizon && row.time >= horizon).length;
}

function averageCac(rows) {
  if (!rows.length || rows.some((row) => row.cac == null || row.cac < 0)) return null;
  return rows.reduce((sum, row) => sum + row.cac, 0) / rows.length;
}

function segmentSummary(group, { horizon, arpu, margin, discountRate }) {
  const table = kaplanMeier(group.rows);
  const maxObserved = table.at(-1)?.time ?? null;
  const hasCommonHorizon = maxObserved != null && maxObserved >= horizon;
  const normalized = {
    validRows: group.rows,
    eventCount: group.rows.filter((row) => row.event === 1).length,
  };
  const evidence = hasCommonHorizon
    ? survivalEvidence({ normalized, kmTable: table, horizon })
    : { status: "NOT_IDENTIFIED", reason: "common_horizon_unavailable" };
  const economics = hasCommonHorizon
    ? observedHorizonUnitEconomics({ survival: table, arpu, margin, discountRate, horizon, cac: averageCac(group.rows) })
    : { status: "unavailable", reason: "common_horizon_unavailable", ltv: null, cac: null, ltvCac: null, paybackPeriod: null };
  const censored = group.rows.filter((row) => row.event === 0).length;
  return {
    segment: group.name,
    n: group.rows.length,
    events: normalized.eventCount,
    censored,
    censoringRate: group.rows.length ? censored / group.rows.length : null,
    horizon,
    survival: hasCommonHorizon ? survivalAtHorizon(table, horizon) : null,
    atRisk: hasCommonHorizon ? atRiskAtHorizon(group.rows, horizon) : null,
    rmst: hasCommonHorizon ? restrictedMeanSurvival(table, horizon) : null,
    ltv: economics.ltv,
    cac: economics.cac,
    ltvCac: economics.ltvCac,
    evidenceStatus: evidence.status,
    evidenceReason: evidence.reason,
  };
}

function statusCopy(status, locale) {
  return {
    READY: tx(locale, "의사결정 가능", "Decision-ready"),
    CAUTION: tx(locale, "방향만 참고", "Directional only"),
    INSUFFICIENT_DATA: tx(locale, "데이터 보완 필요", "More data needed"),
    NOT_IDENTIFIED: tx(locale, "이 데이터로 구분 불가", "Not identifiable here"),
    ABSTAIN: tx(locale, "판단 보류", "Decision withheld"),
  }[status] || tx(locale, "계산하지 못함", "Not computed");
}

function evidenceHeadline({ evidence, hazard, locale }) {
  if (evidence.status === "ABSTAIN") return tx(locale, "이탈이 관측되지 않아 위험 구간 결론을 보류합니다", "No churn event was observed, so risk timing is withheld");
  if (evidence.status === "INSUFFICIENT_DATA") return tx(locale, "현재 입력만으로는 생존 결론을 만들기 어렵습니다", "The current input cannot support a survival conclusion");
  if (!hazard?.maxHazard) return tx(locale, "위험 구간을 계산하지 못했습니다", "No risk interval could be estimated");
  return tx(locale, `${hazard.maxHazard.time} ${unitWord(locale)} 구간의 이탈 위험이 가장 높게 관측됐습니다`, `Churn risk was highest in interval ${hazard.maxHazard.time}`);
}

function unitWord(locale) {
  return locale === "en" ? "period" : "기간";
}

export function buildSegmentCurveChartData(curves = []) {
  const usable = curves.filter((curve) => curve.maxObserved != null && curve.table.length);
  const times = [...new Set(usable.flatMap((curve) => curve.table.map((row) => row.time)))].sort((left, right) => left - right);
  return {
    labels: times,
    datasets: usable.map((curve, index) => ({
      label: curve.name,
      data: times.map((time) => time <= curve.maxObserved ? (survivalAtHorizon(curve.table, time) ?? 1) * 100 : null),
      colorIndex: index,
    })),
  };
}

export function scheduleSubscriptionChartResize(chart) {
  const resize = () => {
    if (!chart || (chart.canvas && !chart.canvas.isConnected)) return;
    chart.resize?.();
  };
  if (typeof requestAnimationFrame !== "function") {
    resize();
    return () => {};
  }
  const frame = requestAnimationFrame(resize);
  return () => cancelAnimationFrame(frame);
}

function ChartCanvas({ table, hazard, locale, isDarkMode }) {
  const survivalRef = useRef(null);
  const hazardRef = useRef(null);
  const survivalChart = useRef(null);
  const hazardChart = useRef(null);
  useEffect(() => {
    if (!survivalRef.current || !table.length) return undefined;
    survivalChart.current?.destroy();
    const theme = CHART_THEME;
    const base = chartCommonOpts();
    const chart = new Chart(survivalRef.current, {
      type: "line",
      data: {
        labels: table.map((row) => row.time),
        datasets: [
          { label: tx(locale, "생존율", "Survival"), data: table.map((row) => row.survival * 100), borderColor: theme.primary, backgroundColor: "transparent", borderWidth: 2.5, pointRadius: 2, stepped: true },
          { label: "95% CI low", data: table.map((row) => row.ciLow * 100), borderColor: theme.muted, borderWidth: 1, pointRadius: 0, borderDash: [4, 3], stepped: true },
          { label: "95% CI high", data: table.map((row) => row.ciHigh * 100), borderColor: theme.muted, borderWidth: 1, pointRadius: 0, borderDash: [4, 3], stepped: true },
        ],
      },
      options: {
        ...base,
        responsive: true,
        maintainAspectRatio: false,
        scales: { ...base.scales, y: { ...base.scales?.y, min: 0, max: 100, ticks: { ...base.scales?.y?.ticks, callback: (value) => `${value}%` } } },
      },
    });
    survivalChart.current = chart;
    const cancelResize = scheduleSubscriptionChartResize(chart);
    return () => { cancelResize(); chart.destroy(); if (survivalChart.current === chart) survivalChart.current = null; };
  }, [isDarkMode, locale, table]);
  useEffect(() => {
    if (!hazardRef.current || !hazard.rows.length) return undefined;
    hazardChart.current?.destroy();
    const theme = CHART_THEME;
    const base = chartCommonOpts();
    const chart = new Chart(hazardRef.current, {
      type: "bar",
      data: {
        labels: hazard.rows.map((row) => row.time),
        datasets: [{ label: tx(locale, "조건부 이탈 위험", "Conditional churn risk"), data: hazard.rows.map((row) => row.hazard == null ? null : row.hazard * 100), backgroundColor: hazard.rows.map((row) => row.atRisk < 5 ? theme.muted : theme.primary) }],
      },
      options: { ...base, responsive: true, maintainAspectRatio: false, scales: { ...base.scales, y: { ...base.scales?.y, min: 0, ticks: { ...base.scales?.y?.ticks, callback: (value) => `${value}%` } } } },
    });
    hazardChart.current = chart;
    const cancelResize = scheduleSubscriptionChartResize(chart);
    return () => { cancelResize(); chart.destroy(); if (hazardChart.current === chart) hazardChart.current = null; };
  }, [hazard, isDarkMode, locale]);
  return <>
    <section className="block" id="subscription-survival-curve">
      <h2 className="section-title">{tx(locale, "고객은 각 갱신 시점까지 얼마나 남아 있나요?", "How many customers remain through each renewal point?")}</h2>
      <div className="chart-container"><canvas ref={survivalRef} role="img" aria-label={tx(locale, "구독 생존율과 95% 신뢰구간", "Subscription survival with 95% confidence interval")} /></div>
    </section>
    <section className="block" id="subscription-hazard">
      <h2 className="section-title">{tx(locale, "이탈 위험이 가장 높은 갱신 구간은 언제인가요?", "When is renewal churn risk highest?")}</h2>
      <div className="chart-container"><canvas ref={hazardRef} role="img" aria-label={tx(locale, "구간별 조건부 이탈 위험", "Interval conditional churn risk")} /></div>
      {hazard.hasSmallRiskSet && <p className="callout">{tx(locale, "최대 위험 구간의 위험집합이 작습니다. 방향만 참고하고 다음 코호트에서 재확인하세요.", "The highest-risk interval has a small risk set. Treat it as directional and recheck with the next cohort.")}</p>}
    </section>
  </>;
}

function SegmentSurvivalChart({ curves, locale, isDarkMode }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const chartData = useMemo(() => buildSegmentCurveChartData(curves), [curves]);
  useEffect(() => {
    if (!canvasRef.current || chartData.datasets.length < 2 || !chartData.labels.length) return undefined;
    chartRef.current?.destroy();
    const theme = CHART_THEME;
    const base = chartCommonOpts();
    const chart = new Chart(canvasRef.current, {
      type: "line",
      data: {
        labels: chartData.labels,
        datasets: chartData.datasets.map((dataset) => ({
          label: dataset.label,
          data: dataset.data,
          borderColor: theme.series[dataset.colorIndex % theme.series.length],
          backgroundColor: "transparent",
          borderWidth: 2,
          pointRadius: 2,
          pointStyle: ["circle", "triangle", "rect", "rectRot", "star", "cross"][dataset.colorIndex % 6],
          borderDash: [[], [6, 3], [2, 3], [8, 3, 2, 3], [1, 3], [10, 3]][dataset.colorIndex % 6],
          stepped: true,
          spanGaps: false,
        })),
      },
      options: {
        ...base,
        responsive: true,
        maintainAspectRatio: false,
        scales: { ...base.scales, y: { ...base.scales?.y, min: 0, max: 100, ticks: { ...base.scales?.y?.ticks, callback: (value) => `${value}%` } } },
      },
    });
    chartRef.current = chart;
    const cancelResize = scheduleSubscriptionChartResize(chart);
    return () => { cancelResize(); chart.destroy(); if (chartRef.current === chart) chartRef.current = null; };
  }, [chartData, isDarkMode, locale]);
  return <section className="block" id="subscription-segment-curves">
    <h3 className="section-title">{tx(locale, "세그먼트별 생존곡선", "Segment survival curves")}</h3>
    <p id="subscription-segment-curves-note" className="muted">{tx(locale, "각 선은 해당 세그먼트의 마지막 실제 관측 시점에서 멈춥니다. 관측 범위 밖으로 연장하지 않습니다.", "Each line stops at that segment's last observed time. It is not extended beyond observed support.")}</p>
    <div className="chart-container"><canvas ref={canvasRef} role="img" aria-label={tx(locale, "세그먼트별 구독 생존곡선", "Subscription survival curves by segment")} aria-describedby="subscription-segment-curves-note" /></div>
  </section>;
}

export default function SubscriptionSurvivalAnalysis({ locale = "ko", rows: rowsOverride, analyzed: analyzedOverride } = {}) {
  const csvData = useAppStore((state) => state.csvData);
  const isStoreAnalyzed = useAppStore((state) => state.isGroupAnalyzed(TOOL_ID));
  const isDarkMode = useAppStore((state) => state.isDarkMode);
  const sourceRows = rowsOverride || getMappedRows(csvData);
  const hasRows = sourceRows.length > 0;
  const gateOpen = analyzedOverride ?? isStoreAnalyzed;
  const [draft, setDraft] = useState({ inputMode: "periods", timeUnit: "month", horizon: "", segmentKey: "", observationEndDate: "", churnDefinition: "", arpu: "", margin: "", discountRate: "" });
  const [applied, setApplied] = useState(null);
  const [validationMessage, setValidationMessage] = useState("");
  const defaultPrepared = useMemo(() => prepareSurvivalRows(sourceRows, draft), [draft, sourceRows]);
  const maxObserved = defaultPrepared.validRows.reduce((maximum, row) => Math.max(maximum, row.time), 0);
  const draftHorizon = Math.min(maxObserved, Math.max(0, parseNum(draft.horizon) ?? maxObserved));

  // Keep a previous applied configuration only while the external CSV analysis
  // gate is valid. A mapping/data change closes the gate and hides it without
  // synchronously mutating component state from an effect.
  const active = gateOpen ? applied : null;
  const isStale = Boolean(active && JSON.stringify(active) !== JSON.stringify({ ...draft, horizon: draftHorizon }));
  const run = () => {
    if (draft.inputMode === "dates" && !draft.observationEndDate) {
      setValidationMessage(tx(locale, "날짜 입력 모드에서는 데이터 추출 기준인 관측 종료일을 입력하세요.", "In date mode, enter the observation end date used to extract the data."));
      return;
    }
    if (!draft.churnDefinition.trim()) {
      setValidationMessage(tx(locale, "이탈로 간주한 상태를 명시하세요.", "State what status counts as churn."));
      return;
    }
    if (draft.inputMode === "dates" && parseSubscriptionUtcDate(draft.observationEndDate) == null) {
      setValidationMessage(tx(locale, "관측 종료일이 유효한 날짜인지 확인하세요.", "Check that the observation end date is valid."));
      return;
    }
    setValidationMessage("");
    setApplied({ ...draft, horizon: draftHorizon });
  };
  const result = useMemo(() => {
    if (!gateOpen || !active) return null;
    const prepared = prepareSurvivalRows(sourceRows, active);
    const table = kaplanMeier(prepared.validRows);
    const hazard = discreteHazard(table);
    const horizon = Math.min(maxObserved, Math.max(0, parseNum(active.horizon) ?? maxObserved));
    const evidence = survivalEvidence({ normalized: prepared, kmTable: table, horizon });
    const groups = active.segmentKey ? segmentRows(prepared.validRows) : [];
    const curves = groups.length >= 2 && groups.length <= 6 ? segmentCurves(groups) : [];
    const comparison = groups.length >= 2 && groups.length <= 6 ? logRankTest(groups) : null;
    const margin = parseNum(active.margin);
    const arpu = parseNum(active.arpu);
    const discountRate = parseNum(active.discountRate);
    const economics = arpu != null && margin != null
      ? observedHorizonUnitEconomics({ survival: table, arpu, margin: margin / 100, discountRate: (discountRate ?? 0) / 100, horizon, cac: averageCac(prepared.validRows) })
      : { status: "unavailable", reason: "ltv_inputs_unavailable", ltv: null, cac: null, ltvCac: null, paybackPeriod: null };
    const summaries = groups.map((group) => segmentSummary(group, { horizon, arpu, margin: margin == null ? null : margin / 100, discountRate: (discountRate ?? 0) / 100 }));
    return { prepared, table, hazard, horizon, timeUnit: active.timeUnit, inputMode: active.inputMode, observationEndDate: active.observationEndDate, churnDefinition: active.churnDefinition, ltvInputs: { arpu, margin, discountRate }, evidence, groups, curves, comparison, economics, segmentSummaries: summaries, ltv: economics.ltv, median: medianSurvival(table), rmst: restrictedMeanSurvival(table, horizon) };
  }, [active, gateOpen, maxObserved, sourceRows]);

  const decisionPrefill = useMemo(() => {
    if (!result || result.evidence.status !== "READY" || !result.hazard.maxHazard || result.hazard.hasSmallRiskSet || result.prepared.excludedRows.length) return null;
    const peak = result.hazard.maxHazard;
    const unit = result.timeUnit === "month" ? tx(locale, "개월", "months") : result.timeUnit === "week" ? tx(locale, "주", "weeks") : tx(locale, "일", "days");
    return {
      conclusion: tx(locale, `${peak.time}${unit} 구간의 조건부 이탈 위험이 ${fmtPct(peak.hazard)}로 가장 높게 관측됐습니다.`, `Conditional churn risk was highest at ${peak.time} ${unit}: ${fmtPct(peak.hazard)}.`),
      action: tx(locale, `다음 코호트에서 ${peak.time}${unit} 전 리텐션 개입을 A/B 또는 홀드아웃으로 검증한다`, `Test a retention intervention before ${peak.time} ${unit} with an A/B test or holdout`),
      hypothesis: tx(locale, "고위험 갱신 구간 전에 개입하면 관측 생존율을 개선할 수 있다.", "Intervening before the high-risk renewal interval can improve observed survival."),
      metric: tx(locale, `${peak.time}${unit} 조건부 이탈 위험`, `${peak.time}-${unit} conditional churn risk`),
      baseline: fmtPct(peak.hazard),
      targetDirection: "lower",
      reviewQuestion: tx(locale, "개입 코호트의 같은 갱신 구간 이탈 위험이 대조군보다 낮았는가?", "Was churn risk at the same renewal interval lower than in the control group?"),
    };
  }, [locale, result]);

  const download = result ? <DownloadHub toolId={TOOL_ID} locale={locale} manifest={{ toolId: TOOL_ID, version: "mvp", inputMode: result.inputMode, timeUnit: result.timeUnit, horizon: result.horizon, observationEndDate: result.observationEndDate || null, churnDefinition: result.churnDefinition || null, includedRows: result.prepared.validRows.length, excludedRows: result.prepared.excludedRows.length, leftTruncation: { applied: result.prepared.leftTruncatedCount > 0, episodeCount: result.prepared.leftTruncatedCount }, ltvInputs: result.ltvInputs, warnings: [result.evidence.reason, result.economics.reason, ...result.segmentSummaries.map((row) => row.evidenceReason)].filter(Boolean), source: "browser" }} items={[
    { label: tx(locale, "생존곡선 CSV", "Survival curve CSV"), analyticsType: "survival_curve", onSelect: () => downloadCsv(csvBody(["time", "at_risk", "events", "censored", "survival", "ci_low", "ci_high", "hazard"], result.hazard.rows.map((row) => [row.time, row.atRisk, row.events, row.censored, row.survival, row.ciLow, row.ciHigh, row.hazard])), "subscription_survival_curve") },
    { label: tx(locale, "위험집합 CSV", "Risk-set CSV"), analyticsType: "risk_set", onSelect: () => downloadCsv(csvBody(["time", "at_risk", "events", "censored", "hazard"], result.hazard.rows.map((row) => [row.time, row.atRisk, row.events, row.censored, row.hazard])), "subscription_survival_risk_set") },
    ...(result.segmentSummaries.length ? [{ label: tx(locale, "세그먼트 요약 CSV", "Segment summary CSV"), analyticsType: "segment_summary", onSelect: () => downloadCsv(csvBody(["segment", "n", "events", "censored", "censoring_rate", "horizon", "survival_at_horizon", "rmst", "ltv", "cac", "ltv_cac", "evidence_status"], result.segmentSummaries.map((row) => [row.segment, row.n, row.events, row.censored, row.censoringRate, row.horizon, row.survival, row.rmst, row.ltv, row.cac, row.ltvCac, row.evidenceStatus])), "subscription_survival_segments") }] : []),
  ]} /> : null;

  return <ToolPageShell toolId={TOOL_ID} title={tx(locale, "구독 생존·이탈 분석", "Subscription Survival & Churn")} locale={locale} summary={<p>{tx(locale, "중도절단을 반영해 위험한 갱신 구간과 관측기간 고객가치를 확인합니다. 개별 고객의 이탈을 예측하거나 원인을 확정하지는 않습니다.", "Estimate renewal risk timing and observed-horizon customer value with censoring handled. This does not predict individual churn or establish causes.")}</p>} toc={[{ id: "subscription-survival-result", title: tx(locale, "결론", "Conclusion") }, { id: "subscription-survival-curve", title: tx(locale, "생존곡선", "Survival") }, { id: "subscription-hazard", title: tx(locale, "위험 구간", "Risk") }]}>
    {!hasRows && <section className="block" aria-labelledby="subscription-empty-title">
      <h2 id="subscription-empty-title" className="section-title">{tx(locale, "데이터를 준비하세요", "Prepare your data")}</h2>
      <p>{tx(locale, "1행이 한 번의 구독 에피소드가 되도록 구독기간과 이탈 여부를 준비해 주세요. 파일은 이 브라우저에서만 처리됩니다.", "Use one row per subscription episode with duration and churn-event status. The file is processed only in this browser.")}</p>
      <CsvUploader toolId={TOOL_ID} locale={locale} />
    </section>}
    {hasRows && !gateOpen && <section className="block"><CsvUploader toolId={TOOL_ID} locale={locale} /><p className="muted">{tx(locale, "매핑을 확인한 뒤 ‘데이터 분석하기’를 눌러 결과를 계산하세요.", "Confirm the mapping, then choose Analyze data to calculate results.")}</p></section>}
    {hasRows && gateOpen && <section className="block" aria-label={tx(locale, "분석 설정", "Analysis settings")}>
      <div className="form-row">
        <label>{tx(locale, "입력 방식", "Input mode")}<select value={draft.inputMode} onChange={(event) => setDraft((value) => ({ ...value, inputMode: event.target.value }))}><option value="periods">{tx(locale, "기간 + 이탈 여부", "Tenure + churn flag")}</option><option value="dates">{tx(locale, "시작·이탈·관측 종료일", "Start, churn, and observation dates")}</option></select></label>
        <label>{tx(locale, "시간 단위", "Time unit")}<select value={draft.timeUnit} onChange={(event) => setDraft((value) => ({ ...value, timeUnit: event.target.value }))}><option value="day">{tx(locale, "일", "Day")}</option><option value="week">{tx(locale, "주", "Week")}</option><option value="month">{tx(locale, "월", "Month")}</option></select></label>
        <label>{tx(locale, "관측 horizon", "Observed horizon")}<input type="number" min="0" max={maxObserved} value={draft.horizon} placeholder={String(maxObserved)} onChange={(event) => setDraft((value) => ({ ...value, horizon: event.target.value }))} /></label>
        <label>{tx(locale, "관측 종료일", "Observation end date")}<input type="date" value={draft.observationEndDate} aria-required={draft.inputMode === "dates" ? "true" : undefined} onChange={(event) => setDraft((value) => ({ ...value, observationEndDate: event.target.value }))} /></label>
        <label>{tx(locale, "이탈 정의", "Churn definition")}<input type="text" value={draft.churnDefinition} aria-required="true" placeholder={tx(locale, "예: 접근 종료 또는 결제 실패", "e.g. access ended or payment failed")} onChange={(event) => setDraft((value) => ({ ...value, churnDefinition: event.target.value }))} /></label>
        <label>{tx(locale, "세그먼트", "Segment")}<select value={draft.segmentKey} onChange={(event) => setDraft((value) => ({ ...value, segmentKey: event.target.value }))}><option value="">{tx(locale, "전체만", "Overall only")}</option>{SEGMENTS.map((key) => <option key={key} value={key}>{key}</option>)}</select></label>
        <label>{tx(locale, "기간 ARPU (선택)", "ARPU per period (optional)")}<input type="number" min="0" value={draft.arpu} onChange={(event) => setDraft((value) => ({ ...value, arpu: event.target.value }))} /></label>
        <label>{tx(locale, "매출총이익률 % (선택)", "Gross margin % (optional)")}<input type="number" min="0" max="100" value={draft.margin} onChange={(event) => setDraft((value) => ({ ...value, margin: event.target.value }))} /></label>
        <label>{tx(locale, "기간 할인율 % (선택)", "Discount rate per period (optional)")}<input type="number" min="0" value={draft.discountRate} onChange={(event) => setDraft((value) => ({ ...value, discountRate: event.target.value }))} /></label>
      </div>
      {draft.inputMode === "dates" && <p className="muted">{tx(locale, "이탈일이 있으면 이탈 사건으로, 없으면 행의 관측 종료일 또는 위 기준일에서 중도절단으로 처리합니다. 날짜 차이는 UTC 기준이며 부분 주·월은 해당 갱신 구간으로 올림합니다.", "A churn date is an observed event; without one, the episode is censored at its row-level end date or the date above. Dates use UTC; partial weeks/months are assigned to their renewal interval.")}</p>}
      {validationMessage && <p className="callout" role="alert">{validationMessage}</p>}
      {!active && <p><button type="button" className="btn primary" onClick={run}>{tx(locale, "분석하기", "Analyze")}</button></p>}
      {isStale && <p className="callout">{tx(locale, "설정이 바뀌었습니다. 현재 결과는 최신 설정과 다를 수 있습니다.", "Settings changed. The current result may not match them.")} <button type="button" className="ab-pill" onClick={run}>{tx(locale, "다시 분석", "Re-analyze")}</button></p>}
    </section>}
    {result && !isStale && <>
      <div id="subscription-survival-result"><ResultActionCard toolId={TOOL_ID} locale={locale} resultState={result.evidence.status === "READY" ? "ready" : "withheld"} tone={result.evidence.status === "READY" ? "neutral" : "bad"} title={statusCopy(result.evidence.status, locale)} headline={evidenceHeadline({ evidence: result.evidence, hazard: result.hazard, locale })} decisionPrefill={decisionPrefill} download={download} stats={[
        { label: tx(locale, "이탈", "Events"), value: fmtNum(result.prepared.eventCount) },
        { label: tx(locale, "중도절단", "Censored"), value: fmtNum(result.prepared.censoredCount) },
        { label: tx(locale, `${result.horizon}기간 생존율`, `${result.horizon}-period survival`), value: fmtPct(result.table.length ? result.table.filter((row) => row.time <= result.horizon).at(-1)?.survival : null) },
        { label: tx(locale, "RMST", "RMST"), value: result.rmst == null ? "—" : fmtNum(result.rmst, 2) },
        { label: tx(locale, "관측기간 LTV", "Observed-horizon LTV"), value: result.ltv == null ? "—" : fmtCurrency(result.ltv, { precise: true }) },
        { label: "LTV:CAC", value: result.economics.ltvCac == null ? "—" : fmtNum(result.economics.ltvCac, 2) },
      ]} points={[
        { text: result.median == null ? tx(locale, "관측 기간 내 중앙 생존기간에 도달하지 않았습니다.", "Median survival was not reached within the observation window.") : tx(locale, `중앙 생존기간은 ${result.median}기간입니다.`, `Median survival is ${result.median} periods.`) },
        { text: result.economics.status === "available" ? tx(locale, `관측기간 내 페이백은 ${result.economics.paybackPeriod}기간에 도달했습니다.`, `Payback was reached in period ${result.economics.paybackPeriod} within the observed horizon.`) : result.economics.reason === "payback_not_reached" ? tx(locale, "관측 기간 내 페이백에 도달하지 않았습니다.", "Payback was not reached within the observed horizon.") : result.economics.reason === "zero_cac" ? tx(locale, "CAC가 0이어서 LTV:CAC와 페이백은 계산하지 않았습니다.", "CAC is zero, so LTV:CAC and payback are not calculated.") : tx(locale, "ARPU·매출총이익률과 모든 에피소드의 CAC가 있어야 LTV:CAC·페이백을 계산합니다.", "ARPU, gross margin, and CAC for every episode are required for LTV:CAC and payback.") },
        ...(result.evidence.reason === "no_censored_rows" ? [{ text: tx(locale, "모든 에피소드가 이탈로 끝나 중도절단 정보가 없습니다. 관측 종료 규칙을 확인한 뒤 방향만 참고하세요.", "Every episode ended in churn, so there is no censoring information. Check the observation-end rule and treat this as directional.") }] : []),
        { text: tx(locale, "위험 구간 전의 리텐션 개입안은 A/B 테스트 또는 홀드아웃으로 검증하세요.", "Validate retention interventions before the risk interval with an A/B test or holdout.") },
      ]} /></div>
      <ChartCanvas table={result.table} hazard={result.hazard} locale={locale} isDarkMode={isDarkMode} />
      <section className="block" id="subscription-risk-table"><h2 className="section-title">{tx(locale, "위험집합과 이탈 수", "Risk set and churn counts")}</h2><DataTable ariaLabel={tx(locale, "구간별 위험집합 표", "Interval risk-set table")} columns={[
        { key: "time", label: tx(locale, "기간", "Period"), align: "right" }, { key: "atRisk", label: tx(locale, "위험집합", "At risk"), align: "right" }, { key: "events", label: tx(locale, "이탈", "Events"), align: "right" }, { key: "censored", label: tx(locale, "중도절단", "Censored"), align: "right" }, { key: "survival", label: tx(locale, "생존율", "Survival"), align: "right", fmt: (value) => fmtPct(value) }, { key: "hazard", label: tx(locale, "조건부 이탈 위험", "Conditional risk"), align: "right", fmt: (value) => fmtPct(value) },
      ]} rows={result.hazard.rows} rowKey={(row) => row.time} /></section>
      {result.groups.length > 0 && <section className="block" id="subscription-segments"><h2 className="section-title">{tx(locale, "세그먼트별 생존 비교", "Segment survival comparison")}</h2>
        {result.groups.length > 6 ? <p className="callout">{tx(locale, "세그먼트가 6개를 넘어 비교를 보류했습니다. 상위 항목을 선택하거나 기타로 묶어 다시 분석하세요.", "More than six segments were found, so comparison is withheld. Select top groups or combine the remainder before rerunning.")}</p> : <>
          <p>{result.comparison?.ok ? tx(locale, `log-rank p=${result.comparison.pValue.toFixed(3)}입니다. 관측된 차이 신호일 뿐 원인을 뜻하지는 않습니다.`, `Log-rank p=${result.comparison.pValue.toFixed(3)}. This is an observed difference signal, not a cause.`) : tx(locale, "일부 그룹의 이탈이 너무 적어 세그먼트 차이를 구분하기 어렵습니다.", "Some groups have too few events to distinguish a survival difference.")}</p>
          {result.curves.length >= 2 && <SegmentSurvivalChart curves={result.curves} locale={locale} isDarkMode={isDarkMode} />}
          <DataTable ariaLabel={tx(locale, "세그먼트 요약 표", "Segment summary table")} columns={[{ key: "segment", label: tx(locale, "세그먼트", "Segment") }, { key: "n", label: "n", align: "right" }, { key: "atRisk", label: tx(locale, "위험집합", "At risk"), align: "right", fmt: (value) => value == null ? "—" : fmtNum(value) }, { key: "events", label: tx(locale, "이탈", "Events"), align: "right" }, { key: "censoringRate", label: tx(locale, "중도절단률", "Censoring rate"), align: "right", fmt: (value) => fmtPct(value) }, { key: "survival", label: `S(${result.horizon})`, align: "right", fmt: (value) => fmtPct(value) }, { key: "rmst", label: "RMST", align: "right", fmt: (value) => value == null ? "—" : fmtNum(value, 2) }, { key: "ltv", label: "LTV", align: "right", fmt: (value) => value == null ? "—" : fmtCurrency(value, { precise: true }) }, { key: "ltvCac", label: "LTV:CAC", align: "right", fmt: (value) => value == null ? "—" : fmtNum(value, 2) }, { key: "evidenceStatus", label: tx(locale, "증거 상태", "Evidence"), fmt: (value) => statusCopy(value, locale) }]} rows={result.segmentSummaries} rowKey={(row) => row.segment} />
        </>}
      </section>}
      <section className="block"><h2 className="section-title">{tx(locale, "조건과 한계", "Conditions and limitations")}</h2>
        <p>{result.observationEndDate ? tx(locale, `관측 종료일은 ${result.observationEndDate}, 이탈 정의는 “${result.churnDefinition}”으로 기록했습니다.`, `Observation end date: ${result.observationEndDate}. Churn definition: “${result.churnDefinition}.”`) : tx(locale, `이탈 정의는 “${result.churnDefinition}”으로 기록했습니다. 관측 종료일은 제공되지 않았습니다.`, `Churn definition: “${result.churnDefinition}.” No observation end date was provided.`)}</p>
        {result.prepared.excludedRows.length > 0 && <p className="callout">{tx(locale, `${result.prepared.excludedRows.length}행은 날짜·기간·이벤트 값이 불완전하거나 모순되어 제외했습니다: `, `${result.prepared.excludedRows.length} rows were excluded for incomplete or contradictory date, tenure, or event values: `)}{Object.entries(result.prepared.exclusionsByReason).map(([reason, count]) => `${reason} (${count})`).join(", ")}</p>}
        <p>{tx(locale, "이 결과는 구독 에피소드의 관측 생존을 요약합니다. 채널·플랜·프로모션 차이는 관측된 연관이며 원인을 증명하지 않습니다. 관측 범위 밖 생존율과 LTV는 외삽하지 않습니다.", "This summarizes observed subscription-episode survival. Channel, plan, or promotion differences are associations, not causes. Survival and LTV are not extrapolated beyond the observed horizon.")}</p>
      </section>
    </>}
  </ToolPageShell>;
}
