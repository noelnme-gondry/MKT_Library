// 커스텀 차트 Chart.js 설정 빌더 (컴포넌트층 헬퍼 — 순수 아님, CHART_THEME는 CSS 읽음).
// VizTab·CustomChartsSection 공용(DRY). 순수 집계는 metrics/chartBuilder.js(골든).
import { CHART_THEME, chartCommonOpts } from "./chartUtils";
import { groupAggByDim, buildChartSeries } from "./metrics/chartBuilder";
import { METRIC_BY_ID, BASE_FIELDS, DERIVED_METRICS } from "./metrics/metricRegistry";
import { customMetricToDescriptor } from "./metrics/customMetric";

// 커스텀 차트 행(차원) 후보 — 매핑된 것만 노출.
export const DIM_CANDIDATES = [
  { key: "channel", label: "채널" },
  { key: "country", label: "국가" },
  { key: "platform", label: "OS" },
  { key: "campaign_name", label: "캠페인" },
  { key: "date", label: "날짜" },
];

// mapping + 커스텀 지표 → 차트 빌더용 차원/값 옵션·해석기(VizTab·CustomChartsSection 공용).
export function buildChartFieldOptions(mapping, customMetrics) {
  const mappedKeys = new Set(Object.values(mapping || {}));
  const hasRev = [...mappedKeys].some((k) => /^revenue_d/.test(k));
  const hasPu = [...mappedKeys].some((k) => /^pu_d/.test(k));
  const availDims = DIM_CANDIDATES.filter((d) => mappedKeys.has(d.key));
  const availAggKeys = new Set(["cost"]);
  ["impressions", "clicks", "installs", "actions"].forEach((k) => { if (mappedKeys.has(k)) availAggKeys.add(k); });
  if (hasRev) availAggKeys.add("revenue");
  if (hasPu) availAggKeys.add("purchases");
  if (mappedKeys.has("installs") || mappedKeys.has("actions")) availAggKeys.add("denom");
  const cms = customMetrics || [];
  const metricOptions = [
    ...BASE_FIELDS.filter((f) => f.id !== "denom" && availAggKeys.has(f.id)).map((f) => ({ key: f.id, label: f.label })),
    ...DERIVED_METRICS.filter((m) => m.deps.every((d) => availAggKeys.has(d))).map((m) => ({ key: m.id, label: m.label })),
    ...cms.map((m) => ({ key: m.id, label: m.name, unit: m.unit || "number" })),
  ];
  const resolveMetricCompute = (key) => {
    if (METRIC_BY_ID[key]) return METRIC_BY_ID[key].compute;
    const cm = cms.find((m) => m.id === key);
    if (cm) return customMetricToDescriptor(cm).compute;
    return () => null;
  };
  const dimLabelOf = (k) => DIM_CANDIDATES.find((d) => d.key === k)?.label || k;
  const metricLabelOf = (k) => metricOptions.find((m) => m.key === k)?.label || k;
  const metricUnitOf = (k) => metricOptions.find((m) => m.key === k)?.unit
    || METRIC_BY_ID[k]?.unit
    || "number";
  return { availDims, metricOptions, resolveMetricCompute, dimLabelOf, metricLabelOf, metricUnitOf };
}

// 스코어카드는 차원별 분할 없이 현재 필터 전체를 한 번 집계해 단일 실제값을 보여준다.
// 차트용 시리즈와 같은 groupAggByDim/metric compute 경로를 써 수치 SSOT를 유지한다.
export function buildCustomScorecardModel(def, rows, opts) {
  const { cohort = 7, denomBasis = "installs", resolveMetricCompute, metricLabelOf, metricUnitOf } = opts || {};
  const whole = groupAggByDim(rows, "__scorecard_all__", cohort, denomBasis)[0];
  const compute = resolveMetricCompute ? resolveMetricCompute(def.metric) : null;
  const value = whole && typeof compute === "function" ? compute(whole.agg) : null;
  return {
    label: metricLabelOf ? metricLabelOf(def.metric) : def.metric,
    unit: metricUnitOf ? metricUnitOf(def.metric) : "number",
    value: value == null || !isFinite(value) ? null : value,
  };
}

export function formatCustomScorecardValue(model, currency = "KRW", locale = "ko") {
  if (!model || model.value == null || !isFinite(model.value)) return "—";
  if (model.unit === "ratio") return `${(model.value * 100).toLocaleString(locale === "ko" ? "ko-KR" : "en-US", { maximumFractionDigits: 2 })}%`;
  if (model.unit === "currency") {
    const symbol = currency === "USD" ? "$" : "₩";
    return `${symbol}${Number(model.value).toLocaleString(locale === "ko" ? "ko-KR" : "en-US", { maximumFractionDigits: 2 })}`;
  }
  return Number(model.value).toLocaleString(locale === "ko" ? "ko-KR" : "en-US", { maximumFractionDigits: 2 });
}

// def={type,dim,metric,name} · rows=표준키 매핑 행 · opts={cohort,denomBasis,
// resolveMetricCompute(metricKey)=>fn, metricLabelOf(metricKey)=>string}
export function buildCustomChartConfig(def, rows, opts) {
  const { cohort = 7, denomBasis = "installs", resolveMetricCompute, metricLabelOf } = opts || {};
  const groups = groupAggByDim(rows, def.dim, cohort, denomBasis);
  const series = buildChartSeries(groups, resolveMetricCompute(def.metric), { topN: 20, sortDesc: def.type !== "line" });
  const colors = series.labels.map((_, i) => CHART_THEME.series[i % CHART_THEME.series.length]);
  const isPie = def.type === "pie" || def.type === "doughnut";
  const isLine = def.type === "line";
  const chartType = isPie ? def.type : isLine ? "line" : "bar";
  return {
    type: chartType,
    data: {
      labels: series.labels,
      datasets: [{
        label: metricLabelOf ? metricLabelOf(def.metric) : def.metric,
        data: series.values,
        backgroundColor: isPie ? colors : isLine ? "rgba(173,198,255,0.1)" : colors.map((c) => c + "cc"),
        borderColor: isLine ? CHART_THEME.primary : colors,
        borderWidth: isLine ? 2 : 1,
        borderRadius: isPie ? 0 : 4,
        tension: 0.3,
        pointRadius: isLine ? 2 : 0,
        fill: isLine,
      }],
    },
    options: isPie ? {
      responsive: true, maintainAspectRatio: false, cutout: def.type === "doughnut" ? "62%" : 0,
      plugins: { legend: { position: "right", labels: { color: CHART_THEME.text, font: { family: "Inter", size: 11 }, usePointStyle: true, padding: 10 } }, tooltip: chartCommonOpts().plugins.tooltip },
    } : {
      ...chartCommonOpts(), indexAxis: def.type === "hbar" ? "y" : "x",
      plugins: { ...chartCommonOpts().plugins, legend: { display: false } },
    },
  };
}
