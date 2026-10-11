import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { drawPoint } from "chart.js/helpers";
import { OperationsTrend, OperationsCampaignChart, OperationsCreativeChart } from "./OperationsCharts";
const calls = vi.hoisted(() => []);
vi.mock("@/utils/chartGlobals", () => ({ default: class {
  constructor(_, config) { calls.push(config); }
  resize() {}
  destroy() {}
} }));
const periods = { previous: { start: "2026-10-01", end: "2026-10-07" }, current: { start: "2026-10-08", end: "2026-10-14" } };
const props = { periods, locale: "ko", currency: "KRW", metricName: "CPI", isDemo: true };
beforeEach(() => { calls.length = 0; });

// 반지름 비만 검사하면 서로 다른 도형의 실제 면적 왜곡을 놓친다.
// Chart.js가 그리는 원/다각형 경로에서 면적을 독립적으로 측정한다.
function drawnPointArea(dataset, point) {
  let circleArea = 0;
  const vertices = [];
  drawPoint({ beginPath() {}, closePath() {}, fill() {}, stroke() {},
    arc: (_x, _y, radius) => { circleArea = Math.PI * radius ** 2; },
    moveTo: (x, y) => vertices.push([x, y]), lineTo: (x, y) => vertices.push([x, y]),
  }, { pointStyle: dataset.pointStyle, radius: point.r, rotation: 0, borderWidth: 0 }, 0, 0);
  if (circleArea) return circleArea;
  return Math.abs(vertices.reduce((sum, [x, y], index) => {
    const next = vertices[(index + 1) % vertices.length];
    return sum + x * next[1] - y * next[0];
  }, 0)) / 2;
}

it("switches the visible trend metric to its actual daily values while preserving gaps", () => {
  render(<OperationsTrend {...props} rows={[
    { date: "2026-10-01", cost: 1000, results: 40, cpr: 25 },
    { date: "2026-10-02", cost: null, results: null, cpr: null },
    { date: "2026-10-03", cost: 600, results: 20, cpr: 30 },
  ]} />);
  expect(calls.at(-1).data.datasets[0].data).toEqual([25, null, 30]);
  fireEvent.click(screen.getByRole("radio", { name: "광고비", exact: true }));
  expect(calls.at(-1).data.datasets[0].data).toEqual([1000, null, 600]);
  expect(screen.getByRole("img", { name: "전체 일별 실측 광고비" })).toBeTruthy();
  fireEvent.click(screen.getByRole("radio", { name: "성과수", exact: true }));
  expect(calls.at(-1).data.datasets[0].data).toEqual([40, null, 20]);
  expect(calls.at(-1).data.datasets[0].spanGaps).toBe(false);
});

it("selects the correct campaign from a dot even when a prior value is missing", () => {
  const onSelect = vi.fn(), rows = [
    { id: "new", name: "New", context: "KR", previous: { cpr: null }, current: { cpr: 120 }, changePct: null },
    { id: "existing", name: "Existing", context: "KR", previous: { cpr: 100 }, current: { cpr: 80 }, changePct: -20 },
  ];
  render(<OperationsCampaignChart {...props} rows={rows} selected="new" onSelect={onSelect} />);
  const config = calls.at(-1);
  expect(config.data.datasets[0].data.map(({ x, id }) => ({ x, id }))).toEqual([{ x: 100, id: "existing" }]);
  config.options.onClick(null, [{ datasetIndex: 0, index: 0 }], { data: config.data });
  expect(onSelect).toHaveBeenLastCalledWith("existing");
  fireEvent.change(screen.getByRole("combobox", { name: "캠페인 선택" }), { target: { value: "new" } });
  expect(onSelect).toHaveBeenLastCalledWith("new");
});

it("keeps identical costs at their actual x value and distinguishes prior/recent within each campaign row", () => {
  const rows = [{ id: "same", name: "Unchanged", context: "KR", previous: { cpr: 100 }, current: { cpr: 100 }, changePct: 0 }];
  render(<OperationsCampaignChart {...props} rows={rows} selected="same" onSelect={vi.fn()} />);
  const config = calls.at(-1), prior = config.data.datasets[0].data[0], recent = config.data.datasets[1].data[0];
  expect(prior.x).toBe(100);
  expect(recent.x).toBe(100);
  expect(prior.y).toBeLessThan(0);
  expect(recent.y).toBeGreaterThan(0);
  expect(config.options.plugins.tooltip.callbacks.title([{ raw: recent }])).toBe("Unchanged");
  expect(config.options.scales.y.ticks.callback(0)).toContain("0.0%");
});

it("plots actual creative spend and cost, uses outcome-proportional area and excludes unavailable coordinates", () => {
  const onSelect = vi.fn(), rows = [
    { id: "a", creative: "A", campaign: "One", cost: 4000, cpr: 40, results: 100, isNew: true },
    { id: "b", creative: "B", campaign: "One", cost: 1000, cpr: 40, results: 25, isNew: false },
    { id: "missing", creative: "Missing", cost: 3000, cpr: null, results: 0, isNew: false },
  ];
  render(<OperationsCreativeChart {...props} rows={rows} selected="a" onSelect={onSelect} />);
  const config = calls.at(-1), a = config.data.datasets[0].data[0], b = config.data.datasets[1].data[0];
  expect([a.x, a.y]).toEqual([4000, 40]);
  expect(drawnPointArea(config.data.datasets[0], a) / drawnPointArea(config.data.datasets[1], b)).toBeCloseTo(a.row.results / b.row.results, 12);
  expect(config.data.datasets.flatMap(dataset => dataset.data)).toHaveLength(2);
  config.options.onClick(null, [{ datasetIndex: 1, index: 0 }], { data: config.data });
  expect(onSelect).toHaveBeenLastCalledWith("b");
});
