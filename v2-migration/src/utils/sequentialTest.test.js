import { describe, expect, it } from "vitest";
import { assessObfSequentialLook, obfSequentialPlan } from "@/utils/sequentialTest";

describe("O'Brien–Fleming sequential plan", () => {
  it("uses stricter early nominal boundaries and ends at alpha", () => {
    const plan = obfSequentialPlan({ alpha: 0.05, looks: 4, plannedTotal: 4000 });
    expect(plan).toHaveLength(4);
    expect(plan[0].nominalP).toBeLessThan(plan[1].nominalP);
    expect(plan.at(-1).nominalP).toBeCloseTo(0.05, 5);
    expect(plan[0].plannedTotal).toBe(1000);
  });

  it("does not let an ordinary p-value stop at the first look", () => {
    expect(assessObfSequentialLook({ pValue: 0.02, observedTotal: 1000, plannedTotal: 4000, looks: 4 }).state).toBe("continue");
    expect(assessObfSequentialLook({ pValue: 0.00001, observedTotal: 1000, plannedTotal: 4000, looks: 4 }).state).toBe("interim_boundary_crossed");
  });
});
