"use client";

import { useEffect, useMemo, useRef } from "react";

import Chart from "@/utils/chartGlobals";
import {
  CHART_FONT_STACK,
  CHART_THEME,
  chartCommonOpts,
  downloadChartAsPNG,
  getCssVar,
} from "@/utils/chartUtils";
import { fmtCurrencyCompact, fmtCurrencyPrecise } from "@/utils/dashboardAggregator";
import { buildScaleDecisionMatrix } from "@/utils/scaleDecisionMatrix";

const ACTION_ORDER = ["scale", "maintain", "watch", "stop", "reduce"];

function actionCopy(locale, metric) {
  const en = locale === "en";
  const shared = {
    scale: { label: en ? "Scale" : "증액 검토", detail: en ? "low cost · strong efficiency" : "낮은 비용 · 좋은 효율", tone: "primary" },
    maintain: { label: en ? "Maintain" : "유지", detail: en ? "high cost · strong efficiency" : "높은 비용 · 좋은 효율", tone: "success" },
    reduce: { label: en ? "Reduce" : "감액 검토", detail: en ? "high cost · weak efficiency" : "높은 비용 · 낮은 효율", tone: "danger" },
  };
  if (metric === "cpa") {
    return {
      ...shared,
      stop: { label: en ? "Consider stopping" : "종료 검토", detail: en ? "low cost · high CPA" : "낮은 비용 · 높은 CPA", tone: "danger" },
    };
  }
  return {
    ...shared,
    watch: { label: en ? "Watch" : "관찰·개선", detail: en ? "low cost · low ROAS" : "낮은 비용 · 낮은 ROAS", tone: "warning" },
  };
}

function toneColor(tone) {
  if (tone === "success") return CHART_THEME.success;
  if (tone === "danger") return CHART_THEME.danger;
  if (tone === "warning") return CHART_THEME.warning;
  return CHART_THEME.primary;
}

function formatMetric(value, metric, currency, locale, compact = false) {
  if (!Number.isFinite(value)) return "—";
  if (metric === "roas") return `${value.toFixed(2)}x`;
  return compact ? fmtCurrencyCompact(value, currency, locale) : fmtCurrencyPrecise(value, currency);
}

function bubbleRadius(points, value) {
  const volumes = points.map((point) => Math.max(0, point.results || 0));
  const max = Math.max(...volumes, 0);
  const min = Math.min(...volumes.filter((item) => item > 0), max);
  if (!(max > 0) || max === min) return 10;
  const scaled = (Math.sqrt(Math.max(0, value)) - Math.sqrt(min)) / (Math.sqrt(max) - Math.sqrt(min));
  return 7 + Math.max(0, Math.min(1, scaled)) * 13;
}

function quadrantPositions(metric) {
  return metric === "roas"
    ? { topLeft: "scale", topRight: "maintain", bottomLeft: "watch", bottomRight: "reduce" }
    : { topLeft: "stop", topRight: "reduce", bottomLeft: "scale", bottomRight: "maintain" };
}

function buildDecisionFieldPlugin({ thresholds, positions, actions }) {
  return {
    id: "scaleDecisionField",
    beforeDatasetsDraw(chart) {
      const { ctx, chartArea, scales } = chart;
      const xMid = scales.x.getPixelForValue(thresholds.cost);
      const yMid = scales.y.getPixelForValue(thresholds.efficiency);
      if (![xMid, yMid].every(Number.isFinite)) return;

      const regions = [
        [chartArea.left, chartArea.top, xMid - chartArea.left, yMid - chartArea.top, positions.topLeft],
        [xMid, chartArea.top, chartArea.right - xMid, yMid - chartArea.top, positions.topRight],
        [chartArea.left, yMid, xMid - chartArea.left, chartArea.bottom - yMid, positions.bottomLeft],
        [xMid, yMid, chartArea.right - xMid, chartArea.bottom - yMid, positions.bottomRight],
      ];
      ctx.save();
      for (const [x, y, width, height, action] of regions) {
        ctx.globalAlpha = 0.045;
        ctx.fillStyle = toneColor(actions[action].tone);
        ctx.fillRect(x, y, Math.max(0, width), Math.max(0, height));
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = CHART_THEME.border;
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(xMid, chartArea.top);
      ctx.lineTo(xMid, chartArea.bottom);
      ctx.moveTo(chartArea.left, yMid);
      ctx.lineTo(chartArea.right, yMid);
      ctx.stroke();
      ctx.restore();
    },
    afterDatasetsDraw(chart) {
      const dataset = chart.data.datasets[0];
      const meta = chart.getDatasetMeta(0);
      const outline = getCssVar("--surface-container-lowest");
      const labelIndexes = dataset.data
        .map((point, index) => ({ index, cost: point.x }))
        .sort((a, b) => b.cost - a.cost)
        .slice(0, 12)
        .map((item) => item.index);

      chart.ctx.save();
      chart.ctx.font = `650 10px ${CHART_FONT_STACK}`;
      chart.ctx.textBaseline = "middle";
      for (const index of labelIndexes) {
        const element = meta.data[index];
        const point = dataset.data[index];
        if (!element || !point) continue;
        const text = point.name.length > 18 ? `${point.name.slice(0, 17)}…` : point.name;
        const x = element.x + element.options.radius + 4;
        const y = element.y;
        chart.ctx.lineWidth = 3;
        chart.ctx.strokeStyle = outline;
        chart.ctx.strokeText(text, x, y);
        chart.ctx.fillStyle = CHART_THEME.textPrimary;
        chart.ctx.fillText(text, x, y);
      }
      chart.ctx.restore();
    },
  };
}

export default function ScaleDecisionMap({
  rows,
  grain,
  metric,
  resultField,
  revenueField,
  currency,
  locale = "ko",
  isDarkMode = true,
}) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const matrix = useMemo(() => buildScaleDecisionMatrix({
    rows,
    grain,
    metric,
    resultField,
    revenueField,
  }), [rows, grain, metric, resultField, revenueField]);
  const actions = useMemo(() => actionCopy(locale, metric), [locale, metric]);
  const positions = useMemo(() => quadrantPositions(metric), [metric]);
  const isEn = locale === "en";
  const grainLabel = grain === "campaign" ? (isEn ? "campaign" : "캠페인") : (isEn ? "channel" : "채널");
  const metricLabel = metric === "roas" ? "ROAS" : "CPA";
  const resultLabel = resultField === "installs" ? (isEn ? "installs" : "설치") : (isEn ? "actions" : "액션·가입");
  const actionCounts = Object.fromEntries(ACTION_ORDER.map((key) => [key, 0]));
  matrix.points.forEach((point) => { if (point.action) actionCounts[point.action] += 1; });

  useEffect(() => {
    if (!canvasRef.current || matrix.points.length < 2 || !Number.isFinite(matrix.thresholds.cost) || !Number.isFinite(matrix.thresholds.efficiency)) return undefined;
    const common = chartCommonOpts();
    const chartPoints = matrix.points.map((point) => ({
      x: point.cost,
      y: point.efficiency,
      r: bubbleRadius(matrix.points, point.results),
      name: point.name,
      action: point.action,
      results: point.results,
    }));
    const colors = matrix.points.map((point) => toneColor(actions[point.action].tone));
    const plugin = buildDecisionFieldPlugin({ thresholds: matrix.thresholds, positions, actions });

    chartRef.current?.destroy();
    chartRef.current = new Chart(canvasRef.current.getContext("2d"), {
      type: "bubble",
      data: {
        datasets: [{
          label: grainLabel,
          data: chartPoints,
          backgroundColor: colors,
          borderColor: colors,
          borderWidth: 1.5,
          hoverBorderWidth: 2.5,
        }],
      },
      plugins: [plugin],
      options: {
        ...common,
        layout: { padding: { top: 30, right: 72, bottom: 6, left: 4 } },
        plugins: {
          ...common.plugins,
          legend: { display: false },
          gopCrosshair: { enabled: false },
          tooltip: {
            ...common.plugins.tooltip,
            callbacks: {
              title: (items) => items[0]?.raw?.name || "",
              label: (context) => `${isEn ? "Cost" : "비용"}: ${fmtCurrencyPrecise(context.raw.x, currency)}`,
              afterLabel: (context) => [
                `${metricLabel}: ${formatMetric(context.raw.y, metric, currency, locale)}`,
                `${resultLabel}: ${Number(context.raw.results || 0).toLocaleString(isEn ? "en-US" : "ko-KR")}`,
                `${isEn ? "Action" : "행동"}: ${actions[context.raw.action].label}`,
              ],
            },
          },
        },
        scales: {
          x: {
            ...common.scales.x,
            type: "logarithmic",
            title: { display: true, text: isEn ? "Cost in analyzed period →" : "분석 기간 Cost →", color: CHART_THEME.muted },
            grid: { color: CHART_THEME.grid },
            ticks: {
              ...common.scales.x.ticks,
              callback: (value) => fmtCurrencyCompact(value, currency, locale),
            },
          },
          y: {
            ...common.scales.y,
            beginAtZero: true,
            title: {
              display: true,
              text: metric === "roas"
                ? (isEn ? "ROAS · higher is better ↑" : "ROAS · 높을수록 좋음 ↑")
                : (isEn ? "CPA · lower is better ↓" : "CPA · 낮을수록 좋음 ↓"),
              color: CHART_THEME.muted,
            },
            ticks: {
              ...common.scales.y.ticks,
              callback: (value) => formatMetric(Number(value), metric, currency, locale, true),
            },
          },
        },
        interaction: { mode: "nearest", intersect: false },
        hover: { mode: "nearest", intersect: false },
      },
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [matrix, actions, positions, metric, metricLabel, currency, locale, grainLabel, resultLabel, isEn, isDarkMode]);

  const visibleActions = ACTION_ORDER.filter((key) => actions[key]);
  const thresholdCopy = Number.isFinite(matrix.thresholds.cost) && Number.isFinite(matrix.thresholds.efficiency)
    ? (isEn
      ? `Reference lines: median cost ${fmtCurrencyCompact(matrix.thresholds.cost, currency, locale)} · blended ${metricLabel} ${formatMetric(matrix.thresholds.efficiency, metric, currency, locale)}`
      : `기준선: 비용 중앙값 ${fmtCurrencyCompact(matrix.thresholds.cost, currency, locale)} · 전체 가중 ${metricLabel} ${formatMetric(matrix.thresholds.efficiency, metric, currency, locale)}`)
    : "";

  return (
    <section className="block scale-decision-map" id="s-scale-map" aria-labelledby="scale-decision-map-title">
      <header className="scale-decision-map__head">
        <div>
          <span>{isEn ? "COST × EFFICIENCY" : "COST × 효율"}</span>
          <h2 className="section-title" id="scale-decision-map-title">
            {isEn ? `Where to act by ${grainLabel}` : `${grainLabel}별 증액·감액 우선순위`}
          </h2>
          <p>{isEn
            ? `Compare total cost with blended ${metricLabel}. Bubble size is actual ${resultLabel}; it is not an incremental-effect estimate.`
            : `총비용과 전체 가중 ${metricLabel}을 비교합니다. 거품 크기는 실제 ${resultLabel}이며 증분효과 추정치가 아닙니다.`}</p>
        </div>
        {matrix.points.length >= 2 && (
          <button type="button" className="ab-pill" onClick={() => downloadChartAsPNG(canvasRef.current, `scale_decision_${grain}_${metric}`)}>
            {isEn ? "↓ PNG" : "↓ PNG"}
          </button>
        )}
      </header>

      {matrix.points.length < 2 ? (
        <p className="muted scale-decision-map__empty">{isEn
          ? `At least two ${grainLabel}s with calculable ${metricLabel} are needed to draw relative quadrants.`
          : `${metricLabel}을 계산할 수 있는 ${grainLabel}이 2개 이상 있어야 상대 사분면을 그릴 수 있습니다.`}</p>
      ) : (
        <>
          <div className="scale-decision-map__plot">
            {Object.entries(positions).map(([position, action]) => (
              <span className={`scale-decision-map__quadrant is-${position}`} data-tone={actions[action].tone} key={position}>
                <strong>{actions[action].label}</strong>
                <small>{actions[action].detail}</small>
              </span>
            ))}
            <div className="chart-container scale-decision-map__canvas">
              <canvas
                ref={canvasRef}
                role="img"
                aria-label={isEn
                  ? `${grainLabel} cost and ${metricLabel} decision map with ${matrix.points.length} bubbles`
                  : `${grainLabel} Cost와 ${metricLabel} 의사결정 지도, 거품 ${matrix.points.length}개`}
              />
            </div>
          </div>
          <p className="scale-decision-map__threshold">{thresholdCopy}</p>
          <div className="scale-decision-map__actions" aria-label={isEn ? "Quadrant counts" : "사분면별 대상 수"}>
            {visibleActions.map((action) => (
              <div data-tone={actions[action].tone} key={action}>
                <span>{actions[action].label}</span>
                <strong>{actionCounts[action]}</strong>
                <small>{actions[action].detail}</small>
              </div>
            ))}
          </div>
          <p className="scale-decision-map__limit">{isEn
            ? "This map prioritizes review from observed cost and efficiency. Confirm marginal efficiency in the saturation analysis below before changing budget."
            : "이 지도는 관측 비용·효율로 검토 순서를 정합니다. 실제 예산 변경 전에는 아래 포화도 분석의 한계효율을 함께 확인하세요."}</p>
          <table className="sr-only">
            <caption>{isEn ? "Scale decision map data" : "증액·감액 우선순위 데이터"}</caption>
            <thead><tr><th>{grainLabel}</th><th>Cost</th><th>{metricLabel}</th><th>{isEn ? "Action" : "행동"}</th></tr></thead>
            <tbody>{matrix.points.map((point) => (
              <tr key={point.name}><th>{point.name}</th><td>{point.cost}</td><td>{point.efficiency}</td><td>{actions[point.action].label}</td></tr>
            ))}</tbody>
          </table>
        </>
      )}

      {matrix.excluded.length > 0 && (
        <p className="scale-decision-map__excluded">{isEn
          ? `${matrix.excluded.length} ${grainLabel}(s) with missing required values or an incalculable ${metricLabel} are excluded instead of assigning a false value.`
          : `필수 값이 누락됐거나 ${metricLabel}을 계산할 수 없는 ${grainLabel} ${matrix.excluded.length}개는 임의 값을 만들지 않고 차트에서 제외했습니다.`}</p>
      )}
    </section>
  );
}
