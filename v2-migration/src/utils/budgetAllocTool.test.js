import { describe, expect, it } from "vitest";
import {
  calculateAllocationModeB,
  buildAllocationFrontier,
  getAllocationEvidenceLimits,
  improveAllocationFromCurrent,
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

describe("allocation that starts from the current split", () => {
  // Scale는 지출이 늘수록 싸진다(CPR 19 → 10). 0원부터 쌓는 그리디는 첫 칸을 관측 하한의
  // 비싼 단가(19)로 보므로 늘 12인 Flat만 고르고, 지금 배분(Scale 900 · Flat 100)보다
  // 적은 성과를 낸다. 지금 배분에서 출발하면 합계가 늘어나는 이동만 받으므로 그럴 수 없다.
  const scale = { type: "Linear", predict: (cost) => 20 - 0.01 * cost };
  const flat = { type: "Linear", predict: () => 12 };
  const modelsMap = new Map([
    ["Scale", { model: scale, xMin: 100, xMax: 1000 }],
    ["Flat", { model: flat, xMin: 50, xMax: 1000 }],
  ]);
  const maxSpends = { Scale: 1000, Flat: 1000 };
  const total = (plan) => plan.items.reduce((sum, item) => sum + item.results, 0);
  const run = () => improveAllocationFromCurrent({ modelsMap, currentSpends: { Scale: 900, Flat: 100 }, totalBudget: 1000, maxSpends });

  it("reproduces the greedy plan that is worse than the current split", () => {
    const greedy = calculateAllocationModeB({ modelsMap, totalBudget: 1000, maxSpends, extrapolateMode: "1.0" });
    const current = 900 / 11 + 100 / 12;
    expect(total(greedy)).toBeLessThan(current);
    expect(total(greedy)).toBeCloseTo(1000 / 12, 6);
  });

  it("never ends below the current split and moves budget toward the cheaper-at-scale channel", () => {
    const plan = run();
    expect(plan.startResults).toBeCloseTo(900 / 11 + 100 / 12, 9);
    expect(total(plan)).toBeGreaterThanOrEqual(plan.startResults);
    expect(plan.moves).toBeGreaterThan(0);
    const byName = Object.fromEntries(plan.items.map((item) => [item.channel, item]));
    // 최적은 Scale 1000(단가 10) = 100건. 칸 단위로 움직이므로 칸 하나 오차 안에서 닿는다.
    expect(byName.Scale.cost).toBeCloseTo(1000, 6);
    expect(byName.Flat.cost).toBeCloseTo(0, 6);
    expect(total(plan)).toBeCloseTo(100, 6);
  });

  it("keeps the budget, respects caps, and is deterministic", () => {
    const plan = run();
    expect(plan.totalAllocated).toBeCloseTo(1000, 9);
    // 합계가 늘어나는 이동만 받으면 이동 상한(2000)에 닿기 전에 멈춘다 — 손해 이동을 받으면 진동해 상한까지 간다.
    expect(plan.moves).toBeLessThan(200);
    for (const item of plan.items) expect(item.cost).toBeLessThanOrEqual(maxSpends[item.channel] + 1e-9);
    expect(run()).toEqual(plan);
  });

  it("scales the current split to a different budget and pushes excess over a cap into open channels", () => {
    const plan = improveAllocationFromCurrent({ modelsMap, currentSpends: { Scale: 900, Flat: 100 }, totalBudget: 1500, maxSpends, startStepRatio: 0.002 });
    // 1.5배 하면 Scale 1350 > 상한 1000 → 넘친 350은 Flat으로 간다. 출발점부터 상한 안이다.
    expect(plan.startResults).toBeCloseTo(1000 / 10 + 500 / 12, 9);
    expect(plan.totalAllocated).toBeCloseTo(1500, 9);
    expect(total(plan)).toBeGreaterThanOrEqual(plan.startResults);
  });
});
