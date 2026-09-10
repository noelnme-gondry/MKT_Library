import { CHART_THEME, chartCommonOpts, getCssVar } from "@/utils/chartUtils";
// An isolated canvas draws only the sample payload; never capture page/user charts.
export async function addSampleChartImage(payload) {
  const chart = payload.charts[0];
  const { Chart, registerables } = await import("chart.js");
  Chart.register(...registerables);
  const canvas = document.createElement("canvas");
  canvas.width = 1200; canvas.height = 640;
  const theme = chartCommonOpts();
  const ink = CHART_THEME.textPrimary;
  const paper = getCssVar("--bg-1") || "white";
  const instance = new Chart(canvas, {
    type: "bar",
    data: { labels: chart.labels, datasets: chart.series.map((series, index) => ({ label: series.label, data: series.values.map(point => point.y), backgroundColor: index ? CHART_THEME.primary : CHART_THEME.muted })) },
    options: { ...theme, responsive: false, animation: false, indexAxis: "y", plugins: { title: { display: true, text: chart.title, color: ink, font: { size: 24 } }, legend: { labels: { color: ink, font: { size: 18 } } } }, scales: { x: { beginAtZero: true, ticks: { color: ink, font: { size: 16 } } }, y: { ticks: { color: ink, font: { size: 18 } } } } },
    plugins: [{ id: "paper", beforeDraw: ({ ctx, width, height }) => { ctx.save(); ctx.globalCompositeOperation = "destination-over"; ctx.fillStyle = paper; ctx.fillRect(0, 0, width, height); ctx.restore(); } }],
  });
  try { chart.image = canvas.toDataURL("image/png"); chart.width = canvas.width; chart.height = canvas.height; }
  finally { instance.destroy(); }
  return payload;
}
