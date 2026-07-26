"use client";
import React, { useCallback, useEffect, useRef, useMemo, useState } from "react";
import Chart from "chart.js/auto";
import { useAppStore } from "@/store/useDataStore";
import { resolveDashCopy } from "@/utils/contentDomain";
import { getMonFilteredRows, aggregateByKey, buildRetentionCurve, calculateKPIs, effectiveDenomBasis, fmtCurrencyCompact, fmtCurrencyPrecise } from "@/utils/dashboardAggregator";
import { useRouter } from "next/navigation";
import { idToPath } from "@/lib/routeMap";
import { convertCurrency } from "@/utils/format";
import { CHART_THEME, chartCommonOpts } from "@/utils/chartUtils";
import { applyMetricView } from "@/utils/metrics/metricView";
import { customMetricToDescriptor } from "@/utils/metrics/customMetric";
import { CHART_TYPES } from "@/utils/metrics/chartBuilder";
import { buildCustomChartConfig, buildChartFieldOptions, buildCustomScorecardModel, formatCustomScorecardValue } from "@/utils/customChartConfig";
import MetricConfigPanel from "@/components/ds/MetricConfigPanel";
import InlineCardEditor from "@/components/ds/InlineCardEditor";
import CustomMetricBuilder from "@/components/ds/CustomMetricBuilder";
import CustomChartBuilder from "@/components/ds/CustomChartBuilder";

// 지표 뷰 설정 scope(도구:표면) — 운영 대시보드 자체(Viz 탭)의 KPI 카드·차트.
const VIZ_KPI_SCOPE = "5-2:viz-kpi";
const VIZ_CHART_SCOPE = "5-2:viz-charts";
// 첫 화면은 의사결정에 바로 쓰는 5개만. 나머지 진단 지표는 "편집"에서 켠다.
// 사용자가 저장한 설정이 있으면 그 설정이 이 기본값보다 항상 우선한다.
const DEFAULT_KPI_HIDDEN = ["ctr", "purchaseRate", "cpp", "revenue", "arpu", "arppu", "retention", "profit", "profitMargin", "purchases"];

// locale 카피(§ domain 리라벨과 별도 축 — C=resolveDashCopy는 domain 전용, 이 T는
// 이 컴포넌트 하드코딩 문자열의 ko/en만 담당. contentDomain.js는 건드리지 않음).
const VIZ_COPY = {
  ko: {
    funnelTitle: "전환 퍼널",
    funnelSubActions: "노출 → 클릭 → 설치 → 가입 → 결제(D7) 단계별 절대 건수 (로그 스케일)",
    funnelSubInstalls: "노출 → 클릭 → 설치 → 결제(D7) 단계별 절대 건수 (로그 스케일)",
    funnelLabelsActions: ["노출", "클릭", "설치", "가입", "결제 (D7)"],
    funnelLabelsInstalls: ["노출", "클릭", "설치", "결제 (D7)"],
    cohortTitle: "채널별 코호트 매출 증가 (D0 → D7 → D14)",
    cohortSub: "라인 · 채널별 누적 ARPU 증가 곡선",
    cumArpuAxis: "누적 ARPU",
    addMetric: "＋ 커스텀 지표",
    addMetricTitle: "데이터 컬럼으로 나만의 지표 만들기",
    reset: "초기화",
    resetTitle: "전체 표시·기본 순서·기본 크기",
    done: "완료",
    edit: "✏️ 편집",
    editTitle: "카드를 그 자리에서 드래그·표시/숨김·크기 편집",
    editHint: "⠿ 드래그로 이동 · 👁 표시/숨김. 변경은 자동 저장됩니다.",
    noKpi: "표시할 KPI가 없습니다.",
    addChart: "＋ 커스텀 차트",
    addChartTitle: "모양·행·값을 골라 나만의 차트 만들기",
    editChart: "⚙ 차트 편집",
    editChartTitle: "표시할 차트와 순서 편집",
    noChart: "표시할 차트가 없습니다. ⚙ 차트 편집에서 다시 켜세요.",
    cohortSectionTitle: "코호트 시점",
    cohortDesc: (d) => `매출/결제/잔존율은 선택된 코호트(D${d}) 기준으로 계산됩니다. 단일 지표(CPI/CTR/CVR/비용/설치)는 코호트 무관.`,
    kpiSectionTitle: "KPI 요약",
    chartSectionTitle: "차트 시각화",
    alertTitle: "D7 ROAS가 권장 벤치마크(15%) 미달입니다.",
    alertBody: (pct) => `현재 ${pct}% — UAC/AAP 캠페인의 입찰 단계·에셋 다양성·매체별 카니발 비중 진단이 필요합니다.`,
    purchasesLabel: (d) => `구매자 수 (D${d})`,
    purchasesDelta: (d) => `pu_d${d} 합산`,
    purchaseRateLabel: (d) => `구매율 (D${d})`,
    purchaseRateDelta: (basis) => `구매자 수 / ${basis}`,
    cppLabel: (d) => `CPP (D${d})`,
    cppDelta: "cost / 구매자 수",
    revenueLabel: (d) => `총 매출 (D${d})`,
    revenueDelta: "cohort revenue 합산",
    roasLabel: (d) => `ROAS (D${d})`,
    roasDelta: "revenue / cost",
    shareCopyLabel: "공유 복사",
    shareCopyText: (d, disp) => `현재 D${d} ROAS는 ${disp} 입니다.`,
    arpuLabel: (d) => `ARPU (D${d})`,
    arpuDelta: (basis) => `revenue / ${basis}`,
    arppuLabel: (d) => `ARPPU (D${d})`,
    arppuDelta: "revenue / 구매자 수",
    retentionLabel: (d) => `잔존율 (D${d})`,
    retentionDelta: "코호트 규모 가중",
    profitLabel: (d) => `이익 (D${d})`,
    profitDelta: "매출 − 비용",
    profitMarginLabel: (d) => `이익률 (D${d})`,
    profitMarginDelta: "(매출−비용) / 매출",
    customMetricDelta: "커스텀 지표",
    fieldCost: "비용",
    fieldImpr: "노출수",
    fieldClicks: "클릭수",
    fieldInstalls: "설치수",
    fieldActions: "액션/가입",
    fieldRevenue: (d) => `매출(D${d})`,
    fieldPurchases: (d) => `결제건수(D${d})`,
    chartEditPanelTitle: "차트 시각화 — 차트 편집",
    basisInstalls: "installs",
    basisActions: "actions",
    costLabel: "비용",
    countLabel: "건수",
    signupsWord: "가입",
    installsWord: "설치",
  },
  en: {
    funnelTitle: "Conversion Funnel",
    funnelSubActions: "Impressions → Clicks → Installs → Signups → Purchase(D7) absolute counts (log scale)",
    funnelSubInstalls: "Impressions → Clicks → Installs → Purchase(D7) absolute counts (log scale)",
    funnelLabelsActions: ["Impr", "Clicks", "Installs", "Signups", "Purchase (D7)"],
    funnelLabelsInstalls: ["Impr", "Clicks", "Installs", "Purchase (D7)"],
    cohortTitle: "Cohort Revenue Growth by Channel (D0 → D7 → D14)",
    cohortSub: "Line · Cumulative ARPU growth curve by channel",
    cumArpuAxis: "Cumulative ARPU",
    addMetric: "＋ Custom metric",
    addMetricTitle: "Build your own metric from data columns",
    reset: "Reset",
    resetTitle: "Show all · default order · default size",
    done: "Done",
    edit: "✏️ Edit",
    editTitle: "Drag to reorder, show/hide, resize cards in place",
    editHint: "⠿ Drag to move · 👁 show/hide. Changes save automatically.",
    noKpi: "No KPIs to display.",
    addChart: "＋ Custom chart",
    addChartTitle: "Pick a shape, rows, and values to build your own chart",
    editChart: "⚙ Edit charts",
    editChartTitle: "Edit which charts are shown and their order",
    noChart: "No charts to display. Re-enable them in ⚙ Edit charts.",
    cohortSectionTitle: "Cohort point",
    cohortDesc: (d) => `Revenue/purchases/retention are calculated for the selected cohort (D${d}). Single metrics (CPI/CTR/CVR/cost/installs) are cohort-independent.`,
    kpiSectionTitle: "KPI Summary",
    chartSectionTitle: "Chart Visualization",
    alertTitle: "D7 ROAS is below the recommended benchmark (15%).",
    alertBody: (pct) => `Currently ${pct}% — review UAC/AAP campaign bidding stage, asset diversity, and cannibalization by channel.`,
    purchasesLabel: (d) => `Purchasers (D${d})`,
    purchasesDelta: (d) => `Sum of pu_d${d}`,
    purchaseRateLabel: (d) => `Purchase rate (D${d})`,
    purchaseRateDelta: (basis) => `Purchasers / ${basis}`,
    cppLabel: (d) => `CPP (D${d})`,
    cppDelta: "cost / purchasers",
    revenueLabel: (d) => `Total revenue (D${d})`,
    revenueDelta: "Sum of cohort revenue",
    roasLabel: (d) => `ROAS (D${d})`,
    roasDelta: "revenue / cost",
    shareCopyLabel: "Copy",
    shareCopyText: (d, disp) => `Current D${d} ROAS is ${disp}.`,
    arpuLabel: (d) => `ARPU (D${d})`,
    arpuDelta: (basis) => `revenue / ${basis}`,
    arppuLabel: (d) => `ARPPU (D${d})`,
    arppuDelta: "revenue / purchasers",
    retentionLabel: (d) => `Retention (D${d})`,
    retentionDelta: "Weighted by cohort size",
    profitLabel: (d) => `Profit (D${d})`,
    profitDelta: "revenue − cost",
    profitMarginLabel: (d) => `Profit margin (D${d})`,
    profitMarginDelta: "(revenue − cost) / revenue",
    customMetricDelta: "Custom metric",
    fieldCost: "Cost",
    fieldImpr: "Impressions",
    fieldClicks: "Clicks",
    fieldInstalls: "Installs",
    fieldActions: "Actions/Signups",
    fieldRevenue: (d) => `Revenue(D${d})`,
    fieldPurchases: (d) => `Purchases(D${d})`,
    chartEditPanelTitle: "Chart Visualization — Edit charts",
    basisInstalls: "installs",
    basisActions: "actions",
    costLabel: "Cost",
    countLabel: "Count",
    signupsWord: "signups",
    installsWord: "installs",
  },
};

// resolveDashCopy는 도메인(퍼포먼스/콘텐츠)만 바꾸는 한글 팩이다. /en 경로에서는
// 이 화면의 제목·차트 설명·카드 라벨도 함께 영어로 바꿔야 한다.
const VIZ_DASH_COPY_EN = {
  performance: {
    acqLabel: (basis) => basis === "actions" ? "CPA" : "CPI",
    trendOutcome: (basis) => basis === "actions" ? "Actions" : "Installs",
    tsTitle: (basis) => `Daily Cost & ${basis === "actions" ? "Actions" : "Installs"}`,
    tsSub: (basis) => `Line · left: cost / right: ${basis === "actions" ? "actions" : "installs"}`,
    donutTitle: "Cost Share by Channel",
    donutSub: "Donut · total cost",
    cpiTitle: (acq) => `${acq} by Channel`,
    cpiSub: (basis) => `Horizontal bar · cost / ${basis === "actions" ? "actions" : "installs"}`,
    kpiCostLabel: "Total Cost",
    kpiCostDelta: "Total cost",
    kpiCtrLabel: "CTR",
    kpiCtrDelta: "clicks / impressions",
    kpiOutcomeLabel: (basis) => basis === "actions" ? "Total Actions" : "Total Installs",
    kpiOutcomeDelta: (basis) => `Total ${basis === "actions" ? "actions" : "installs"}`,
    acqDelta: (basis) => `cost / ${basis === "actions" ? "actions" : "installs"}`,
    chartsDesc: "Uploaded data is rendered as time series, channel share, acquisition-cost comparison, funnel, and cohort revenue charts. Use Edit charts to change visibility and order.",
  },
  content: {
    acqLabel: (basis) => basis === "actions" ? "Cost per Subscription" : "Cost per Visit",
    trendOutcome: (basis) => basis === "actions" ? "Subscriptions" : "Visits",
    tsTitle: (basis) => `Daily Cost & ${basis === "actions" ? "Subscriptions" : "Visits"}`,
    tsSub: (basis) => `Line · left: cost / right: ${basis === "actions" ? "subscriptions" : "visits"}`,
    donutTitle: "Cost Share by Source",
    donutSub: "Donut · total cost",
    cpiTitle: (acq) => `${acq} by Source`,
    cpiSub: (basis) => `Horizontal bar · cost / ${basis === "actions" ? "subscriptions" : "visits"}`,
    kpiCostLabel: "Total Cost",
    kpiCostDelta: "Total cost",
    kpiCtrLabel: "Engagement rate (CTR)",
    kpiCtrDelta: "clicks / impressions",
    kpiOutcomeLabel: (basis) => basis === "actions" ? "Total Subscriptions" : "Total Visits",
    kpiOutcomeDelta: (basis) => `Total ${basis === "actions" ? "subscriptions" : "visits"}`,
    acqDelta: (basis) => `cost / ${basis === "actions" ? "subscriptions" : "visits"}`,
    chartsDesc: "Uploaded data is rendered as daily traffic, source share, and cost-per-visit charts. Use Edit charts to change visibility and order.",
  },
};

// 차트에 이벤트 마커 세로선 + 라벨을 그리는 Chart.js 플러그인(§12.18 event marker draw).
// category x축(날짜 라벨)에서 marker.date에 매칭되는 x 픽셀에 점선을 그림.
function makeEventMarkerPlugin(markers) {
  return {
    id: "monEventMarkers",
    afterDatasetsDraw(chart) {
      if (!markers || !markers.length) return;
      const xScale = chart.scales.x;
      if (!xScale || !xScale.getLabels) return;
      const labels = xScale.getLabels();
      const { ctx, chartArea } = chart;
      if (!chartArea) return;
      ctx.save();
      for (const m of markers) {
        const idx = labels.indexOf(m.matchLabel);
        if (idx < 0) continue;
        const x = xScale.getPixelForValue(idx);
        if (x == null || !isFinite(x)) continue;
        ctx.beginPath();
        ctx.moveTo(x, chartArea.top);
        ctx.lineTo(x, chartArea.bottom);
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = "#f7b955";
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = "10px Inter, sans-serif";
        ctx.fillStyle = "#f7b955";
        ctx.textAlign = "left";
        ctx.save();
        ctx.translate(x + 3, chartArea.top + 4);
        ctx.fillText(String(m.label).slice(0, 16), 0, 0);
        ctx.restore();
      }
      ctx.restore();
    },
  };
}

export default function VizTab({ domain = "performance", locale = "ko" } = {}) {
  const router = useRouter();
  const C = resolveDashCopy(domain);
  const D = locale === "en" ? VIZ_DASH_COPY_EN[domain] || VIZ_DASH_COPY_EN.performance : C;
  const T = VIZ_COPY[locale] || VIZ_COPY.ko;
  const isContent = domain === "content";
  const csvData = useAppStore((state) => state.csvData);
  const displayCurrency = useAppStore((state) => state.displayCurrency);
  const dashboardFilter = useAppStore((state) => state.dashboardFilter);
  const selectedCohort = useAppStore((state) => state.selectedCohort);
  const setSelectedCohort = useAppStore((state) => state.setSelectedCohort);
  const denomBasis = useAppStore((state) => state.denomBasis);
  const eventMarkers = useAppStore((state) => state.eventMarkers);
  // 지표 뷰 설정(표시/순서) — KPI 카드·차트 각각 독립 scope.
  const storedKpiCfg = useAppStore((state) => state.viewConfig[VIZ_KPI_SCOPE]);
  // 기존 빈 설정은 예전 "전부 표시" 기본값이다. compact-v1을 명시한 사용자의
  // 편집 결과만 존중해, 업데이트 직후에도 새 기본 위계가 실제로 적용되게 한다.
  const hasCustomKpiView = storedKpiCfg?.preset === "compact-v1";
  const chartCfg = useAppStore((state) => state.viewConfig[VIZ_CHART_SCOPE]);
  const setViewConfig = useAppStore((state) => state.setViewConfig);
  const resetViewConfig = useAppStore((state) => state.resetViewConfig);
  // 커스텀 지표(Phase C) — Viz KPI surface scope에 조립·저장.
  const customMetrics = useAppStore((state) => state.customMetrics[VIZ_KPI_SCOPE]);
  const addCustomMetric = useAppStore((state) => state.addCustomMetric);
  const removeCustomMetric = useAppStore((state) => state.removeCustomMetric);
  const updateCustomMetric = useAppStore((state) => state.updateCustomMetric);
  const customCharts = useAppStore((state) => state.customCharts[VIZ_CHART_SCOPE]);
  const addCustomChart = useAppStore((state) => state.addCustomChart);
  const removeCustomChart = useAppStore((state) => state.removeCustomChart);
  const [kpiEditMode, setKpiEditMode] = useState(false);
  const [chartCfgOpen, setChartCfgOpen] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [chartBuilderOpen, setChartBuilderOpen] = useState(false);
  // null일 때만 데이터에서 첫 선택을 정한다. 사용자가 고른 카드는 필터 변경 뒤에도 유지한다.
  const [selectedMetric, setSelectedMetric] = useState(null);
  const detailCanvasRef = useRef(null);
  const detailChartRef = useRef(null);

  // Canvas 요소 refs — 차트 표시/순서가 동적이라 key→element 맵으로 보관(callback ref).
  // 숨긴 차트는 canvas가 unmount되며 React가 null로 세팅 → 생성 effect가 건너뜀.
  const canvasRefs = useRef({});
  const setCanvasRef = (key) => (el) => { canvasRefs.current[key] = el; };

  // Refs for Chart Instances
  const chartsRef = useRef({
    ts: null,
    donut: null,
    cpi: null,
    funnel: null,
    cohort: null,
  });

  const effBasis = effectiveDenomBasis(csvData, denomBasis);

  // 1. Data Aggregation (useMemo)
  const { filteredRows, dailyAgg, byChannel, totals, kpi, d7RoasNormalized } = useMemo(() => {
    const fRows = getMonFilteredRows(csvData, dashboardFilter);
    const dAgg = aggregateByKey(fRows, "date", ["cost", "installs", "actions", "revenue_d7", "clicks"]).sort(
      (a, b) => (a._key > b._key ? 1 : -1)
    );
    const chAgg = aggregateByKey(fRows.filter((r) => r.channel), "channel", [
      "cost",
      "installs",
      "actions",
      "revenue_d0",
      "revenue_d7",
      "revenue_d14",
    ]);
    const t = ["impressions", "clicks", "installs", "actions", "pu_d7", "cost", "revenue_d7"].reduce(
      (acc, f) => {
        acc[f] = fRows.reduce((a, r) => a + (Number(r[f]) || 0), 0);
        return acc;
      },
      {}
    );
    const k = calculateKPIs(fRows, selectedCohort, effBasis);
    const d7Kpi = t.cost ? t.revenue_d7 / t.cost : null;
    const roasNorm = k.roas == null ? null : k.roas > 1 ? k.roas : k.roas * 100;

    return { filteredRows: fRows, dailyAgg: dAgg, byChannel: chAgg, totals: t, kpi: k, d7RoasNormalized: roasNorm };
  }, [csvData, dashboardFilter, selectedCohort, effBasis]);

  // 도메인 라벨(effBasis 소비하는 C 메서드 호출은 데이터 메모 뒤에 둠 — 메모 앞에서
  // 불투명 호출로 effBasis를 소비하면 React Compiler가 메모 보존을 못 함).
  const sourceCurrency = ["KRW", "USD"].includes(csvData?.currency) ? csvData.currency : displayCurrency;
  const currencyValue = (value) => convertCurrency(Number(value), sourceCurrency, displayCurrency);
  const compactCurrency = (value) => fmtCurrencyCompact(currencyValue(value), displayCurrency, locale);
  const preciseCurrency = (value) => fmtCurrencyPrecise(currencyValue(value), displayCurrency);
  const acqLabel = D.acqLabel(effBasis);
  const trendOutcomeLabel = D.trendOutcome(effBasis);

  // 이벤트 마커를 일별 차트 라벨(_key = YYYY-MM-DD)에 매칭할 형태로 준비.
  const preparedMarkers = useMemo(
    () => (eventMarkers || []).map((m) => ({ label: m.label, matchLabel: m.date })),
    [eventMarkers]
  );

  // 2. Formatters
  const formatNumber = (num, { decimals = 0 } = {}) => {
    if (num == null || isNaN(num)) return "-";
    return Number(num).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };
  const formatPercent = (num) => {
    if (num == null || isNaN(num)) return "-";
    return (num * 100).toFixed(2) + "%";
  };

  // 차트 메타(데이터 주도) — 표시/순서 설정을 적용해 렌더·생성 대상을 결정.
  // 숨긴 차트는 카드가 안 그려져 ref.current=null → 생성 effect가 건너뜀(§Phase B).
  // ── 커스텀 지표/차트 공용: 매핑·집계키·지표 해석 ────────────────────────────
  const mappingEntries = Object.entries((csvData && csvData.mapping) || {});
  const mappedKeys = new Set(mappingEntries.map(([, v]) => v));
  const headerFor = (stdKey) => (mappingEntries.find(([, v]) => v === stdKey) || [])[0] || "";
  const hasRev = [...mappedKeys].some((k) => /^revenue_d/.test(k));
  const hasPu = [...mappedKeys].some((k) => /^pu_d/.test(k));
  const hasRetention = [...mappedKeys].some((k) => /^ret_d/.test(k));
  const valueMetricKey = hasRev ? "roas" : "ctr";
  // 첫 화면의 5개는 비용·성과량·획득비용·가치·리텐션. 리텐션 원자료가 없을 때도
  // 카드 슬롯은 유지하되 0%를 만들지 않는다. 편집 상태에서는 기존 모든 KPI를 쓸 수 있다.
  const kpiCfg = hasCustomKpiView
    ? { hidden: [], order: [], ...storedKpiCfg }
    : {
      hidden: DEFAULT_KPI_HIDDEN.filter((key) =>
        !["cost", "outcome", "acq", valueMetricKey, "retention"].includes(key)
      ),
      order: ["cost", "outcome", "acq", valueMetricKey, "retention"],
    };

  const dailyKpis = useMemo(() => {
    const byDate = new Map();
    for (const row of filteredRows) {
      if (!row.date) continue;
      const key = String(row.date);
      if (!byDate.has(key)) byDate.set(key, []);
      byDate.get(key).push(row);
    }
    return Array.from(byDate, ([date, rows]) => ({ date, kpi: calculateKPIs(rows, selectedCohort, effBasis) }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredRows, selectedCohort, effBasis]);

  const metricValue = useCallback((metric, valueKpi) => {
    if (!valueKpi) return null;
    if (metric === "outcome") return effBasis === "actions" ? valueKpi.actions : valueKpi.installs;
    if (metric === "acq") return valueKpi.cpi;
    if (metric === "retention") return valueKpi.retentionAvg;
    return valueKpi[metric] ?? null;
  }, [effBasis]);

  const metricTrend = (metric) => {
    const values = dailyKpis.map((d) => metricValue(metric, d.kpi)).filter((v) => Number.isFinite(v));
    if (values.length < 4) return {
      change: null,
      statusKey: "missing",
      status: locale === "en" ? "— Data needed" : "— 데이터 필요",
      note: locale === "en" ? "Not enough dated data for a period comparison." : "기간 비교를 위한 날짜 데이터가 부족합니다.",
    };
    const split = Math.floor(values.length / 2);
    const before = values.slice(0, split).reduce((sum, v) => sum + v, 0) / split;
    const after = values.slice(split).reduce((sum, v) => sum + v, 0) / (values.length - split);
    const change = before ? (after - before) / Math.abs(before) : null;
    if (change == null || !Number.isFinite(change)) return {
      change: null,
      statusKey: "missing",
      status: locale === "en" ? "— Data needed" : "— 데이터 필요",
      note: locale === "en" ? "No comparison baseline is available." : "비교 기준값이 없습니다.",
    };
    const higherIsBetter = ["outcome", "roas", "ctr", "retention"].includes(metric);
    const direction = higherIsBetter ? change : -change;
    const statusKey = Math.abs(change) < 0.03 ? "stable" : direction > 0 ? "improving" : "warning";
    const status = locale === "en"
      ? ({ stable: "✓ Stable", improving: "↗ Improving", warning: "▲ Attention" })[statusKey]
      : ({ stable: "✓ 안정", improving: "↗ 개선", warning: "▲ 주의" })[statusKey];
    const directionText = locale === "en" ? (change > 0 ? "up" : "down") : (change > 0 ? "상승" : "하락");
    const note = locale === "en"
      ? `${dailyKpis.length}-day trend: ${Math.abs(change * 100).toFixed(1)}% ${directionText}`
      : `최근 ${dailyKpis.length}일 ${Math.abs(change * 100).toFixed(1)}% ${directionText} 추세`;
    return { change, statusKey, status, note };
  };

  const recommendedMetric = useMemo(() => {
    const candidates = ["acq", "retention", valueMetricKey, "outcome", "cost"];
    const attention = candidates
      .map((key) => ({ key, trend: metricTrend(key) }))
      .filter(({ trend }) => trend.change != null)
      .map(({ key, trend }) => ({ key, severity: ["outcome", "roas", "ctr", "retention"].includes(key) ? -trend.change : trend.change }))
      .sort((a, b) => b.severity - a.severity);
    return attention[0]?.key || "acq";
  // metricTrend only reads memoized dailyKpis + stable render values.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dailyKpis, valueMetricKey, effBasis]);

  // 커스텀 차트 차원/값 옵션·해석기(공용 헬퍼 — CustomChartsSection과 DRY).
  const { availDims, metricOptions, resolveMetricCompute, dimLabelOf, metricLabelOf, metricUnitOf } =
    buildChartFieldOptions(csvData && csvData.mapping, customMetrics);
  const customChartDefs = customCharts || [];
  const customChartSig = JSON.stringify(customChartDefs) + "|" + JSON.stringify(customMetrics || []) + "|" + selectedCohort;

  // 차트 메타(plain const — React Compiler가 자동 메모이즈). 콘텐츠는 매출/결제 전제
  // 차트(퍼널·코호트 매출)를 제외하고 트래픽 차트 3종만 노출(§정직성).
  const chartMetaBase = [
    { k: "ts", title: D.tsTitle(effBasis), sub: D.tsSub(effBasis), full: false },
    { k: "donut", title: D.donutTitle, sub: D.donutSub, full: false },
    { k: "cpi", title: D.cpiTitle(acqLabel), sub: D.cpiSub(effBasis), full: false },
    { k: "funnel", title: T.funnelTitle, sub: effBasis === "actions" ? T.funnelSubActions : T.funnelSubInstalls, full: false },
    { k: "cohort", title: T.cohortTitle, sub: T.cohortSub, full: true },
  ];
  const chartMeta = isContent ? chartMetaBase.filter((c) => ["ts", "donut", "cpi"].includes(c.k)) : chartMetaBase;
  // 커스텀 차트 메타를 기본 5종 뒤에 붙여 표시/순서 편집 대상에 포함.
  const customChartMetas = customChartDefs.map((def) => ({
    k: def.id, custom: true, full: false,
    title: def.name,
    sub: `${locale === "en" ? ({ bar: "Bar", line: "Line", scorecard: "Scorecard" })[def.type] || def.type : CHART_TYPES.find((t) => t.id === def.type)?.label || def.type} · ${def.type === "scorecard" ? metricLabelOf(def.metric) : locale === "en" ? `${dimLabelOf(def.dim)} · ${metricLabelOf(def.metric)}` : `${dimLabelOf(def.dim)}별 ${metricLabelOf(def.metric)}`}`,
  }));
  // 기본 차트는 즉시 제공하고, 기본·커스텀 모두 같은 편집 패널에서 표시/숨김·순서를
  // 관리한다. 위 KPI 탐색 차트와 설정 scope는 분리되어 서로 덮어쓰지 않는다.
  const orderedCharts = applyMetricView([...chartMeta, ...customChartMetas], chartCfg, (c) => c.k);
  const visibleChartKeys = orderedCharts.map((c) => c.k).join(",");
  const activeMetric = selectedMetric || recommendedMetric;
  const activeTrend = metricTrend(activeMetric);
  const activeMetricLabel = activeMetric === "outcome"
    ? D.kpiOutcomeLabel(effBasis)
    : activeMetric === "acq"
      ? acqLabel
      : activeMetric === "retention"
        ? T.retentionLabel(selectedCohort)
        : activeMetric === "roas"
          ? T.roasLabel(selectedCohort)
          : activeMetric === "ctr"
            ? D.kpiCtrLabel
            : activeMetric === "cost"
              ? D.kpiCostLabel
              : (customMetrics || []).find((metric) => metric.id === activeMetric)?.name || activeMetric;

  const detailSeries = useMemo(() => {
    if (activeMetric === "retention") {
      return {
        labels: ["D0", "D7", "D14"],
        datasets: [{
          label: locale === "en" ? "Retention" : "리텐션",
          // D0는 코호트 시작 모수 자체이므로 정의상 100%. D7/D14만 원자료를 모수
          // 가중 집계한다(행 단순평균은 작은 코호트를 과대반영하므로 금지).
          data: buildRetentionCurve(filteredRows, effBasis, [0, 7, 14]),
          borderColor: CHART_THEME.primary, backgroundColor: "rgba(173,198,255,0.08)", borderWidth: 2.5, pointRadius: 4, tension: 0.28, fill: false,
        }],
      };
    }
    if ((customMetrics || []).some((metric) => metric.id === activeMetric)) return null;
    const dates = Array.from(new Set(filteredRows.map((row) => String(row.date || "")).filter(Boolean))).sort();
    const channels = Array.from(new Set(filteredRows.map((row) => String(row.channel || "").trim()).filter(Boolean))).sort();
    const rowsFor = (date, channel) => filteredRows.filter((row) => String(row.date) === date && (!channel || String(row.channel || "").trim() === channel));
    const valuesFor = (channel) => dates.map((date) => metricValue(activeMetric, calculateKPIs(rowsFor(date, channel), selectedCohort, effBasis)));
    return {
      labels: dates,
      datasets: [
        { label: locale === "en" ? "Total" : "전체", data: valuesFor(null), borderColor: CHART_THEME.primary, backgroundColor: "rgba(173,198,255,0.08)", borderWidth: 2.5, pointRadius: 2, tension: 0.28, fill: false },
        ...channels.slice(0, 6).map((channel, index) => ({ label: channel, data: valuesFor(channel), borderColor: CHART_THEME.series[index % CHART_THEME.series.length], borderWidth: 1.5, pointRadius: 0, tension: 0.28, fill: false })),
      ],
    };
  }, [activeMetric, customMetrics, filteredRows, selectedCohort, effBasis, locale, metricValue]);

  useEffect(() => {
    if (detailChartRef.current) detailChartRef.current.destroy();
    const canvas = detailCanvasRef.current;
    if (!canvas || !activeMetric || !detailSeries) return undefined;
    detailChartRef.current = new Chart(canvas.getContext("2d"), {
      type: "line",
      plugins: [makeEventMarkerPlugin(preparedMarkers)],
      data: detailSeries,
      options: {
        ...chartCommonOpts(),
        plugins: {
          ...chartCommonOpts().plugins,
          legend: { ...chartCommonOpts().plugins.legend, labels: { color: CHART_THEME.text, usePointStyle: true } },
          tooltip: activeMetric === "retention"
            ? {
              ...chartCommonOpts().plugins.tooltip,
              callbacks: { label: (context) => `${context.dataset.label}: ${(Number(context.parsed.y) * 100).toFixed(1)}%` },
            }
            : chartCommonOpts().plugins.tooltip,
        },
        scales: {
          ...chartCommonOpts().scales,
          y: {
            ...chartCommonOpts().scales.y,
            max: activeMetric === "retention" ? 1 : undefined,
            ticks: activeMetric === "retention"
              ? { ...chartCommonOpts().scales.y.ticks, callback: (value) => `${Math.round(Number(value) * 100)}%` }
              : chartCommonOpts().scales.y.ticks,
            title: { display: true, text: activeMetricLabel, color: CHART_THEME.muted, font: { size: 10 } },
          },
        },
      },
    });
    requestAnimationFrame(() => detailChartRef.current?.resize());
    return () => detailChartRef.current?.destroy();
  }, [activeMetric, activeMetricLabel, detailSeries, preparedMarkers]);

  // 3. Chart Rendering Effect
  useEffect(() => {
    const instances = chartsRef.current;

    // Destroy existing charts + 삭제된 커스텀 차트의 stale 키 정리(다시 생성).
    Object.keys(instances).forEach((k) => {
      if (instances[k]) instances[k].destroy();
      delete instances[k];
    });

    // 1) Time Series Chart (이벤트 마커 세로선 오버레이 포함)
    if (canvasRefs.current.ts) {
      instances.ts = new Chart(canvasRefs.current.ts.getContext("2d"), {
        type: "line",
        plugins: [makeEventMarkerPlugin(preparedMarkers)],
        data: {
          labels: dailyAgg.map((d) => d._key),
          datasets: [
            {
              label: T.costLabel,
              data: dailyAgg.map((d) => d.cost),
              yAxisID: "y",
              borderColor: CHART_THEME.primary,
              backgroundColor: "rgba(173,198,255,0.1)",
              tension: 0.3,
              fill: true,
              pointRadius: 0,
              borderWidth: 2,
            },
            {
              label: trendOutcomeLabel,
              data: dailyAgg.map((d) => (effBasis === "actions" ? d.actions : d.installs)),
              yAxisID: "y1",
              borderColor: CHART_THEME.secondary,
              backgroundColor: "rgba(76,215,246,0.05)",
              tension: 0.3,
              fill: false,
              pointRadius: 0,
              borderWidth: 2,
            },
          ],
        },
        options: {
          ...chartCommonOpts(),
          scales: {
            x: { ...chartCommonOpts().scales.x },
            y: {
              ...chartCommonOpts().scales.y,
              position: "left",
              title: { display: true, text: T.costLabel, color: CHART_THEME.muted, font: { size: 10 } },
            },
            y1: {
              ...chartCommonOpts().scales.y,
              position: "right",
              title: { display: true, text: trendOutcomeLabel, color: CHART_THEME.muted, font: { size: 10 } },
              grid: { display: false },
            },
          },
        },
      });
    }

    // 2) Channel Donut Chart
    if (canvasRefs.current.donut) {
      const sortedCh = [...byChannel].sort((a, b) => b.cost - a.cost);
      instances.donut = new Chart(canvasRefs.current.donut.getContext("2d"), {
        type: "doughnut",
        data: {
          labels: sortedCh.map((c) => c._key),
          datasets: [{
            data: sortedCh.map((c) => c.cost),
            backgroundColor: sortedCh.map((_, i) => CHART_THEME.series[i % CHART_THEME.series.length]),
            borderColor: "transparent",
            borderWidth: 2,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "62%",
          plugins: {
            legend: {
              position: "right",
              labels: { color: CHART_THEME.text, font: { family: "Inter", size: 11 }, usePointStyle: true, padding: 12 },
            },
            tooltip: chartCommonOpts().plugins.tooltip,
          },
        },
      });
    }

    // 3) CPI/CPA Bar Chart — 전역 분모 기준 따라 설치당/가입당 비용
    if (canvasRefs.current.cpi) {
      const cpiData = byChannel
        .map((c) => {
          const denom = effBasis === "actions" ? c.actions : c.installs;
          return { key: c._key, cpi: denom ? c.cost / denom : 0 };
        })
        .filter((d) => d.cpi > 0)
        .sort((a, b) => a.cpi - b.cpi);

      instances.cpi = new Chart(canvasRefs.current.cpi.getContext("2d"), {
        type: "bar",
        data: {
          labels: cpiData.map((d) => d.key),
          datasets: [{
            label: acqLabel,
            data: cpiData.map((d) => d.cpi),
            backgroundColor: cpiData.map((_, i) => CHART_THEME.series[i % CHART_THEME.series.length] + "cc"),
            borderRadius: 4,
            barThickness: 18,
          }],
        },
        options: {
          ...chartCommonOpts(),
          indexAxis: "y",
          plugins: { ...chartCommonOpts().plugins, legend: { display: false } },
        },
      });
    }

    // 4) Funnel Bar Chart — 기준이 '가입'이면 가입 단계 추가(설치 4단계 vs 가입 5단계)
    if (canvasRefs.current.funnel) {
      const funnelLabels = effBasis === "actions"
        ? T.funnelLabelsActions
        : T.funnelLabelsInstalls;
      const funnelData = effBasis === "actions"
        ? [totals.impressions, totals.clicks, totals.installs, totals.actions, totals.pu_d7]
        : [totals.impressions, totals.clicks, totals.installs, totals.pu_d7];
      const funnelColors = effBasis === "actions"
        ? ["#adc6ff", "#4cd7f6", "#5ad19a", "#bb9af7", "#f7b955"]
        : ["#adc6ff", "#4cd7f6", "#5ad19a", "#f7b955"];
      instances.funnel = new Chart(canvasRefs.current.funnel.getContext("2d"), {
        type: "bar",
        data: {
          labels: funnelLabels,
          datasets: [{
            label: T.countLabel,
            data: funnelData,
            backgroundColor: funnelColors,
            borderRadius: 4,
          }],
        },
        options: {
          ...chartCommonOpts(),
          // 절대 건수는 노출이 압도 → 로그 스케일(§12.18)
          scales: {
            ...chartCommonOpts().scales,
            y: { ...chartCommonOpts().scales.y, type: "logarithmic", beginAtZero: false },
          },
          plugins: { ...chartCommonOpts().plugins, legend: { display: false } },
        },
      });
    }

    // 5) Cohort Line Chart
    if (canvasRefs.current.cohort) {
      const topCh = [...byChannel].sort((a, b) => (b.revenue_d7 || 0) - (a.revenue_d7 || 0)).slice(0, 6);
      const datasets = topCh.map((c, i) => {
        // 전역 분모 기준(설치/가입) — ARPU 분모도 다른 차트와 동일하게 전환(§12.18).
        const denom = effBasis === "actions" ? c.actions : c.installs;
        return {
          label: c._key,
          data: [
            denom ? c.revenue_d0 / denom : 0,
            denom ? c.revenue_d7 / denom : 0,
            denom ? c.revenue_d14 / denom : 0,
          ],
          borderColor: CHART_THEME.series[i % CHART_THEME.series.length],
          backgroundColor: CHART_THEME.series[i % CHART_THEME.series.length],
          tension: 0.1,
          borderWidth: 2,
          pointRadius: 4,
        };
      });

      instances.cohort = new Chart(canvasRefs.current.cohort.getContext("2d"), {
        type: "line",
        data: {
          labels: ["D0", "D7", "D14"],
          datasets,
        },
        options: {
          ...chartCommonOpts(),
          scales: {
            x: { ...chartCommonOpts().scales.x },
            y: {
              ...chartCommonOpts().scales.y,
              title: { display: true, text: T.cumArpuAxis, color: CHART_THEME.muted, font: { size: 10 } },
            },
          },
        },
      });
    }

    // 6) 커스텀 차트 — 표시 중인 것만(숨김/삭제 시 canvas 없음 → skip). 유저가 만든
    //    "모양+행+값"으로 차원별 집계·지표 계산해 렌더. 커스텀 지표 열도 값으로 사용.
    for (const def of customChartDefs) {
      if (def.type === "scorecard") continue;
      const el = canvasRefs.current[def.id];
      if (!el) continue;
      instances[def.id] = new Chart(el.getContext("2d"), buildCustomChartConfig(def, filteredRows, {
        cohort: selectedCohort, denomBasis: effBasis, resolveMetricCompute, metricLabelOf,
      }));
    }

    // 마커 세로선(afterDatasetsDraw)은 Chart.js 애니메이션 완료 후에나 최초 페인트됨(§12.18) —
    // 마커 추가 시 매번 destroy+recreate라 400ms 페이드인 동안 "반영 안 됨"처럼 보일 수 있음.
    // 애니메이션/rAF 스케줄과 무관하게 즉시 1프레임 동기 draw로 마커가 바로 보이게 강제.
    Object.values(instances).forEach((chart) => {
      if (chart) chart.draw();
    });

    return () => {
      Object.values(instances).forEach((chart) => {
        if (chart) chart.destroy();
      });
    };
    // visibleChartKeys=표시/순서 변경, customChartSig=커스텀 차트 정의·코호트·커스텀지표
    // 변경, filteredRows=데이터 변경 시 재생성. customChartDefs/buildCustomChartConfig는
    // 매 렌더 새 참조지만 위 sig가 실질 변경을 모두 커버(매 렌더 재실행 방지).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dailyAgg, byChannel, totals, preparedMarkers, effBasis, acqLabel, trendOutcomeLabel, visibleChartKeys, customChartSig, filteredRows, locale]);

  // KPI 카드는 빠른 스캔용 미니 차트이자 아래 탐색 차트의 지표 선택기다. PVM 결과를
  // 여기서 재계산하지 않으므로 원인 대신 관찰 가능한 추세만 보여준다.
  const explorerCard = (key, label, value, { unavailable = false } = {}) => {
    const trend = metricTrend(key);
    // 카드 안에서는 최근 28개 시점의 "모양"을 읽는다. 절대값/max 방식은 값이
    // 1,300→1,360처럼 움직일 때 선이 위쪽에 눌려 거의 평평해 보이므로, 카드별
    // min-max로 세로 범위를 정규화한다. 정확한 값·축 비교는 아래 큰 차트가 담당한다.
    const sparkValues = dailyKpis.map((d) => metricValue(key, d.kpi)).filter((v) => Number.isFinite(v)).slice(-28);
    const min = sparkValues.length ? Math.min(...sparkValues) : 0;
    const max = sparkValues.length ? Math.max(...sparkValues) : 0;
    const range = max - min;
    const sparkY = (v) => range ? 25 - ((v - min) / range) * 19 : 15;
    const points = sparkValues.length > 1
      ? sparkValues.map((v, index) => `${(index / (sparkValues.length - 1)) * 100},${sparkY(v)}`).join(" ")
      : "0,15 100,15";
    const lastY = sparkValues.length ? sparkY(sparkValues[sparkValues.length - 1]) : 15;
    const isSelected = activeMetric === key;
    const tone = unavailable ? "neutral" : trend.statusKey === "warning" ? "warning" : trend.statusKey === "improving" ? "improving" : "stable";
    return (
      <button key={key} type="button" className={`kpi-card kpi-card--explorer${isSelected ? " is-selected" : ""}`} aria-pressed={isSelected} onClick={() => setSelectedMetric(key)}>
        <span className="kpi-card__select-state">{isSelected ? (locale === "en" ? "Selected" : "선택됨") : ""}</span>
        <span className="label">{label}</span>
        <strong className="value tnum">{unavailable ? (locale === "en" ? "Data needed" : "리텐션 데이터 필요") : value}</strong>
        <svg className={`kpi-sparkline is-${tone}`} viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
          <polygon points={`0,30 ${points} 100,30`} />
          <polyline points={points} />
          <circle cx="100" cy={lastY} r="2.5" />
        </svg>
        <span className={`delta ${trend.statusKey === "warning" ? "down" : ""}`}>{unavailable ? (locale === "en" ? "— Data needed" : "— 데이터 필요") : trend.status}</span>
        <span className="kpi-card__note">{unavailable ? (locale === "en" ? "Map a ret_dN column" : "ret_dN 컬럼을 매핑하세요") : trend.note}</span>
      </button>
    );
  };

  // KPI 카드(데이터 주도) — 표시/순서 설정 적용.
  const kpiCards = [
    { k: "cost", label: D.kpiCostLabel, node: explorerCard("cost", D.kpiCostLabel, compactCurrency(kpi.cost)) },
    { k: "ctr", label: D.kpiCtrLabel, node: explorerCard("ctr", D.kpiCtrLabel, formatPercent(kpi.ctr)) },
    { k: "outcome", label: D.kpiOutcomeLabel(effBasis), node: explorerCard("outcome", D.kpiOutcomeLabel(effBasis), formatNumber(effBasis === "actions" ? kpi.actions : kpi.installs)) },
    { k: "acq", label: acqLabel, node: explorerCard("acq", acqLabel, preciseCurrency(kpi.cpi)) },
    { k: "purchases", label: T.purchasesLabel(kpi.cohort), node: (
      <div key="purchases" className="kpi-card"><div className="label">{T.purchasesLabel(kpi.cohort)}</div><div className="value tnum">{formatNumber(kpi.purchases)}</div><div className="delta">{T.purchasesDelta(kpi.cohort)}</div></div>
    ) },
    { k: "purchaseRate", label: T.purchaseRateLabel(kpi.cohort), node: (
      <div key="purchaseRate" className="kpi-card"><div className="label">{T.purchaseRateLabel(kpi.cohort)}</div><div className="value tnum">{formatPercent(kpi.purchaseRate)}</div><div className="delta">{T.purchaseRateDelta(effBasis === "actions" ? T.signupsWord : T.installsWord)}</div></div>
    ) },
    { k: "cpp", label: T.cppLabel(kpi.cohort), node: (
      <div key="cpp" className="kpi-card"><div className="label">{T.cppLabel(kpi.cohort)}</div><div className="value tnum">{preciseCurrency(kpi.cpp)}</div><div className="delta">{T.cppDelta}</div></div>
    ) },
    { k: "revenue", label: T.revenueLabel(kpi.cohort), node: (
      <div key="revenue" className="kpi-card"><div className="label">{T.revenueLabel(kpi.cohort)}</div><div className="value tnum">{compactCurrency(kpi.revenue)}</div><div className="delta">{T.revenueDelta}</div></div>
    ) },
    { k: "roas", label: T.roasLabel(kpi.cohort), node: explorerCard("roas", T.roasLabel(kpi.cohort), formatPercent(kpi.roas)) },
    { k: "arpu", label: T.arpuLabel(kpi.cohort), node: (
      <div key="arpu" className="kpi-card"><div className="label">{T.arpuLabel(kpi.cohort)}</div><div className="value tnum">{preciseCurrency(kpi.arpu)}</div><div className="delta">{T.arpuDelta(effBasis === "actions" ? "actions" : "installs")}</div></div>
    ) },
    { k: "arppu", label: T.arppuLabel(kpi.cohort), node: (
      <div key="arppu" className="kpi-card"><div className="label">{T.arppuLabel(kpi.cohort)}</div><div className="value tnum">{preciseCurrency(kpi.arppu)}</div><div className="delta">{T.arppuDelta}</div></div>
    ) },
    { k: "retention", label: T.retentionLabel(kpi.cohort), node: explorerCard("retention", T.retentionLabel(kpi.cohort), formatPercent(kpi.retentionAvg), { unavailable: !hasRetention }) },
  ];
  // 커스텀/프리셋 지표가 읽는 집계객체 — kpi가 이미 base 합계(cost·impressions·…·
  // revenue·purchases·denom)를 보유(calculateKPIs=metricRegistry 소비).
  const agg = kpi;

  // 빌더 피연산자 = 실제 매핑된 컬럼만(오타 불가). 라벨 옆에 실제 CSV 헤더 표기.
  // (mappingEntries·mappedKeys·headerFor·hasRev·hasPu는 위 공용 블록에서 계산됨)
  const builderFields = [
    { key: "cost", label: T.fieldCost, header: headerFor("cost") },
    mappedKeys.has("impressions") && { key: "impressions", label: T.fieldImpr, header: headerFor("impressions") },
    mappedKeys.has("clicks") && { key: "clicks", label: T.fieldClicks, header: headerFor("clicks") },
    mappedKeys.has("installs") && { key: "installs", label: T.fieldInstalls, header: headerFor("installs") },
    mappedKeys.has("actions") && { key: "actions", label: T.fieldActions, header: headerFor("actions") },
    hasRev && { key: "revenue", label: T.fieldRevenue(kpi.cohort), header: headerFor(`revenue_d${kpi.cohort}`) },
    hasPu && { key: "purchases", label: T.fieldPurchases(kpi.cohort), header: headerFor(`pu_d${kpi.cohort}`) },
  ].filter(Boolean);

  // 프리셋 지표(이익·이익률) — 매출 데이터 있을 때만 후보로. kpi에 이미 계산됨.
  const presetCards = [];
  if (hasRev) {
    presetCards.push({ k: "profit", label: T.profitLabel(kpi.cohort), node: (
      <div key="profit" className="kpi-card"><div className="label">{T.profitLabel(kpi.cohort)}</div><div className="value tnum">{compactCurrency(kpi.profit)}</div><div className="delta">{T.profitDelta}</div></div>
    ) });
    presetCards.push({ k: "profitMargin", label: T.profitMarginLabel(kpi.cohort), node: (
      <div key="profitMargin" className="kpi-card"><div className="label">{T.profitMarginLabel(kpi.cohort)}</div><div className="value tnum">{formatPercent(kpi.profitMargin)}</div><div className="delta">{T.profitMarginDelta}</div></div>
    ) });
  }

  // 유저 커스텀 지표 — 조립 정의를 순수 compute로 변환해 카드화(토글/순서/삭제 가능).
  const customCards = (customMetrics || []).map((def) => {
    const val = customMetricToDescriptor(def).compute(agg);
    return { k: def.id, label: def.name, node: (
      <div key={def.id} className="kpi-card"><div className="label">{def.name}</div><div className="value tnum">{val == null ? "—" : formatNumber(val, { decimals: 2 })}</div><div className="delta">{T.customMetricDelta}</div></div>
    ) };
  });

  // 콘텐츠는 매출·결제·리텐션 기반 카드(purchases/revenue/roas/arpu/retention 등)를
  // 노출하지 않음 — 콘텐츠 데이터엔 그 지표가 없어 0으로 날조하지 않고 트래픽 지표만(§정직성).
  const shownBase = isContent
    ? kpiCards.filter((c) => ["cost", "ctr", "outcome", "acq"].includes(c.k))
    : kpiCards;
  const allKpiCards = [...shownBase, ...presetCards, ...customCards].map((c) => ({ key: c.k, label: c.label, node: c.node }));

  const saveScope = (scope, next, setOpen) => {
    if (!next.hidden.length && !next.order.length) resetViewConfig(scope);
    else setViewConfig(scope, next);
    setOpen(false);
  };
  const goToTool = (id) => router.push(`${locale === "en" ? "/en" : ""}${idToPath(id)}`);
  const isCustomActive = (customMetrics || []).some((metric) => metric.id === activeMetric);
  const customChartById = new Map(customChartDefs.map((def) => [def.id, def]));
  const customScorecardFor = (key) => {
    const def = customChartById.get(key);
    if (!def || def.type !== "scorecard") return null;
    return buildCustomScorecardModel(def, filteredRows, {
      cohort: selectedCohort,
      denomBasis: effBasis,
      resolveMetricCompute,
      metricLabelOf,
      metricUnitOf,
    });
  };
  const formatCustomScorecard = (model) => formatCustomScorecardValue(
    model?.unit === "currency" && model.value != null ? { ...model, value: currencyValue(model.value) } : model,
    displayCurrency,
    locale,
  );
  const actionButtons = activeMetric === "acq"
    ? [[locale === "en" ? "View drivers in PVM" : "PVM으로 원인 보기", "5-21"], [locale === "en" ? "Check saturation" : "포화도 확인", "5-22"], [locale === "en" ? "Simulate budget allocation" : "예산 배분 시뮬레이션", "5-3"]]
    : activeMetric === "outcome"
      ? [[locale === "en" ? "View channel changes" : "채널별 변화 보기", "5-21"]]
      : activeMetric === "roas"
        ? [[locale === "en" ? "View LTV & ROAS" : "LTV & ROAS 보기", "5-2"], [locale === "en" ? "Allocate budget" : "예산 배분", "5-3"]]
        : activeMetric === "retention"
          ? [[locale === "en" ? "View cohort details" : "코호트 상세 보기", "5-2"]]
          : [];

  return (
    <div className="tab-pane active" id="tab-viz">
      {/* Alert Banner */}
      {kpi.cohort === 7 && d7RoasNormalized != null && d7RoasNormalized < 15 && (
        <aside className="alert-banner" role="alert">
          <div className="alert-icon">⚠</div>
          <div className="alert-body">
            <strong>{T.alertTitle}</strong>
            {T.alertBody(d7RoasNormalized.toFixed(2))}
          </div>
        </aside>
      )}

      {/* Cohort Toggle — 콘텐츠는 매출/결제/잔존율(코호트 지표)이 없어 제외(§정직성). */}
      {!isContent && (
      <section className="block" id="s-cohort">
        <h2 className="section-title"><span className="ix">§1</span>{T.cohortSectionTitle}</h2>
        <div className="cohort-toggle" id="cohort-toggle" style={{ marginBottom: "1rem" }}>
          <button data-cohort="0" className={selectedCohort === 0 ? "active" : ""} onClick={() => setSelectedCohort(0)}>D0</button>
          <button data-cohort="7" className={selectedCohort === 7 ? "active" : ""} onClick={() => setSelectedCohort(7)}>D7</button>
          <button data-cohort="14" className={selectedCohort === 14 ? "active" : ""} onClick={() => setSelectedCohort(14)}>D14</button>
        </div>
        <p>{T.cohortDesc(kpi.cohort)}</p>
      </section>
      )}

      {/* KPI Summary */}
      <section className="block" id="s-kpi">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 className="section-title"><span className="ix">§2</span>{T.kpiSectionTitle}</h2>
          <div style={{ display: "flex", gap: "6px" }}>
            <button className="ab-pill" onClick={() => setBuilderOpen(true)} title={T.addMetricTitle}>{T.addMetric}</button>
            {kpiEditMode ? (
              <>
                <button className="ab-pill" onClick={() => resetViewConfig(VIZ_KPI_SCOPE)} title={T.resetTitle}>{T.reset}</button>
                <button className="ab-pill active" onClick={() => setKpiEditMode(false)} style={{ fontWeight: 700 }}>{T.done}</button>
              </>
            ) : (
              <button className="ab-pill" onClick={() => setKpiEditMode(true)} title={T.editTitle}>{T.edit}</button>
            )}
          </div>
        </div>
        {kpiEditMode && (
          <p className="muted" style={{ fontSize: "11px", margin: "0 0 8px" }}>{T.editHint}</p>
        )}
        {!kpiEditMode && <p className="kpi-grid__hint">{locale === "en" ? "Showing the five core KPIs. Enable the rest in Edit." : "핵심 5개만 표시 중 · 나머지 지표는 편집에서 켤 수 있습니다."}</p>}
        {allKpiCards.length === 0 ? (
          <p className="muted" style={{ fontSize: "12px" }}>{T.noKpi}</p>
        ) : (
          <InlineCardEditor
            items={allKpiCards}
            config={kpiCfg}
            editMode={kpiEditMode}
            onPatch={(p) => setViewConfig(VIZ_KPI_SCOPE, { ...p, preset: "compact-v1" })}
            gridClassName="kpi-grid kpi-grid--overview"
          />
        )}
      </section>

      {/* 선택 KPI 탐색 — 카드와 하나의 큰 실제 차트를 1:1로 연결한다. */}
      <section className="block dashboard-explorer" id="s-charts">
        <div className="dashboard-explorer__head">
          <div>
            <span className="dashboard-explorer__eyebrow">{locale === "en" ? "Selected KPI" : "선택됨"}</span>
            <h2 className="section-title">{activeMetricLabel} {locale === "en" ? "trend" : "추이"}</h2>
          </div>
          <span className="dashboard-explorer__status">{activeTrend.status}</span>
        </div>
        {isCustomActive ? (
          <div className="dashboard-explorer__empty">{locale === "en" ? "Custom KPIs currently support aggregate values only. A date-level adapter will be added after the same formula is validated for trend calculations." : "커스텀 KPI는 현재 합계값 계산만 지원합니다. 날짜별 같은 식을 재계산하는 어댑터를 검증한 뒤 추이 차트에 추가할 수 있습니다."}</div>
        ) : (
          <>
            <div className="chart-canvas-wrap dashboard-explorer__canvas"><canvas ref={detailCanvasRef}></canvas></div>
            <p className="dashboard-explorer__interpretation">
              {activeTrend.change == null
                ? (locale === "en" ? "Not enough dated data for a period comparison." : "기간 비교를 위한 날짜 데이터가 부족합니다.")
                : activeMetric === "retention"
                  ? locale === "en"
                    ? `${activeMetricLabel} is ${Math.abs(activeTrend.change * 100).toFixed(1)}% ${activeTrend.change > 0 ? "higher" : "lower"} over the last ${dailyKpis.length} days. D0 is 100%; D7 and D14 retention are weighted by cohort size.`
                    : `최근 ${dailyKpis.length}일 ${activeMetricLabel}가 ${Math.abs(activeTrend.change * 100).toFixed(1)}% ${activeTrend.change > 0 ? "상승" : "하락"}했습니다. D0는 100%이며, D7·D14는 코호트 규모로 가중한 잔존율입니다.`
                  : locale === "en"
                    ? `${activeMetricLabel} is ${Math.abs(activeTrend.change * 100).toFixed(1)}% ${activeTrend.change > 0 ? "higher" : "lower"} over the last ${dailyKpis.length} days. Channel lines are observations; use PVM to assess drivers.`
                    : `최근 ${dailyKpis.length}일 ${activeMetricLabel}가 ${Math.abs(activeTrend.change * 100).toFixed(1)}% ${activeTrend.change > 0 ? "상승" : "하락"}했습니다. 채널별 선은 관찰값이며, 원인 판단은 PVM 분석에서 확인하세요.`}
            </p>
          </>
        )}
        <div className="dashboard-explorer__actions">
          {actionButtons.length ? actionButtons.map(([label, id]) => <button key={id} type="button" className="ab-pill" onClick={() => goToTool(id)}>{label}</button>) : <span className="muted">{activeMetric === "cost" || activeMetric === "ctr" ? (locale === "en" ? "This metric has no driver model. Showing channel observations only." : "원인 모델이 없는 지표입니다. 채널별 관찰값만 표시합니다.") : (locale === "en" ? "Check your data mapping." : "데이터 매핑을 확인하세요.")}</span>}
        </div>
      </section>

      {/* 기본+사용자 보조 차트 — KPI 탐색 차트와 별도 설정을 유지한다. */}
      <section className="block" id="s-custom-charts">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 className="section-title"><span className="ix">§3</span>{locale === "en" ? "Custom charts" : "보조 차트"}</h2>
          <div style={{ display: "flex", gap: "6px" }}>
            <button className="ab-pill" onClick={() => setChartBuilderOpen(true)} title={T.addChartTitle}>{T.addChart}</button>
            <button className="ab-pill" onClick={() => setChartCfgOpen(true)} title={T.editChartTitle}>{T.editChart}</button>
          </div>
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: "13px" }}>{locale === "en" ? "Use the ready-made charts or add your own, then edit visibility and order." : "기본 차트를 바로 사용하거나 새 차트를 추가하고, 표시 여부와 순서를 편집할 수 있습니다."}</p>

        {/* 이벤트 마커 입력 UI는 여기가 아니라 Dashboard.jsx에서 탭 콘텐츠 위에
            <MonEventMarkerUI/>로 렌더됨(전 탭 공통 상단 1곳). 여기 시계열 차트는
            store.eventMarkers를 preparedMarkers로 구독해 세로선만 오버레이. */}

        {orderedCharts.length === 0 ? (
          <p className="muted" style={{ fontSize: "12px" }}>{T.noChart}</p>
        ) : (
          <div className="chart-grid cols-2">
            {orderedCharts.map((c) => (
              <div key={c.k} className="chart-card" style={c.full ? { gridColumn: "1 / -1" } : undefined}>
                <div className="chart-title">{c.title}</div>
                <div className="chart-sub">{c.sub}</div>
                {customScorecardFor(c.k) ? (
                  <div className="custom-scorecard">
                    <span>{customScorecardFor(c.k).label}</span>
                    <strong className="tnum">{formatCustomScorecard(customScorecardFor(c.k))}</strong>
                    <small>{locale === "en" ? "Current filtered total" : "현재 필터 기준 전체값"}</small>
                  </div>
                ) : (
                  <div className="chart-canvas-wrap" style={{ height: "300px" }}><canvas ref={setCanvasRef(c.k)}></canvas></div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <CustomMetricBuilder
        open={builderOpen}
        onClose={() => setBuilderOpen(false)}
        locale={locale}
        fields={builderFields}
        agg={agg}
        existing={customMetrics || []}
        onCreate={(def) => addCustomMetric(VIZ_KPI_SCOPE, def)}
        onUpdate={(id, def) => updateCustomMetric(VIZ_KPI_SCOPE, id, def)}
        onDelete={(id) => removeCustomMetric(VIZ_KPI_SCOPE, id)}
      />
      <MetricConfigPanel
        open={chartCfgOpen}
        onClose={() => setChartCfgOpen(false)}
        locale={locale}
        title={T.chartEditPanelTitle}
        items={[...chartMeta, ...customChartMetas].map((c) => ({ key: c.k, label: c.title }))}
        config={chartCfg}
        onSave={(next) => saveScope(VIZ_CHART_SCOPE, next, setChartCfgOpen)}
      />
      <CustomChartBuilder
        open={chartBuilderOpen}
        onClose={() => setChartBuilderOpen(false)}
        locale={locale}
        dims={availDims}
        metrics={metricOptions}
        existing={customChartDefs}
        onCreate={(def) => addCustomChart(VIZ_CHART_SCOPE, def)}
        onDelete={(id) => removeCustomChart(VIZ_CHART_SCOPE, id)}
      />
    </div>
  );
}
