"use client";
import React, { useEffect, useRef, useMemo, useState } from "react";
import Chart from "chart.js/auto";
import { useAppStore } from "@/store/useDataStore";
import { resolveDashCopy } from "@/utils/contentDomain";
import { getMonFilteredRows, aggregateByKey, calculateKPIs, effectiveDenomBasis } from "@/utils/dashboardAggregator";
import { CHART_THEME, chartCommonOpts } from "@/utils/chartUtils";
import { applyMetricView } from "@/utils/metrics/metricView";
import { customMetricToDescriptor } from "@/utils/metrics/customMetric";
import { CHART_TYPES } from "@/utils/metrics/chartBuilder";
import { buildCustomChartConfig, buildChartFieldOptions } from "@/utils/customChartConfig";
import MetricConfigPanel from "@/components/ds/MetricConfigPanel";
import InlineCardEditor from "@/components/ds/InlineCardEditor";
import CustomMetricBuilder from "@/components/ds/CustomMetricBuilder";
import CustomChartBuilder from "@/components/ds/CustomChartBuilder";
import { copyToClipboard } from "@/utils/toast";

// 지표 뷰 설정 scope(도구:표면) — 운영 대시보드 자체(Viz 탭)의 KPI 카드·차트.
const VIZ_KPI_SCOPE = "5-2:viz-kpi";
const VIZ_CHART_SCOPE = "5-2:viz-charts";

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
    retentionLabel: (d) => `잔존율 평균 (D${d})`,
    retentionDelta: "행별 평균",
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
    retentionLabel: (d) => `Avg retention (D${d})`,
    retentionDelta: "Average by row",
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
  const C = resolveDashCopy(domain);
  const T = VIZ_COPY[locale] || VIZ_COPY.ko;
  const isContent = domain === "content";
  const csvData = useAppStore((state) => state.csvData);
  const dashboardFilter = useAppStore((state) => state.dashboardFilter);
  const selectedCohort = useAppStore((state) => state.selectedCohort);
  const setSelectedCohort = useAppStore((state) => state.setSelectedCohort);
  const denomBasis = useAppStore((state) => state.denomBasis);
  const eventMarkers = useAppStore((state) => state.eventMarkers);
  // 지표 뷰 설정(표시/순서) — KPI 카드·차트 각각 독립 scope.
  const kpiCfg = useAppStore((state) => state.viewConfig[VIZ_KPI_SCOPE]);
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
  const { filteredRows, dailyAgg, byChannel, totals, kpi, d7RoasNormalized, d7Display } = useMemo(() => {
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
    const d7Display = d7Kpi ? (d7Kpi * 100).toFixed(2) + "%" : "";
    const roasNorm = k.roas == null ? null : k.roas > 1 ? k.roas : k.roas * 100;

    return { filteredRows: fRows, dailyAgg: dAgg, byChannel: chAgg, totals: t, kpi: k, d7RoasNormalized: roasNorm, d7Display };
  }, [csvData, dashboardFilter, selectedCohort, effBasis]);

  // 도메인 라벨(effBasis 소비하는 C 메서드 호출은 데이터 메모 뒤에 둠 — 메모 앞에서
  // 불투명 호출로 effBasis를 소비하면 React Compiler가 메모 보존을 못 함).
  const acqLabel = C.acqLabel(effBasis);
  const trendOutcomeLabel = C.trendOutcome(effBasis);

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

  // 커스텀 차트 차원/값 옵션·해석기(공용 헬퍼 — CustomChartsSection과 DRY).
  const { availDims, metricOptions, resolveMetricCompute, dimLabelOf, metricLabelOf } =
    buildChartFieldOptions(csvData && csvData.mapping, customMetrics);
  const customChartDefs = customCharts || [];
  const customChartSig = JSON.stringify(customChartDefs) + "|" + JSON.stringify(customMetrics || []) + "|" + selectedCohort;

  // 차트 메타(plain const — React Compiler가 자동 메모이즈). 콘텐츠는 매출/결제 전제
  // 차트(퍼널·코호트 매출)를 제외하고 트래픽 차트 3종만 노출(§정직성).
  const chartMetaBase = [
    { k: "ts", title: C.tsTitle(effBasis), sub: C.tsSub(effBasis), full: false },
    { k: "donut", title: C.donutTitle, sub: C.donutSub, full: false },
    { k: "cpi", title: C.cpiTitle(acqLabel), sub: C.cpiSub(effBasis), full: false },
    { k: "funnel", title: T.funnelTitle, sub: effBasis === "actions" ? T.funnelSubActions : T.funnelSubInstalls, full: false },
    { k: "cohort", title: T.cohortTitle, sub: T.cohortSub, full: true },
  ];
  const chartMeta = isContent ? chartMetaBase.filter((c) => ["ts", "donut", "cpi"].includes(c.k)) : chartMetaBase;
  // 커스텀 차트 메타를 기본 5종 뒤에 붙여 표시/순서 편집 대상에 포함.
  const customChartMetas = customChartDefs.map((def) => ({
    k: def.id, custom: true, full: false,
    title: def.name,
    sub: `${CHART_TYPES.find((t) => t.id === def.type)?.label || def.type} · ${dimLabelOf(def.dim)}별 ${metricLabelOf(def.metric)}`,
  }));
  const orderedCharts = applyMetricView([...chartMeta, ...customChartMetas], chartCfg, (c) => c.k);
  const visibleChartKeys = orderedCharts.map((c) => c.k).join(",");

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

  // KPI 카드(데이터 주도) — 표시/순서 설정 적용. node=기존 카드 JSX 유지(값·계산 불변).
  const kpiCards = [
    { k: "cost", label: C.kpiCostLabel, node: (
      <div key="cost" className="kpi-card"><div className="label">{C.kpiCostLabel}</div><div className="value tnum">{formatNumber(kpi.cost)}</div><div className="delta">{C.kpiCostDelta}</div></div>
    ) },
    { k: "ctr", label: C.kpiCtrLabel, node: (
      <div key="ctr" className="kpi-card"><div className="label">{C.kpiCtrLabel}</div><div className="value tnum">{formatPercent(kpi.ctr)}</div><div className="delta">{C.kpiCtrDelta}</div></div>
    ) },
    { k: "outcome", label: C.kpiOutcomeLabel(effBasis), node: (
      <div key="outcome" className="kpi-card"><div className="label">{C.kpiOutcomeLabel(effBasis)}</div><div className="value tnum">{formatNumber(effBasis === "actions" ? kpi.actions : kpi.installs)}</div><div className="delta">{C.kpiOutcomeDelta(effBasis)}</div></div>
    ) },
    { k: "acq", label: acqLabel, node: (
      <div key="acq" className="kpi-card"><div className="label">{acqLabel}</div><div className="value tnum">{formatNumber(kpi.cpi, { decimals: 2 })}</div><div className="delta">{C.acqDelta(effBasis)}</div></div>
    ) },
    { k: "purchases", label: T.purchasesLabel(kpi.cohort), node: (
      <div key="purchases" className="kpi-card"><div className="label">{T.purchasesLabel(kpi.cohort)}</div><div className="value tnum">{formatNumber(kpi.purchases)}</div><div className="delta">{T.purchasesDelta(kpi.cohort)}</div></div>
    ) },
    { k: "purchaseRate", label: T.purchaseRateLabel(kpi.cohort), node: (
      <div key="purchaseRate" className="kpi-card"><div className="label">{T.purchaseRateLabel(kpi.cohort)}</div><div className="value tnum">{formatPercent(kpi.purchaseRate)}</div><div className="delta">{T.purchaseRateDelta(effBasis === "actions" ? T.signupsWord : T.installsWord)}</div></div>
    ) },
    { k: "cpp", label: T.cppLabel(kpi.cohort), node: (
      <div key="cpp" className="kpi-card"><div className="label">{T.cppLabel(kpi.cohort)}</div><div className="value tnum">{formatNumber(kpi.cpp, { decimals: 2 })}</div><div className="delta">{T.cppDelta}</div></div>
    ) },
    { k: "revenue", label: T.revenueLabel(kpi.cohort), node: (
      <div key="revenue" className="kpi-card"><div className="label">{T.revenueLabel(kpi.cohort)}</div><div className="value tnum">{formatNumber(kpi.revenue)}</div><div className="delta">{T.revenueDelta}</div></div>
    ) },
    { k: "roas", label: T.roasLabel(kpi.cohort), node: (
      <div key="roas" className="kpi-card" style={{ position: "relative" }}>
        <div className="label">{T.roasLabel(kpi.cohort)}</div>
        <div className="value tnum">{formatPercent(kpi.roas)}</div>
        <div className="delta" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "0.25rem" }}>
          <span>{T.roasDelta}</span>
          {d7Display && (
            <button
              className="share-btn"
              onClick={() => copyToClipboard(T.shareCopyText(kpi.cohort, d7Display))}
              style={{ padding: "1px 5px", fontSize: "9.5px", height: "16px", lineHeight: "1", borderRadius: "3px", marginLeft: "auto", background: "rgba(255,255,255,0.06)", border: "1px solid var(--border-subtle)", display: "inline-flex", alignItems: "center", gap: "3px", color: "var(--text-secondary)", cursor: "pointer", whiteSpace: "nowrap" }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              {T.shareCopyLabel}
            </button>
          )}
        </div>
      </div>
    ) },
    { k: "arpu", label: T.arpuLabel(kpi.cohort), node: (
      <div key="arpu" className="kpi-card"><div className="label">{T.arpuLabel(kpi.cohort)}</div><div className="value tnum">{formatNumber(kpi.arpu, { decimals: 2 })}</div><div className="delta">{T.arpuDelta(effBasis === "actions" ? "actions" : "installs")}</div></div>
    ) },
    { k: "arppu", label: T.arppuLabel(kpi.cohort), node: (
      <div key="arppu" className="kpi-card"><div className="label">{T.arppuLabel(kpi.cohort)}</div><div className="value tnum">{formatNumber(kpi.arppu, { decimals: 2 })}</div><div className="delta">{T.arppuDelta}</div></div>
    ) },
    { k: "retention", label: T.retentionLabel(kpi.cohort), node: (
      <div key="retention" className="kpi-card"><div className="label">{T.retentionLabel(kpi.cohort)}</div><div className="value tnum">{formatPercent(kpi.retentionAvg)}</div><div className="delta">{T.retentionDelta}</div></div>
    ) },
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
      <div key="profit" className="kpi-card"><div className="label">{T.profitLabel(kpi.cohort)}</div><div className="value tnum">{formatNumber(kpi.profit)}</div><div className="delta">{T.profitDelta}</div></div>
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
        {allKpiCards.length === 0 ? (
          <p className="muted" style={{ fontSize: "12px" }}>{T.noKpi}</p>
        ) : (
          <InlineCardEditor
            items={allKpiCards}
            config={kpiCfg}
            editMode={kpiEditMode}
            onPatch={(p) => setViewConfig(VIZ_KPI_SCOPE, p)}
            gridClassName="kpi-grid"
          />
        )}
      </section>

      {/* Charts Grid */}
      <section className="block" id="s-charts">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 className="section-title"><span className="ix">§3</span>{T.chartSectionTitle}</h2>
          <div style={{ display: "flex", gap: "6px" }}>
            <button className="ab-pill" onClick={() => setChartBuilderOpen(true)} title={T.addChartTitle}>{T.addChart}</button>
            <button className="ab-pill" onClick={() => setChartCfgOpen(true)} title={T.editChartTitle}>{T.editChart}</button>
          </div>
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: "13px" }}>{C.chartsDesc}</p>

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
                <div className="chart-canvas-wrap" style={{ height: "300px" }}><canvas ref={setCanvasRef(c.k)}></canvas></div>
              </div>
            ))}
          </div>
        )}
      </section>

      <CustomMetricBuilder
        open={builderOpen}
        onClose={() => setBuilderOpen(false)}
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
        title={T.chartEditPanelTitle}
        items={[...chartMeta, ...customChartMetas].map((c) => ({ key: c.k, label: c.title }))}
        config={chartCfg}
        onSave={(next) => saveScope(VIZ_CHART_SCOPE, next, setChartCfgOpen)}
      />
      <CustomChartBuilder
        open={chartBuilderOpen}
        onClose={() => setChartBuilderOpen(false)}
        dims={availDims}
        metrics={metricOptions}
        existing={customChartDefs}
        onCreate={(def) => addCustomChart(VIZ_CHART_SCOPE, def)}
        onDelete={(id) => removeCustomChart(VIZ_CHART_SCOPE, id)}
      />
    </div>
  );
}
