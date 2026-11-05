import { describe, expect, it } from "vitest";
import { buildOperationsDemo } from "./operationsDemo";
import { getMappedRows } from "@/utils/dashboardAggregator";
import { dashboardPeriods } from "@/lib/analysis-results/dashboardPeriods";
import { prepareOperationsBrief, planOperationsBudget } from "./operationsBrief";
import { operationsPlanRange, planOperationsScenario } from "./operationsScenario";
import { operationCreativeContributions } from "./operationsPresentation";

const demo = buildOperationsDemo("ko");
const brief = prepareOperationsBrief({ rows: getMappedRows(demo), periods: dashboardPeriods(demo, {}, 7), metric: "installs", mappedFields: Object.values(demo.mapping) });
const baseline = planOperationsBudget(brief);

describe("operations budget scenarios", () => {
  it("preserves the existing same-budget solution and daily execution amounts", () => {
    const result = planOperationsScenario(brief);
    expect(result.ok).toBe(true);
    expect(result.totalBudget).toBeCloseTo(baseline.totalBudget, 7);
    expect(result.expectedResults).toBeCloseTo(baseline.expectedResults, 7);
    expect(result.items).toEqual(baseline.items);
    expect(result.horizonDays).toBe(7);
  });
  it.each(["increase", "decrease"])("funds the requested total without reversing the %s direction", mode => {
    const result = planOperationsScenario(brief, { mode, targetTotal: baseline.totalBudget * 7 * (mode === "increase" ? 1.1 : .9) });
    expect(result.ok).toBe(true);
    expect(result.items.reduce((sum, row) => sum + row.budget, 0)).toBeCloseTo(result.totalBudget, 6);
    for (const row of result.items) {
      if (mode === "increase") expect(row.budget).toBeGreaterThanOrEqual(row.current - 1e-6);
      else expect(row.budget).toBeLessThanOrEqual(row.current + 1e-6);
      expect(row.budget).toBeGreaterThanOrEqual(row.min - 1e-6);
      expect(row.budget).toBeLessThanOrEqual(row.max + 1e-6);
    }
    expect(result.expectedCpr).toBeCloseTo(result.totalBudget / result.expectedResults, 9);
  });
  it("uses actual calendar months, including leap years", () => {
    expect(operationsPlanRange("2028-01-31", "month")).toEqual({ start: "2028-02-01", end: "2028-02-29" });
    const range = operationsPlanRange("2026-10-06", "month");
    expect(range).toEqual({ start: "2026-11-01", end: "2026-11-30" });
    expect(planOperationsScenario(brief, { range }).horizonDays).toBe(30);
    expect(operationsPlanRange("wrong")).toEqual({ start: "", end: "" });
  });
  it("withholds impossible, wrong-direction and missing-evidence plans", () => {
    expect(planOperationsScenario(brief, { mode: "increase", targetTotal: 1e12 }).holds).toEqual([{ reason: "constraints" }]);
    expect(planOperationsScenario(brief, { mode: "increase", targetTotal: 1 }).holds).toEqual([{ reason: "direction" }]);
    expect(planOperationsScenario({ ...brief, budgetHolds: [{ reason: "confidence" }] }).items).toEqual([]);
    expect(planOperationsScenario(brief, { changeLimit: NaN }).ok).toBe(false);
  });
  it("does not cancel new and absent creative contributions into one zero", () => {
    const result = operationCreativeContributions({ finest: [
      { result1: 0, result2: 3, contribution: -5 }, { result1: 2, result2: 0, contribution: 5 },
      { result1: 2, result2: 3, mix: 1, rate: 4, contribution: 5 },
    ] });
    expect(result).toEqual({ share: 1, cost: 4, entered: -5, absent: 5, unattributed: 0 });
    for (const campaign of brief.campaigns) {
      const contributions = operationCreativeContributions(campaign.pvm);
      expect(Object.values(contributions).reduce((a, b) => a + b, 0)).toBeCloseTo(campaign.pvm.deltaCpa, 8);
    }
  });
});
