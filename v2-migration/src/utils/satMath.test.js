import { describe, expect, it } from "vitest";
import { SAT_MATH } from "./satMath";

describe("saturation observed-range guard", () => {
  it("uses a left derivative at the observed maximum without extrapolating", () => {
    const points = [100, 200, 300, 400].map((cost, index) => ({
      x: cost,
      y: 10,
      date: `2026-01-0${index + 1}`,
    }));
    const result = SAT_MATH.analyzeEntity(points, {
      minPoints: 4,
      recentDays: 0,
      deltaPct: 0.1,
      satHigh: 1.3,
      scaleLow: 0.85,
    });

    expect(result.ok).toBe(true);
    expect(result.marginalCpr).toBeCloseTo(10, 12);
  });
});
