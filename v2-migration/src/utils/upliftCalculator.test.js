import { describe, expect, it } from "vitest";
import { calculateObservedUplift } from "./upliftCalculator";

const example = { treatmentUsers: 1000, treatmentConversions: 80, controlUsers: 1000, controlConversions: 50 };

describe("observed uplift arithmetic", () => {
  it("distinguishes percentage points from relative percent", () => {
    const result = calculateObservedUplift(example);
    expect(result.treatmentRate).toBe(0.08);
    expect(result.controlRate).toBe(0.05);
    expect(result.absoluteLift).toBeCloseTo(0.03, 14);
    expect(result.relativeLift).toBeCloseTo(0.6, 14);
  });

  it("uses each group's denominator and preserves negative or zero differences", () => {
    expect(calculateObservedUplift({ ...example, treatmentUsers: "2000", treatmentConversions: "50" })).toMatchObject({ absoluteLift: -0.025, relativeLift: -0.5 });
    expect(calculateObservedUplift({ ...example, treatmentUsers: 2000, treatmentConversions: 100 })).toMatchObject({ absoluteLift: 0, relativeLift: 0 });
    expect(calculateObservedUplift({ ...example, treatmentConversions: 0 }).relativeLift).toBe(-1);
  });

  it("retains absolute lift when a zero baseline makes relative lift undefined", () => {
    expect(calculateObservedUplift({ ...example, controlConversions: 0 })).toMatchObject({ absoluteLift: 0.08, relativeLift: null });
    expect(calculateObservedUplift({ ...example, treatmentConversions: 0, controlConversions: 0 })).toMatchObject({ absoluteLift: 0, relativeLift: null });
  });

  it.each(["", " ", null, undefined, true, [], NaN, Infinity, -1, 0.5, "x", Number.MAX_SAFE_INTEGER + 1])("rejects missing or invalid counts (%s)", (value) => {
    for (const key of Object.keys(example)) {
      expect(calculateObservedUplift({ ...example, [key]: value })).toBeNull();
    }
  });

  it("rejects empty groups and more converters than assigned participants", () => {
    expect(calculateObservedUplift()).toBeNull();
    for (const prefix of ["treatment", "control"]) {
      expect(calculateObservedUplift({ ...example, [`${prefix}Users`]: 0 })).toBeNull();
      expect(calculateObservedUplift({ ...example, [`${prefix}Conversions`]: 1001 })).toBeNull();
    }
  });
});
