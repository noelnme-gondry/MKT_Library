import { describe, expect, it } from "vitest";
import { buildRecentPeriodComparison } from "./periodComparison";

describe("buildRecentPeriodComparison", () => {
  it("compares the most recent seven daily periods with the preceding seven", () => {
    const rows = Array.from({ length: 14 }, (_, index) => ({
      date: `2026-07-${String(index + 1).padStart(2, "0")}`,
      cost: String(100 + index * 10),
      installs: String(10 + index),
    }));

    const result = buildRecentPeriodComparison(rows);

    expect(result).toMatchObject({ available: true, cadence: "days", windowSize: 7 });
    expect(result.previous).toEqual({ start: "2026-07-01", end: "2026-07-07" });
    expect(result.recent).toEqual({ start: "2026-07-08", end: "2026-07-14" });
    expect(result.metrics.find((metric) => metric.key === "cost")).toMatchObject({ previous: 910, current: 1400, change: 490 });
    expect(result.metrics.find((metric) => metric.key === "installs")).toMatchObject({ previous: 91, current: 140, change: 49 });
  });

  it("withholds the comparison when fewer than four distinct dates exist", () => {
    expect(buildRecentPeriodComparison([
      { date: "2026-07-01", cost: "100" },
      { date: "2026-07-02", cost: "100" },
      { date: "2026-07-03", cost: "100" },
    ])).toMatchObject({ available: false, reason: "not_enough_periods", periodCount: 3 });
  });
});
