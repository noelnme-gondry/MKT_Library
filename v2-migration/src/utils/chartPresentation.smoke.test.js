// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { applyChartPresentation } from "./chartPresentation";
import { CHART_FONT_STACK, CHART_THEME, refreshMountedChartThemes } from "./chartUtils";

afterEach(() => { document.body.removeAttribute("style"); });

describe("shared chart presentation", () => {
  it("keeps scriptable zero-line emphasis during presentation and theme updates", () => {
    const color = context => context.tick.value === 0 ? "zero-line" : CHART_THEME.grid;
    const lineWidth = context => context.tick.value === 0 ? 2.2 : 1;
    const grid = { color, lineWidth };
    const chart = { config: { type: "scatter", options: { scales: { y: { grid } } } }, options: { scales: { y: { grid } } }, data: { datasets: [] }, update() {} };
    applyChartPresentation(chart);
    refreshMountedChartThemes({ instances: { one: chart } });
    expect(grid.color).toBe(color);
    expect(grid.lineWidth).toBe(lineWidth);
    expect(grid.lineWidth({ tick: { value: 0 } })).toBeGreaterThan(grid.lineWidth({ tick: { value: 1 } }));
  });

  it("reaches replaced scales while preserving scientific values and callbacks", () => {
    const data = [{ x: 10, y: 2, r: 9 }, { x: 20, y: null, r: 18 }];
    const format = value => `${value}%`;
    const chart = { config: { type: "bubble" }, data: { datasets: [{ data, pointRadius: 7 }] }, options: {
      plugins: { legend: { display: false, labels: { font: { family: "other", size: 9 } } } },
      scales: { x: { min: -4, max: 24, ticks: { callback: format, font: { family: "other", size: 10 } }, grid: { display: false } }, y: { type: "logarithmic", title: { text: "CPI · KRW", display: true }, ticks: { font: { size: 8 } } } },
    } };
    const before = structuredClone(chart.data);
    applyChartPresentation(chart);
    expect(chart.data).toEqual(before);
    expect(chart.options.scales.x).toMatchObject({ min: -4, max: 24, grid: { display: false }, ticks: { callback: format, font: { family: CHART_FONT_STACK, size: 12 } } });
    expect(chart.options.scales.y.type).toBe("logarithmic");
    expect(chart.options.scales.y.title.text).toBe("CPI · KRW");
    expect(chart.options.plugins.legend.display).toBe(false);
  });

  it("keeps stepped survival lines, interval fills and custom palette choices", () => {
    const chart = { config: { type: "line" }, options: { plugins: {} }, data: { datasets: [
      { data: [1,.7,.4], stepped: "after", borderWidth: 4, borderColor: "custom-choice", pointRadius: 0, fill: false },
      { data: [1,.8,.6], fill: "-1", borderWidth: 0, backgroundColor: "interval-choice" },
    ] } };
    applyChartPresentation(chart);
    expect(chart.data.datasets[0]).toMatchObject({ stepped: "after", borderWidth: 4, borderColor: "custom-choice", pointRadius: 0, fill: false });
    expect(chart.data.datasets[1]).toMatchObject({ fill: "-1", borderWidth: 0, backgroundColor: "interval-choice" });
  });

  it("sets distinct defaults for bars and circular charts without adding cartesian scales", () => {
    const bar = { config: { type: "bar" }, options: {}, data: { datasets: [{ data: [[40,55]], maxBarThickness: 52 }] } };
    applyChartPresentation(bar);
    expect(bar.data.datasets[0].data).toEqual([[40,55]]);
    expect(bar.data.datasets[0].maxBarThickness).toBe(52);
    expect(bar.data.datasets[0].borderRadius).toBeGreaterThan(0);
    const circle = { config: { type: "doughnut" }, options: { cutout: "70%" }, data: { datasets: [{ data: [40,60] }] } };
    applyChartPresentation(circle);
    expect(circle.options.scales).toBeUndefined();
    expect(circle.options.cutout).toBe("70%");
  });

  it("distinguishes multiple lines without changing chosen dashes or interval geometry", () => {
    const chart = { config: { type: "line" }, options: {}, data: { datasets: [
      { data: [1,2], borderDash: [11,2], fill: false },
      { data: [2,3], fill: false },
      { data: [3,4], fill: "-1", borderWidth: 0 },
      { data: [4,5], fill: false },
    ] } };
    applyChartPresentation(chart);
    expect(chart.data.datasets[0].borderDash).toEqual([11,2]);
    expect(chart.data.datasets[1].borderDash).not.toEqual(chart.data.datasets[3].borderDash);
    expect(chart.data.datasets[2].borderDash).toBeUndefined();
    expect(chart.data.datasets[2].fill).toBe("-1");
    expect(chart.data.datasets.map(item=>item.data)).toEqual([[1,2],[2,3],[3,4],[4,5]]);
  });

  it("updates both category palettes and preserves band transparency on theme changes", () => {
    document.body.style.setProperty("--chart-category-3-light", "#7392eb");
    document.body.style.setProperty("--chart-category-3-dark", "#5b7fca");
    document.body.style.setProperty("--chart-category-3", "#5b7fca");
    const update = () => {};
    const chart = { options: {}, data: { datasets: [{ borderColor: "#7392eb", backgroundColor: "#7392eb26" }] }, update };
    refreshMountedChartThemes({ instances: { one: chart } });
    expect(chart.data.datasets[0]).toMatchObject({ borderColor: CHART_THEME.colors[2], backgroundColor: `${CHART_THEME.colors[2]}26` });
  });

  it("resolves a memoized light palette when a chart is created after switching to dark", () => {
    document.body.style.setProperty("--chart-category-1-light", "#3146d8");
    document.body.style.setProperty("--chart-category-1-dark", "#8fb1ff");
    document.body.style.setProperty("--chart-category-1", "#8fb1ff");
    document.body.style.setProperty("--chart-primary", "#8fb1ff");
    const chart = { config: { type: "bar" }, options: {}, data: { datasets: [{ data: [10,20], backgroundColor: "#3146d8" }] } };
    applyChartPresentation(chart);
    expect(chart.data.datasets[0].backgroundColor).toBe(CHART_THEME.primary);
    expect(chart.data.datasets[0].data).toEqual([10,20]);
  });

  it("preserves status roles across theme changes even when their light colors changed", () => {
    document.body.style.setProperty("--success", "#0c765f");
    document.body.style.setProperty("--danger", "#c73737");
    const chart = { config: { type: "line" }, options: {}, data: { datasets: [{ borderColor: CHART_THEME.success, backgroundColor: `${CHART_THEME.danger}26` }] }, update() {} };
    applyChartPresentation(chart);
    document.body.style.setProperty("--success", "#65d3b3");
    document.body.style.setProperty("--danger", "#ff8178");
    refreshMountedChartThemes({ instances: { one: chart } });
    expect(chart.data.datasets[0].borderColor).toBe(CHART_THEME.success);
    expect(chart.data.datasets[0].backgroundColor).toBe(`${CHART_THEME.danger}26`);
  });
});
