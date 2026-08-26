import { describe, expect, it } from "vitest";
import { buildDatasetContinuitySnapshot, classifyDatasetContinuity, readDatasetContinuitySnapshot, serializeDatasetContinuitySnapshot } from "./dataContinuity";

function data(dates, cost = 100) {
  return { records: dates.map((date, index) => ({ date, metrics: { cost: cost + index, actions: 10 } })) };
}

function snapshot(dates, cost = 100) {
  return buildDatasetContinuitySnapshot(data(dates, cost), { dataGroup: "efficiency", mapping: { Date: "date", Cost: "cost" } });
}

describe("dataset continuity", () => {
  it("keeps only a safe local summary", () => {
    const value = snapshot(["2026-08-01", "2026-08-02"]);
    const serialized = serializeDatasetContinuitySnapshot(value);
    expect(readDatasetContinuitySnapshot(serialized)).toEqual(value);
    expect(serialized).not.toContain("100");
    expect(serialized).not.toContain("actions");
  });

  it.each([
    ["duplicate", ["2026-08-01", "2026-08-02"], 100, "duplicate"],
    ["revised closed period", ["2026-08-01", "2026-08-02"], 200, "revised_period"],
    ["next period", ["2026-08-03", "2026-08-04"], 100, "next_period"],
    ["gap", ["2026-08-05", "2026-08-06"], 100, "gap"],
    ["partial overlap", ["2026-08-02", "2026-08-03"], 100, "partial_overlap"],
    ["backfill", ["2026-07-30", "2026-07-31"], 100, "historical_backfill"],
  ])("classifies %s without blocking a new analysis", (_label, dates, cost, state) => {
    const result = classifyDatasetContinuity(snapshot(["2026-08-01", "2026-08-02"]), snapshot(dates, cost), { now: new Date("2026-08-20T00:00:00Z") });
    expect(result.state).toBe(state);
    expect(result.maturity).toBe("likely_closed");
  });

  it("does not call a recent period final", () => {
    const result = classifyDatasetContinuity(snapshot(["2026-08-01"]), snapshot(["2026-08-02"]), { now: new Date("2026-08-04T00:00:00Z") });
    expect(result.state).toBe("next_period");
    expect(result.maturity).toBe("provisional");
  });
});
