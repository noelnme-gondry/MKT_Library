import { describe, expect, it } from "vitest";
import { calculateAllocationModeB } from "./budgetAllocTool";

describe("budget allocation constrained prediction", () => {
  it("uses the same safe curve bound for a locked manual scenario", () => {
    // ∩ shape: the observed response peaks at cost=5. A manual value of 8 must
    // not revive the declining side of the quadratic and claim false results.
    const model = {
      type: "Poly2",
      predict: (cost) => -cost * cost + 10 * cost + 10,
      params: { a: -1, b: 10, c: 10 },
    };
    const result = calculateAllocationModeB({
      modelsMap: new Map([["Search", { model, xMin: 1, xMax: 10 }]]),
      totalBudget: 8,
      overrides: { Search: 8 },
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].results).toBeCloseTo(8 / 35, 10);
    expect(result.items[0].results).not.toBeCloseTo(8 / 26, 10);
  });
});
