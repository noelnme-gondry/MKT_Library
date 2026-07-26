import { describe, expect, it } from "vitest";
import { dateFilterSignature, isDateInFilter, normalizeDateFilter } from "./dateFilterContract";

describe("dateFilterContract", () => {
  it("normalizes valid ISO dates and defaults", () => {
    expect(normalizeDateFilter({ start: "2026-01-01", end: "2026-01-31", grain: "week" })).toEqual({
      start: "2026-01-01", end: "2026-01-31", startInclusive: true, endInclusive: true, grain: "week", timezone: "UTC",
    });
  });

  it("uses explicit inclusive boundaries", () => {
    const filter = { start: "2026-01-01", end: "2026-01-31" };
    expect(isDateInFilter("2026-01-01", filter)).toBe(true);
    expect(isDateInFilter("2026-01-31", filter)).toBe(true);
    expect(isDateInFilter("2025-12-31", filter)).toBe(false);
    expect(isDateInFilter("2026-01-01", { ...filter, startInclusive: false })).toBe(false);
  });

  it("creates a deterministic signature", () => {
    expect(dateFilterSignature({ start: "2026-01-01", end: "2026-01-31" })).toBe("2026-01-01|2026-01-31|1|1|raw|UTC");
  });
});
