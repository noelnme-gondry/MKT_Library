import { describe, expect, it } from "vitest";
import {
  calculateAllocationModeB,
  buildAllocationFrontier,
  getAllocationEvidenceLimits,
  isAllocationFullyFunded,
  selectBudgetForTarget,
} from "./budgetAllocTool";

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

  it("limits goal planning to observed evidence instead of a clamped curve beyond xMax", () => {
    const linear = { type: "Linear", predict: () => 5 };
    const limits = getAllocationEvidenceLimits({
      modelsMap: new Map([
        ["Search", { model: linear, xMax: 100 }],
        ["Social", { model: linear, xMax: 200 }],
      ]),
    });

    expect(limits.maxSpends).toEqual({ Search: 100, Social: 200 });
    expect(limits.maxBudget).toBe(300);
  });

  it("keeps target-frontier samples near the low budget floor as well as the upper range", () => {
    const linear = { type: "Linear", predict: () => 5 };
    const frontier = buildAllocationFrontier({
      modelsMap: new Map([["Search", { model: linear, xMax: 10000 }]]),
      minBudget: 10,
      maxBudget: 10000,
      metric: "installs",
      mode: "b",
      maxSpends: { Search: 10000 },
      extrapolateMode: "1.0",
      steps: 25,
    });

    expect(frontier[0].budget).toBe(10);
    expect(frontier.at(-1).budget).toBe(10000);
    expect(frontier.some((point) => point.budget > 10 && point.budget < 100)).toBe(true);
  });

  it("does not treat a materially unallocated budget as executable", () => {
    expect(
      isAllocationFullyFunded({
        budget: 100,
        allocation: { totalAllocated: 100, unallocated: 0 },
      }),
    ).toBe(true);
    expect(
      isAllocationFullyFunded({
        budget: 100,
        allocation: { totalAllocated: 70, unallocated: 30 },
      }),
    ).toBe(false);
    expect(
      isAllocationFullyFunded({
        currency: "USD",
        budget: 1,
        allocation: { totalAllocated: 0.995, unallocated: 0.005 },
      }),
    ).toBe(true);
  });

  it("chooses the largest fully allocated CPI/CPA candidate that meets the target, even on a non-monotonic frontier", () => {
    const plan = selectBudgetForTarget({
      metric: "installs",
      targetValue: 10,
      frontier: [
        { budget: 100, value: 9, allocation: { totalAllocated: 100, unallocated: 0 } },
        { budget: 200, value: 11, allocation: { totalAllocated: 200, unallocated: 0 } },
        { budget: 300, value: 9.5, allocation: { totalAllocated: 300, unallocated: 0 } },
        // A capped candidate cannot become the "optimal budget" just because
        // its simulated CPI still looks good.
        { budget: 400, value: 8, allocation: { totalAllocated: 300, unallocated: 100 } },
      ],
    });

    expect(plan.status).toBe("met");
    expect(plan.candidate.budget).toBe(300);
  });

  it("uses the opposite target direction for ROAS and reports an unreachable goal honestly", () => {
    const met = selectBudgetForTarget({
      metric: "revenue_d7",
      targetValue: 2,
      frontier: [
        { budget: 100, value: 2.3, allocation: { totalAllocated: 100, unallocated: 0 } },
        { budget: 200, value: 1.9, allocation: { totalAllocated: 200, unallocated: 0 } },
        { budget: 300, value: 2.1, allocation: { totalAllocated: 300, unallocated: 0 } },
        { budget: 400, value: 1.8, allocation: { totalAllocated: 400, unallocated: 0 } },
      ],
    });
    const unreachable = selectBudgetForTarget({
      metric: "revenue_d7",
      targetValue: 3,
      frontier: [
        { budget: 100, value: 2.3, allocation: { totalAllocated: 100, unallocated: 0 } },
        { budget: 200, value: 2.1, allocation: { totalAllocated: 200, unallocated: 0 } },
      ],
    });

    expect(met.status).toBe("met");
    expect(met.candidate.budget).toBe(300);
    expect(unreachable.status).toBe("unreachable");
    expect(unreachable.candidate.value).toBe(2.3);
  });

  it("marks a target as capped rather than implying there is unlimited scalable budget", () => {
    const plan = selectBudgetForTarget({
      metric: "actions",
      targetValue: 20,
      frontier: [
        { budget: 100, value: 18, allocation: { totalAllocated: 100, unallocated: 0 } },
        { budget: 200, value: 19, allocation: { totalAllocated: 200, unallocated: 0 } },
      ],
    });

    expect(plan.status).toBe("cap_reached");
    expect(plan.candidate.budget).toBe(200);
  });
});
