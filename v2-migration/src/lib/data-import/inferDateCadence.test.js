import { describe, expect, it } from "vitest";

import { inferDateCadence, inferMappedDateCadence } from "./inferDateCadence";

describe("inferDateCadence", () => {
  it("distinguishes daily, weekly, monthly, and irregular calendar inputs", () => {
    expect(inferDateCadence(["2026-08-01", "2026-08-02", "2026-08-03"]).cadence).toBe("daily");
    expect(inferDateCadence(["2026-08-03", "2026-08-10", "2026-08-17"]).cadence).toBe("weekly");
    expect(inferDateCadence(["2026-01-01", "2026-02-01", "2026-03-01"]).cadence).toBe("monthly");
    expect(inferDateCadence(["2026-01-01", "2026-01-12", "2026-02-18"]).cadence).toBe("irregular");
  });

  it("uses the user's mapped dt column instead of requiring a week header", () => {
    const result = inferMappedDateCadence({
      headers: ["dt", "spend"],
      mapping: { dt: "date", spend: "cost" },
      raw: [{ dt: "2026/08/01" }, { dt: "2026/08/02" }, { dt: "2026/08/03" }],
    });
    expect(result).toMatchObject({ cadence: "daily", intervalDays: 1, periodCount: 3, weeklyPeriodCount: 2, dateHeader: "dt" });
  });

  it("normalizes ISO week labels as weekly input", () => {
    expect(inferDateCadence(["2026-W30", "2026-W31", "2026-W32"]).cadence).toBe("weekly");
  });

  it("keeps numeric week indexes weekly instead of parsing them as calendar months", () => {
    expect(inferMappedDateCadence({
      headers: ["period"],
      mapping: { period: "week" },
      raw: [{ period: "1" }, { period: "2" }, { period: "3" }],
    })).toMatchObject({ cadence: "weekly", intervalDays: 7, periodCount: 3 });
  });
});
