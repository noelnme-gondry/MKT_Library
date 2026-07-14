"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import Chart from "chart.js/auto";
import { useAppStore } from "@/store/useDataStore";
import { getMonFilteredRows, effectiveDenomBasis } from "@/utils/dashboardAggregator";
import { CHART_TYPES } from "@/utils/metrics/chartBuilder";
import { buildCustomChartConfig, buildChartFieldOptions } from "@/utils/customChartConfig";
import { applyMetricView } from "@/utils/metrics/metricView";
import MetricConfigPanel from "@/components/ds/MetricConfigPanel";
import CustomChartBuilder from "@/components/ds/CustomChartBuilder";

const CUSTOM_CHARTS_COPY = {
  ko: {
    addChart: "＋ 커스텀 차트",
    addChartTitle: "모양·행·값을 골라 나만의 차트 만들기",
    editCharts: "⚙ 차트 편집",
    editChartsTitle: "표시할 차트와 순서 편집",
    noData: "데이터를 업로드하면 커스텀 차트를 만들 수 있습니다.",
    empty: (
      <>아직 만든 차트가 없습니다. <strong>＋ 커스텀 차트</strong>로 모양·행·값을 골라 추가하세요. 커스텀 지표도 값으로 쓸 수 있어요.</>
    ),
    allHidden: "표시할 차트가 없습니다. ⚙ 차트 편집에서 다시 켜세요.",
    configTitleSuffix: "— 차트 편집",
  },
  en: {
    addChart: "＋ Custom chart",
    addChartTitle: "Pick a shape, rows, and value to build your own chart",
    editCharts: "⚙ Edit charts",
    editChartsTitle: "Edit which charts show and their order",
    noData: "Upload data to build custom charts.",
    empty: (
      <>No charts yet. Click <strong>＋ Custom chart</strong> to pick a shape, rows, and value. Custom metrics can be used as values too.</>
    ),
    allHidden: "No charts are visible. Turn them back on in ⚙ Edit charts.",
    configTitleSuffix: "— Edit charts",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// CustomChartsSection — 재사용 커스텀 차트 영역 (Phase C 확대)
// ─────────────────────────────────────────────────────────────────────────────
// 어느 대시보드 탭에서도 한 줄로 붙이는 자기완결 커스텀 차트 섹션. 유저가 모양+행+값
// 으로 차트를 만들고(값=base/파생/커스텀 지표), 드래그·on/off로 표시/순서 편집.
// 자체 Chart.js 인스턴스 관리(§7 conditional-mount rAF resize). 정의는 store에 persist.
//
// props:
//  sectionNo    섹션 번호(§n) 표기
//  chartScope   customCharts·viewConfig 키(예 "5-2:seg-charts")
//  metricScope  값 옵션에 포함할 커스텀 지표 스코프(예 "5-2:viz-kpi") — 공유
//  title        섹션 제목
//  locale       "ko" | "en"
export default function CustomChartsSection({
  sectionNo = "＋", chartScope, metricScope, title, locale = "ko",
}) {
  const T = CUSTOM_CHARTS_COPY[locale] || CUSTOM_CHARTS_COPY.ko;
  const sectionTitle = title || (locale === "en" ? "Custom charts" : "커스텀 차트");
  const csvData = useAppStore((s) => s.csvData);
  const dashboardFilter = useAppStore((s) => s.dashboardFilter);
  const selectedCohort = useAppStore((s) => s.selectedCohort);
  const denomBasis = useAppStore((s) => s.denomBasis);
  const isDarkMode = useAppStore((s) => s.isDarkMode);
  const customMetrics = useAppStore((s) => s.customMetrics[metricScope]);
  const customCharts = useAppStore((s) => s.customCharts[chartScope]);
  const chartCfg = useAppStore((s) => s.viewConfig[chartScope]);
  const addCustomChart = useAppStore((s) => s.addCustomChart);
  const removeCustomChart = useAppStore((s) => s.removeCustomChart);
  const setViewConfig = useAppStore((s) => s.setViewConfig);
  const resetViewConfig = useAppStore((s) => s.resetViewConfig);

  const [builderOpen, setBuilderOpen] = useState(false);
  const [cfgOpen, setCfgOpen] = useState(false);

  const canvasRefs = useRef({});
  const chartsRef = useRef({});
  const setCanvasRef = (key) => (el) => { canvasRefs.current[key] = el; };

  const effBasis = effectiveDenomBasis(csvData, denomBasis);
  const filteredRows = useMemo(() => getMonFilteredRows(csvData, dashboardFilter), [csvData, dashboardFilter]);
  const hasData = !!(csvData && csvData.raw && csvData.raw.length);

  const { availDims, metricOptions, resolveMetricCompute, dimLabelOf, metricLabelOf } =
    buildChartFieldOptions(csvData && csvData.mapping, customMetrics);

  const chartDefs = customCharts || [];
  const chartMetas = chartDefs.map((def) => ({
    k: def.id,
    title: def.name,
    sub: `${CHART_TYPES.find((t) => t.id === def.type)?.label || def.type} · ${dimLabelOf(def.dim)}별 ${metricLabelOf(def.metric)}`,
  }));
  const orderedCharts = applyMetricView(chartMetas, chartCfg, (c) => c.k);
  const visibleKeys = orderedCharts.map((c) => c.k).join(",");
  const sig = JSON.stringify(chartDefs) + "|" + JSON.stringify(customMetrics || []) + "|" + selectedCohort + "|" + effBasis;

  useEffect(() => {
    const instances = chartsRef.current;
    Object.keys(instances).forEach((k) => { if (instances[k]) instances[k].destroy(); delete instances[k]; });
    for (const def of chartDefs) {
      const el = canvasRefs.current[def.id];
      if (!el) continue;
      instances[def.id] = new Chart(el.getContext("2d"), buildCustomChartConfig(def, filteredRows, {
        cohort: selectedCohort, denomBasis: effBasis, resolveMetricCompute, metricLabelOf,
      }));
    }
    // 조건부 마운트 캔버스 최초 폭 0 방지(§7) — 1회 resize.
    requestAnimationFrame(() => Object.values(chartsRef.current).forEach((c) => c && c.resize()));
    return () => { Object.values(instances).forEach((c) => c && c.destroy()); };
    // sig/visibleKeys/filteredRows가 실질 변경을 커버(정의·데이터·표시·테마).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, visibleKeys, filteredRows, isDarkMode]);

  return (
    <section className="block">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 className="section-title"><span className="ix">§{sectionNo}</span>{sectionTitle}</h2>
        <div style={{ display: "flex", gap: "6px" }}>
          <button className="ab-pill" onClick={() => setBuilderOpen(true)} title={T.addChartTitle}>{T.addChart}</button>
          {chartMetas.length > 0 && (
            <button className="ab-pill" onClick={() => setCfgOpen(true)} title={T.editChartsTitle}>{T.editCharts}</button>
          )}
        </div>
      </div>

      {!hasData ? (
        <p className="muted" style={{ fontSize: "12px" }}>{T.noData}</p>
      ) : chartMetas.length === 0 ? (
        <p className="muted" style={{ fontSize: "12px" }}>{T.empty}</p>
      ) : orderedCharts.length === 0 ? (
        <p className="muted" style={{ fontSize: "12px" }}>{T.allHidden}</p>
      ) : (
        <div className="chart-grid cols-2">
          {orderedCharts.map((c) => (
            <div key={c.k} className="chart-card">
              <div className="chart-title">{c.title}</div>
              <div className="chart-sub">{c.sub}</div>
              <div className="chart-canvas-wrap" style={{ height: "300px" }}><canvas ref={setCanvasRef(c.k)}></canvas></div>
            </div>
          ))}
        </div>
      )}

      <CustomChartBuilder
        open={builderOpen}
        onClose={() => setBuilderOpen(false)}
        dims={availDims}
        metrics={metricOptions}
        existing={chartDefs}
        onCreate={(def) => addCustomChart(chartScope, def)}
        onDelete={(id) => removeCustomChart(chartScope, id)}
      />
      <MetricConfigPanel
        open={cfgOpen}
        onClose={() => setCfgOpen(false)}
        title={`${sectionTitle} ${T.configTitleSuffix}`}
        items={chartMetas.map((c) => ({ key: c.k, label: c.title }))}
        config={chartCfg}
        onSave={(next) => {
          if (!next.hidden.length && !next.order.length) resetViewConfig(chartScope);
          else setViewConfig(chartScope, next);
          setCfgOpen(false);
        }}
      />
    </section>
  );
}
