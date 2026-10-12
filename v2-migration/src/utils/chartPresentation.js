import { CHART_FONT_STACK, CHART_THEME, refreshChartThemeColors } from "./chartUtils";

const CIRCULAR = new Set(["pie", "doughnut", "polarArea", "radar"]);
const SERIES_DASHES = [[], [6, 3], [2, 3], [8, 3, 2, 3]];

// Runs at the shared Chart.js boundary, including charts that replace scales or
// plugins from chartCommonOpts. Only presentation is changed: no data, domains,
// callbacks, stacking, step interpolation, confidence fills or point sizes.
export function applyChartPresentation(chart) {
  const options = chart.options;
  if (!options || options.plugins?.gopPresentation?.enabled === false) return;
  refreshChartThemeColors(chart);
  const type = chart.config?.type;
  const legend = options.plugins?.legend;
  if (legend?.labels) {
    legend.labels.color = CHART_THEME.text;
    legend.labels.font = { ...legend.labels.font, family: CHART_FONT_STACK, size: 12 };
    legend.labels.padding = 14;
    legend.labels.boxWidth = 8;
    legend.labels.boxHeight = 8;
  }
  if (!CIRCULAR.has(type)) {
    for (const [id, scale] of Object.entries(options.scales || {})) {
      if (scale.ticks) {
        scale.ticks.color = CHART_THEME.muted;
        scale.ticks.font = { ...scale.ticks.font, family: CHART_FONT_STACK, size: 12 };
      }
      if (scale.title) {
        scale.title.color = CHART_THEME.muted;
        scale.title.font = { ...scale.title.font, family: CHART_FONT_STACK, size: 12, weight: "400" };
      }
      const grid = chart.config?.options?.scales?.[id]?.grid || scale.grid;
      if (scale.grid) {
        if (typeof grid?.color !== "function") scale.grid.color = CHART_THEME.grid;
        if (typeof grid?.lineWidth !== "function") scale.grid.lineWidth = 1;
      }
      if (scale.border) scale.border.color = CHART_THEME.grid;
    }
  }
  const datasets = chart.data?.datasets || [];
  for (const [index, dataset] of datasets.entries()) {
    const kind = dataset.type || type;
    if (kind === "line") {
      dataset.borderWidth ??= 2.5;
      dataset.borderCapStyle ??= "round";
      dataset.borderJoinStyle ??= "round";
      if (datasets.length >= 4 && dataset.borderWidth > 0 && (dataset.fill == null || dataset.fill === false)) {
        dataset.borderDash ??= [...SERIES_DASHES[index % SERIES_DASHES.length]];
      }
    } else if (kind === "bar") {
      dataset.maxBarThickness ??= 24;
      dataset.borderRadius ??= 3;
    } else if (kind === "doughnut" || kind === "pie") {
      dataset.borderColor ??= CHART_THEME.border;
      dataset.borderWidth ??= 2;
      dataset.hoverOffset ??= 4;
    }
  }
}

export const chartPresentationPlugin = {
  id: "gopPresentation",
  beforeUpdate: applyChartPresentation,
};
