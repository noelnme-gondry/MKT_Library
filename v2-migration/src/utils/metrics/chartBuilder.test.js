import { describe, it, expect } from "vitest";
import { CHART_TYPES, groupAggByDim, buildChartSeries } from "./chartBuilder.js";
import { METRIC_BY_ID } from "./metricRegistry.js";

const rows = [
  { channel: "google", cost: "100", installs: "10", clicks: "50", impressions: "1000", revenue_d7: "200", pu_d7: "2" },
  { channel: "google", cost: "100", installs: "10", clicks: "50", impressions: "1000", revenue_d7: "0", pu_d7: "0" },
  { channel: "meta", cost: "300", installs: "20", clicks: "40", impressions: "2000", revenue_d7: "150", pu_d7: "3" },
  { channel: "", cost: "50", installs: "5", clicks: "10", impressions: "100", revenue_d7: "0", pu_d7: "0" },
];

describe("chartBuilder · groupAggByDim", () => {
  it("차원값별 base 합산 + denom/코호트 해석", () => {
    const g = groupAggByDim(rows, "channel", 7, "installs");
    const google = g.find((x) => x.key === "google");
    expect(google.agg.cost).toBe(200);
    expect(google.agg.installs).toBe(20);
    expect(google.agg.revenue).toBe(200);
    expect(google.agg.denom).toBe(20); // installs 기준
  });
  it("빈 차원값은 (없음)으로", () => {
    const g = groupAggByDim(rows, "channel");
    expect(g.find((x) => x.key === "(없음)").agg.cost).toBe(50);
  });
  it("denomBasis=actions면 denom=actions", () => {
    const r2 = [{ channel: "x", cost: "10", installs: "5", actions: "3" }];
    expect(groupAggByDim(r2, "channel", 7, "actions")[0].agg.denom).toBe(3);
  });
});

describe("chartBuilder · buildChartSeries", () => {
  const groups = groupAggByDim(rows, "channel", 7, "installs");
  it("base 지표(cost) 시리즈 — 내림차순", () => {
    const s = buildChartSeries(groups, METRIC_BY_ID.cost.compute);
    expect(s.labels[0]).toBe("meta"); // cost 300 최대
    expect(s.values[0]).toBe(300);
  });
  it("파생 지표(cpi) 시리즈", () => {
    const s = buildChartSeries(groups, METRIC_BY_ID.cpi.compute, { sortDesc: false });
    const gi = s.labels.indexOf("google");
    expect(s.values[gi]).toBe(200 / 20); // cost/installs
  });
  it("값 null(분모0 등) 제외", () => {
    const compute = (a) => (a.clicks ? a.cost / a.clicks : null);
    const s = buildChartSeries([{ key: "z", agg: { cost: 5, clicks: 0 } }, ...groups], compute);
    expect(s.labels).not.toContain("z");
  });
  it("topN 제한", () => {
    const s = buildChartSeries(groups, METRIC_BY_ID.cost.compute, { topN: 1 });
    expect(s.labels).toHaveLength(1);
  });
  it("CHART_TYPES 5종", () => {
    expect(CHART_TYPES.map((t) => t.id)).toEqual(["bar", "hbar", "line", "pie", "doughnut"]);
  });
});
