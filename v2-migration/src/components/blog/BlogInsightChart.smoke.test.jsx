// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { blogChartSeries } from "./BlogInsightChart";
describe("one-chart projections of existing adapter results", () => {
  it("keeps missing VIF distinct from zero", () => {
    const series = blogChartSeries({ kind: "bar", options: { x: "entity", y: "vif" }, data: [{ entity: "A", vif: null }, { entity: "B", vif: Infinity }, { entity: "C", vif: 0 }] }, "en");
    expect(series.values).toEqual([null, null, 0]);
  });
  it("expresses fractional period changes as percent without inventing missing baselines", () => {
    const series = blogChartSeries({ options: { variant: "period-comparison" }, data: [{ label: "Cost", change: .2 }, { label: "Installs", change: null }] }, "en");
    expect(series.values).toEqual([20, null]);
    expect(series.label).toBe("Change (%)");
  });
  it("counts ASA recommendations without replacing them with fabricated performance", () => {
    const series = blogChartSeries({ kind: "table", table: { columns: ["action"], rows: [{ action: "hold" }, { action: "hold" }, { action: "lower" }] } }, "en");
    expect(series.values).toEqual([2, 1]);
    expect(series.labels).toEqual(["hold", "lower"]);
  });
});
