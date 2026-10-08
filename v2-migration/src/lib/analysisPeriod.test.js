import { describe, expect, it } from "vitest";
import { dateOrdinal, dateBounds, dateBoundProblem, periodDays, periodProblem, previousPeriod, comparisonWarnings } from "./analysisPeriod";

describe("independent analysis periods", () => {
  it("derives file-wide bounds independently of order and ignores invalid dates", () => {
    const bounds = dateBounds(["2024-03-01", "bad", " 2024-02-29 ", "2024-02-31", "2024-03-05T12:00:00Z", ""]);
    expect(bounds).toEqual({ minDate: "2024-02-29", maxDate: "2024-03-05" });
    expect(dateBounds([])).toEqual({ minDate: undefined, maxDate: undefined });
    expect(dateBoundProblem("2024-03-05", bounds)).toBeNull();
    expect(dateBoundProblem("2024-03-06", bounds)).toBe("bounds");
    expect(periodProblem({ start: "2024-02-28", end: "2024-03-02" }, bounds)).toBe("bounds");
    expect(periodProblem({ start: bounds.minDate, end: bounds.maxDate }, bounds)).toBeNull();
  });
  it("rejects missing, impossible and reversed dates", () => {
    for (const value of ["", "2025-02-29", "2024-02-30", "2024-13-01", "03/18/2024"]) expect(dateOrdinal(value)).toBeNull();
    expect(periodProblem({ start: "2024-03-24", end: "2024-03-18" })).toBe("order");
    expect(periodDays(null)).toBeNull();
    expect(dateOrdinal("1970-01-01")).toBe(0);
  });
  it("counts inclusive leap days and crosses year boundaries", () => {
    expect(periodDays({ start: "2024-02-28", end: "2024-03-01" })).toBe(3);
    expect(previousPeriod({ start: "2026-01-01", end: "2026-01-07" })).toEqual({ start: "2025-12-25", end: "2025-12-31" });
    expect(previousPeriod({ start: "2024-03-01", end: "2024-03-01" })).toEqual({ start: "2024-02-29", end: "2024-02-29" });
  });
  it.each(["ko", "en"])("%s: discloses overlap and unequal duration without changing either range", (locale) => {
    const current = { start: "2024-03-18", end: "2024-03-24" };
    const prior = { start: "2024-03-17", end: "2024-03-18" };
    const warnings = comparisonWarnings(current, prior, locale);
    expect(warnings).toHaveLength(2);
    expect(warnings[1]).toContain("7");
    expect(warnings[1]).toContain("2");
    expect(prior.end).toBe("2024-03-18");
    expect(comparisonWarnings(current, previousPeriod(current), locale)).toEqual([]);
  });
});
