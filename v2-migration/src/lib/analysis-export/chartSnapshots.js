/** Capture only visible charts from the current analysis, at the user's export action. */
export async function captureAnalysisCharts() {
  if (typeof document === "undefined") return [];
  const { Chart } = await import("chart.js");
  return [...document.querySelectorAll("main canvas, #content canvas")].filter(canvas => canvas.getClientRects().length && canvas.width && canvas.height).flatMap(canvas => {
    const chart = Chart.getChart(canvas);
    if (!chart) return [];
    const labels = (chart.data.labels || []).map(String);
    const series = chart.data.datasets.filter((_, index) => chart.isDatasetVisible(index)).map(dataset => ({
      label: String(dataset.label || "Series"),
      type: dataset.type || chart.config.type,
      axis: dataset.yAxisID || "y",
      values: dataset.data.map((point, index) => ({
        x: typeof point === "object" && point !== null ? point.x : index,
        y: typeof point === "object" && point !== null ? point.y : point,
      })).map(point => ({ x: typeof point.x === "number" && Number.isFinite(point.x) ? point.x : String(point.x ?? ""), y: typeof point.y === "number" && Number.isFinite(point.y) ? point.y : null })),
    }));
    const image = document.createElement("canvas"); image.width = canvas.width; image.height = canvas.height;
    const context = image.getContext("2d");
    if (!context) return [];
    context.fillStyle = getComputedStyle(document.body).getPropertyValue("--surface-base").trim() || "#ffffff";
    context.fillRect(0, 0, image.width, image.height); context.drawImage(canvas, 0, 0);
    return [{ title: String(chart.options.plugins?.title?.text || canvas.getAttribute("aria-label") || series[0]?.label || "Chart"), type: chart.config.type, labels, series, image: image.toDataURL("image/png"), width: image.width, height: image.height }];
  });
}
