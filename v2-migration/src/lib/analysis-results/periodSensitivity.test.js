// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { splitObservationPeriods, comparePeriodDirections, saturationPeriodSensitivity, periodSensitivityCsv } from "./periodSensitivity";
import { allocationPeriodSensitivity } from "@/components/tools/BudgetAllocation";

const rows = Array.from({ length: 16 }, (_, index) => ({ date: `2026-08-${String(index + 1).padStart(2, "0")}`, channel: "A", cost: 1000 + (index % 8) * 100, installs: (1000 + (index % 8) * 100) / 10 }));
describe("period sensitivity evidence", () => {
  it("keeps halves chronological and disjoint, excluding undated rows", () => {
    const periods = splitObservationPeriods([...rows, { date: "invalid" }]);
    expect(periods.map((period) => period.rows.length)).toEqual([8, 8]);
    expect(periods[0].end).toBe("2026-08-08");
    expect(periods[1].start).toBe("2026-08-09");
  });
  it("does not call missing or non-overlapping evidence stable", () => {
    const before = new Map([["A", { direction: "scale", min: 10, max: 20 }], ["B", { direction: "scale", min: 1, max: 4 }]]);
    const after = new Map([["A", { direction: "scale", min: 21, max: 30 }]]);
    expect(comparePeriodDirections(before, after).map((row) => row.status)).toEqual(["unavailable", "unavailable"]);
    after.set("A", { direction: "saturated", min: 10, max: 20 });
    expect(comparePeriodDirections(before, after)[0].status).toBe("changed");
  });
  it("reruns actual saturation fits and exports their observed ranges", () => {
    const result = saturationPeriodSensitivity(rows, { grain: "channel", metricField: "installs", metric: "cpa" });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ status: "stable", before: { direction: "linear", n: 8, min: 1000, max: 1700 }, after: { direction: "linear", n: 8 } });
    expect(periodSensitivityCsv(result)).toContain("A,stable,2026-08-01,2026-08-08,2026-08-09,2026-08-16");
    const sparse = saturationPeriodSensitivity(rows.slice(0, 4), { grain: "channel", metricField: "installs", metric: "cpa" });
    expect(sparse.rows[0].status).toBe("unavailable");
  });
  it.each(["b", "c"])("reruns actual allocation at a fixed budget and withholds infeasible constraints (%s)", (allocMode) => {
    const settings = { unitField: "channel", effectiveMetric: "installs", adv: { trendType: "linear", outlierMethod: "none" }, groupModels: {}, recentDays: 8, holdLowConfidence: false, plannedDailyBudget: 1500, allocMode, currency: "KRW" };
    const result = allocationPeriodSensitivity(rows, settings);
    expect(result.rows[0]).toMatchObject({ status: "stable", before: { direction: "increase" }, after: { direction: "increase" } });
    expect(allocationPeriodSensitivity(rows, { ...settings, plannedDailyBudget: 5000 }).rows[0].status).toBe("unavailable");
    const missing = rows.map((row, index) => index < 8 ? row : { ...row, channel: "B" });
    expect(allocationPeriodSensitivity(missing, settings).rows.every((row) => row.status === "unavailable")).toBe(true);
  });
});
