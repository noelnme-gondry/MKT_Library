import { describe, expect, it } from "vitest";
import { allocationDeltaPlan } from "./allocationDeltaPlan";

const model = cpr => ({ model: { type: "Linear", params: { a: 0, b: cpr }, predict: () => cpr }, xMin: 10, xMax: 1000 });
const args = { modelsMap: new Map([["A", model(10)], ["B", model(20)]]), currentSpends: { A: 100, B: 100 }, maxSpends: { A: 150, B: 1000 } };
describe("keep current allocation and change only the delta", () => {
  it("preserves all shares at the same budget", () => {
    expect(allocationDeltaPlan({ ...args, totalBudget: 200 }).items.map(item => item.cost)).toEqual([100, 100]);
  });
  it("adds to marginal efficiency first, respects caps and conserves budget", () => {
    const plan = allocationDeltaPlan({ ...args, totalBudget: 300 });
    expect(plan.items.map(item => item.cost)).toEqual([150, 150]);
    expect(plan.totalAllocated).toBe(300);
    expect(plan.unallocated).toBe(0);
  });
  it("reduces the least expensive lost outcomes and retains low-confidence holds", () => {
    const plan = allocationDeltaPlan({ ...args, totalBudget: 150 });
    expect(plan.items.map(item => item.cost)).toEqual([100, 50]);
    const locked = allocationDeltaPlan({ ...args, totalBudget: 150, overrides: { B: 100 } });
    expect(locked.items.map(item => item.cost)).toEqual([50, 100]);
  });
  it("does not invent a feasible or zero-result plan when a model is missing", () => {
    const plan = allocationDeltaPlan({ ...args, modelsMap: new Map([["A", null]]), totalBudget: 100 });
    expect(plan.blocked).toBe(true);
    expect(plan.unallocated).toBeNull();
    expect(plan.items).toEqual([]);
  });
});
