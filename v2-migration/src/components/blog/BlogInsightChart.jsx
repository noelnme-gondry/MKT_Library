"use client";
import { useEffect, useRef } from "react";
import { CHART_THEME, chartCommonOpts } from "@/utils/chartUtils";

export function blogChartSeries(visual, locale) {
  if (visual?.kind === "table" && visual.table?.rows?.length && visual.table.columns?.includes("action")) {
    const counts = new Map();
    for (const row of visual.table.rows) counts.set(row.action, (counts.get(row.action) || 0) + 1);
    return { labels: [...counts.keys()], values: [...counts.values()], label: locale === "en" ? "Search terms by proposed action" : "제안 행동별 검색어 수", type: "bar" };
  }
  if (visual?.data?.dates) return { labels: visual.data.dates, values: visual.data.overall, label: visual.question, type: "line" };
  if (!Array.isArray(visual?.data)) return null;
  if (visual.options?.variant === "period-comparison") return { labels: visual.data.map(row => row.label), values: visual.data.map(row => row.change == null ? null : row.change * 100), label: locale === "en" ? "Change (%)" : "변화율 (%)", type: "bar" };
  const { x, y } = visual.options || {};
  if (!x || !y) return null;
  if (visual.kind === "scatter") return { labels: visual.data.map(row => row[visual.options.label] ?? row[x]), values: visual.data.map(row => Number.isFinite(row[x]) && Number.isFinite(row[y]) ? { x: row[x], y: row[y] } : null), label: visual.question, type: "scatter" };
  return { labels: visual.data.map(row => row[x]), values: visual.data.map(row => typeof row[y] === "number" && Number.isFinite(row[y]) ? row[y] : null), label: visual.question, type: visual.kind === "line" ? "line" : "bar" };
}
export default function BlogInsightChart({ visual, locale }) {
  const ref = useRef(null);
  const series = blogChartSeries(visual, locale);
  useEffect(() => {
    if (!series) return;
    let chart, cancelled = false;
    import("chart.js/auto").then(({ default: Chart }) => {
      if (cancelled || !ref.current) return;
      chart = new Chart(ref.current, { type: series.type, data: { labels: series.labels, datasets: [{ label: series.label, data: series.values, backgroundColor: CHART_THEME.primary, borderColor: CHART_THEME.primary, spanGaps: false }] }, options: { ...chartCommonOpts(), responsive: true, maintainAspectRatio: false, animation: false } });
      requestAnimationFrame(() => { if (!cancelled) chart.resize(); });
    });
    return () => { cancelled = true; chart?.destroy(); };
  // The visualization object changes only after an explicit analysis run.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visual, locale]);
  if (!series) return null;
  return <figure><figcaption>{series.label}</figcaption><div className="chart-container"><canvas ref={ref} role="img" aria-label={series.label} /></div><details><summary>{locale === "en" ? "Chart values" : "차트 수치"}</summary><table><tbody>{series.labels.map((label, index) => <tr key={index}><th scope="row">{label}</th><td>{series.values[index] == null ? (locale === "en" ? "Not computable" : "계산 불가") : typeof series.values[index] === "object" ? `${series.values[index].x}, ${series.values[index].y}` : series.values[index]}</td></tr>)}</tbody></table></details></figure>;
}
