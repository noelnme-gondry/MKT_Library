import { describe, expect, it } from "vitest";
import { allocationDistribution, allocationEfficiency, allocationScenarioView } from "./allocationPresentation";

describe("allocation display comparisons", () => {
  it("distinguishes less spend from better unit efficiency", () => {
    expect(allocationEfficiency(1000, 100, 500, 25, "installs")).toMatchObject({ current: 10, next: 20, improvementPct: -100, label: "CPI" });
    expect(allocationEfficiency(1000, 100, 1500, 300, "actions")).toMatchObject({ current: 10, next: 5, improvementPct: 50, label: "CPA" });
  });
  it("uses revenue/cost for ROAS and leaves undefined efficiency unavailable", () => {
    expect(allocationEfficiency(1000, 2000, 500, 1500, "revenue_d7")).toMatchObject({ current: 2, next: 3, improvementPct: 50 });
    expect(allocationEfficiency(0, 0, 0, 0, "installs").next).toBeNull();
    expect(allocationEfficiency(10, 0, 20, 2, "installs").improvementPct).toBeNull();
    expect(allocationEfficiency(10, null, 20, 2, "installs").current).toBeNull();
  });
  it("aggregates explicit channel identities and recomputes both share denominators", () => {
    const rows = allocationDistribution([{ entity: "a", group: "Meta · custom", current: 60, next: 20 }, { entity: "b", group: "Meta · custom", current: 20, next: 30 }, { entity: "c", group: "Google", current: 20, next: 150 }]);
    expect(rows).toEqual([{ entity: "Google", current: 20, next: 150, currentShare: 20, nextShare: 75 }, { entity: "Meta · custom", current: 80, next: 50, currentShare: 80, nextShare: 25 }]);
    expect(allocationDistribution([{ entity: "zero", current: 0, next: 0 }])[0].nextShare).toBeNull();
  });
});

// A country view must preserve the optimizer's global-budget solution.
it("projects scenario subtotals without moving the omitted countries’ budget", () => {
  const scenarios = [{ m: 1, budget: 500, totCost: 400, totResults: 50, avgCpr: 8, items: [{ channel: "a", cost: 100, results: 20 }, { channel: "b", cost: 300, results: 30 }] }];
  expect(allocationScenarioView(scenarios, new Set(["a"]))[0]).toMatchObject({ budget: 500, totCost: 100, totResults: 20, avgCpr: 5 });
  expect(allocationScenarioView(scenarios, new Set(["b"]))[0].totCost).toBe(300);
  expect(allocationScenarioView(scenarios, null)).toBe(scenarios);
  expect(allocationScenarioView(scenarios, new Set())).toEqual([]);
  expect(scenarios[0].totCost).toBe(400);
});
