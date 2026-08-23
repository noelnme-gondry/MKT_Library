import { describe, expect, it } from "vitest";

import { buildNaturalExperimentHandoff, detectBudgetInterruptionCandidates } from "./detectBudgetInterruptionCandidates";

function record(date, channel, cost, installs = 10) {
  return { date, dimensions: { channel }, metrics: { cost, installs, impressions: 100, clicks: 10 } };
}

describe("budget interruption candidates", () => {
  it("detects a sustained budget reduction deterministically without calling it a holdout", () => {
    const records = [
      record("2026-01-01", "Meta", 100), record("2026-01-02", "Meta", 100), record("2026-01-03", "Meta", 100), record("2026-01-04", "Meta", 100),
      record("2026-01-05", "Meta", 10), record("2026-01-06", "Meta", 10), record("2026-01-07", "Meta", 10),
      record("2026-01-01", "Google", 120), record("2026-01-02", "Google", 120), record("2026-01-03", "Google", 120), record("2026-01-04", "Google", 120),
      record("2026-01-05", "Google", 120), record("2026-01-06", "Google", 120), record("2026-01-07", "Google", 120),
    ];
    const result = detectBudgetInterruptionCandidates({ records, unitKeys: ["channel"] });
    expect(result.candidates).toEqual([expect.objectContaining({ unit: "Meta", startDate: "2026-01-05", duration: 3, cadence: "daily" })]);
    expect(result.candidates[0].dropFraction).toBeCloseTo(0.9);
    expect(JSON.stringify(result.candidates)).not.toMatch(/holdout/i);
  });

  it("blocks likely export gaps and market-wide contractions", () => {
    const exportGap = Array.from({ length: 7 }, (_, index) => {
      const item = record(`2026-02-0${index + 1}`, "Meta", index < 4 ? 100 : 0, index < 4 ? 10 : 0);
      if (index >= 4) item.metrics = { cost: 0, installs: 0, impressions: 0, clicks: 0 };
      return item;
    });
    const missing = detectBudgetInterruptionCandidates({ records: exportGap, unitKeys: ["channel"] });
    expect(missing.candidates).toHaveLength(0);
    expect(missing.excluded).toContainEqual(expect.objectContaining({ code: "tracking_or_export_gap" }));

    const broad = ["Meta", "Google"].flatMap((channel) => Array.from({ length: 7 }, (_, index) => record(`2026-03-0${index + 1}`, channel, index < 4 ? 100 : 10)));
    const broadResult = detectBudgetInterruptionCandidates({ records: broad, unitKeys: ["channel"] });
    expect(broadResult.candidates).toHaveLength(0);
    expect(broadResult.excluded.some((item) => item.code === "whole_market_decline")).toBe(true);
  });

  it("requires factual confirmation before routing a candidate to an existing method", () => {
    const candidate = { unit: "Meta", startDate: "2026-01-05" };
    expect(buildNaturalExperimentHandoff({ candidate })).toEqual(expect.objectContaining({ status: "confirm_design" }));
    expect(buildNaturalExperimentHandoff({ candidate, confirmation: { actualInterruption: true, outcomeKey: "installs", treatmentUnit: "Meta", startDate: "2026-01-05", controlUnit: "Google" } })).toEqual(expect.objectContaining({ targetToolId: "5-23", requiresParallelTrendCheck: true }));
  });
});
