"use client";
import { useEffect, useRef } from "react";
import Chart from "@/utils/chartGlobals";
import { CHART_THEME, chartCommonOpts, getCssVar } from "@/utils/chartUtils";
import { fmtCurrency, fmtNum } from "@/utils/format";

export default function OperationsHomeTrend({ campaign, rows, periods, probeDate, onProbeDate, isVisible, locale }) {
  const canvas = useRef(null), chartRef = useRef(null), activeRef = useRef(0);
  const en = locale === "en";
  const found = rows.findIndex(row => row.date === probeDate);
  const activeIndex = found < 0 ? rows.length - 1 : found;
  const point = rows[activeIndex];

  useEffect(() => {
    activeRef.current = activeIndex;
    if (chartRef.current) chartRef.current.draw();
  }, [activeIndex]);

  useEffect(() => {
    if (!isVisible || !rows.length || !canvas.current) return undefined;
    const context = canvas.current.getContext("2d");
    if (!context) return undefined;
    const draw = () => {
      if (chartRef.current) chartRef.current.destroy();
      const opts = chartCommonOpts();
      const upper = Math.ceil(Math.max(1, campaign.previous.cpr ?? 0, ...rows.map(row => row.cpr ?? 0)) / 500) * 500;
      const font = { family: getCssVar("--font-heading") || opts.scales.x.ticks.font.family, size: 12 };
      const recentColor = CHART_THEME.primary;
      const chart = new Chart(context, {
        type: "line",
        data: { labels: rows.map(row => row.date), datasets: [
          { label: en ? "Observed daily CPI" : "일별 실측 CPI", data: rows.map(row => row.cpr), borderColor: CHART_THEME.primary,
            backgroundColor: CHART_THEME.primary, borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 5, spanGaps: false,
            segment: { borderColor: ctx => rows[ctx.p1DataIndex].date >= periods.current.start ? recentColor : CHART_THEME.primary } },
          { label: en ? "Prior 7-day CPI" : "직전 7일 CPI", data: rows.map(() => campaign.previous.cpr), borderColor: CHART_THEME.comparison,
            borderWidth: 1, borderDash: [5, 5], pointRadius: 0, pointHoverRadius: 0 },
        ] },
        plugins: [{ id: "home-operations-periods", beforeDatasetsDraw(instance) {
          const { ctx, chartArea, scales: { x } } = instance;
          for (const [range, recent] of [[periods.previous, false], [periods.current, true]]) {
            const first = rows.findIndex(row => row.date >= range.start && row.date <= range.end);
            const last = rows.findLastIndex(row => row.date >= range.start && row.date <= range.end);
            if (first < 0) continue;
            const half = rows.length > 1 ? (x.getPixelForValue(1) - x.getPixelForValue(0)) / 2 : 0;
            const left = Math.max(chartArea.left, x.getPixelForValue(first) - half);
            const right = Math.min(chartArea.right, x.getPixelForValue(last) + half), height = chartArea.bottom - chartArea.top;
            ctx.save(); ctx.beginPath(); ctx.rect(left, chartArea.top, right - left, height); ctx.clip();
            if (recent) {
              ctx.globalAlpha = 0.07; ctx.fillStyle = CHART_THEME.primary; ctx.fillRect(left, chartArea.top, right - left, height);
            } else {
              ctx.globalAlpha = 0.25; ctx.strokeStyle = CHART_THEME.muted;
              for (let diagonal = left - height; diagonal < right; diagonal += 10) {
                ctx.beginPath(); ctx.moveTo(diagonal, chartArea.bottom); ctx.lineTo(diagonal + height, chartArea.top); ctx.stroke();
              }
            }
            ctx.restore(); ctx.save(); ctx.strokeStyle = recent ? CHART_THEME.primary : CHART_THEME.muted;
            ctx.lineWidth = recent ? 2 : 1; ctx.setLineDash(recent ? [] : [4, 4]);
            ctx.strokeRect(left, chartArea.top, right - left, height); ctx.restore();
          }
        }, afterDatasetsDraw(instance) {
          const element = instance.getDatasetMeta(0).data[activeRef.current];
          if (!element || rows[activeRef.current]?.cpr == null) return;
          const { ctx, chartArea } = instance;
          ctx.save(); ctx.strokeStyle = CHART_THEME.muted; ctx.setLineDash([3, 4]); ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(element.x, chartArea.top); ctx.lineTo(element.x, chartArea.bottom); ctx.stroke();
          ctx.setLineDash([]); ctx.fillStyle = rows[activeRef.current].date >= periods.current.start ? recentColor : CHART_THEME.primary;
          ctx.beginPath(); ctx.arc(element.x, element.y, 5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        } }],
        options: { ...opts, animation: false,
          onHover: (_, elements) => { if (elements.length) onProbeDate(rows[elements[0].index].date); },
          plugins: { ...opts.plugins, legend: { display: false }, tooltip: { ...opts.plugins.tooltip, callbacks: {
            label: item => `${item.dataset.label} ${fmtCurrency(item.parsed.y, { currency: "KRW" })}`,
            footer: items => { const row = rows[items[0].dataIndex]; return `${en ? "Spend" : "광고비"} ${fmtCurrency(row.cost, { currency: "KRW" })} · ${fmtNum(row.results)} ${en ? "installs" : "건 설치"}`; },
          } } },
          scales: { x: { ...opts.scales.x, ticks: { ...opts.scales.x.ticks, font, maxTicksLimit: 5, callback: value => rows[Number(value)].date.slice(5).replace("-", ".") } },
            y: { ...opts.scales.y, beginAtZero: true, max: upper, title: { display: true, text: "CPI (₩)", color: CHART_THEME.muted, font }, ticks: { ...opts.scales.y.ticks, font, maxTicksLimit: 5, callback: value => fmtNum(value) } } },
        },
      });
      chartRef.current = chart;
      canvas.current.dataset.chartReady = "true";
    };
    draw();
    const frame = requestAnimationFrame(() => chartRef.current.resize());
    const theme = new MutationObserver(draw);
    theme.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    return () => { theme.disconnect(); cancelAnimationFrame(frame); chartRef.current.destroy(); chartRef.current = null; };
  }, [rows, campaign, periods, isVisible, en, onProbeDate]);

  if (!point) return <p role="status">{en ? "No daily observations are available." : "확인할 일별 관측이 없습니다."}</p>;
  return <div className="home-operations-trend">
    <div className="chart-container"><canvas ref={canvas} role="img" aria-label={en ? `${campaign.name} observed daily CPI trend` : `${campaign.name} 일별 실측 CPI 추세`}
      data-point-count={rows.length} data-range-start={rows[0].date} data-range-end={rows.at(-1).date} /></div>
  </div>;
}
