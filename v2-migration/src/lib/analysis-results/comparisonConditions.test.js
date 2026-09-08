import { describe, it, expect } from "vitest";
import { buildPaidOrganicTrend } from "@/utils/paidOrganicTrend";
import { comparisonConditionsReady, comparisonConditionsTable } from "./comparisonConditions";

describe("observational comparison counterexamples", () => {
  it("cannot distinguish reclassification from paid growth using identical totals", () => {
    // World A: 1000 true organic + 300 true paid, with 35 organic outcomes
    // reclassified as paid each week. World B: actual paid growth replaces
    // the same number of organic outcomes. The exported observations coincide.
    const start = Date.UTC(2026, 1, 2);
    const exportRows = Array.from({ length: 8 }, (_, i) => ({ week: new Date(start + i * 7 * 86400000).toISOString().slice(0, 10), total: 1300, paid: 300 + i * 35 }));
    const mapping = { date: "week", total: "total", paid: "paid", organic: "" };
    const trackingChange = buildPaidOrganicTrend(exportRows, mapping);
    const actualPaidGrowth = buildPaidOrganicTrend(exportRows.map((row) => ({ ...row })), mapping);
    expect(trackingChange).toEqual(actualPaidGrowth);
    expect(trackingChange.verdict).toBe("watch");
    expect(comparisonConditionsReady({ tracking: "changed", seasonality: "reviewed", delivery: "continuous" })).toBe(false);
    expect(comparisonConditionsReady({ tracking: "consistent", seasonality: "changed", delivery: "continuous" })).toBe(false);
    expect(comparisonConditionsReady({ tracking: "consistent", seasonality: "reviewed", delivery: "interrupted" })).toBe(false);
    expect(comparisonConditionsReady({})).toBe(false);
  });
  it("exports declarations without treating them as causal identification", () => {
    const declared = { tracking: "consistent", seasonality: "reviewed", delivery: "continuous" };
    expect(comparisonConditionsReady(declared)).toBe(true);
    expect(comparisonConditionsTable(declared).title).toContain("not causal identification");
    expect(comparisonConditionsTable(declared).rows).toContainEqual(["tracking", "consistent"]);
  });
});
