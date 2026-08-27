import { describe, expect, it } from "vitest";
import { assessObfSequentialLook, obfBoundaryConstant, obfFamilywiseAlpha, obfSequentialPlan } from "@/utils/sequentialTest";

describe("O'Brien–Fleming sequential plan", () => {
  it("uses canonical four-look boundaries whose familywise alpha is 0.05", () => {
    const plan = obfSequentialPlan({ alpha: 0.05, looks: 4, plannedTotal: 4000 });
    expect(plan).toHaveLength(4);
    expect(plan[0].nominalP).toBeLessThan(plan[1].nominalP);
    expect(plan.map((look) => look.boundaryZ)).toEqual([
      expect.closeTo(4.0487, 3),
      expect.closeTo(2.8629, 3),
      expect.closeTo(2.3376, 3),
      expect.closeTo(2.0244, 3),
    ]);
    expect(plan.at(-1).nominalP).toBeLessThan(0.05);
    expect(obfFamilywiseAlpha(obfBoundaryConstant(0.05, 4), 4, 501)).toBeCloseTo(0.05, 3);
    expect(plan[0].plannedTotal).toBe(1000);
  });

  it("tightens the terminal boundary as more looks are planned", () => {
    expect(obfBoundaryConstant(0.05, 2)).toBeCloseTo(1.9775, 3);
    expect(obfBoundaryConstant(0.05, 6)).toBeCloseTo(2.0529, 3);
    expect(obfBoundaryConstant(0.05, 6)).toBeGreaterThan(obfBoundaryConstant(0.05, 2));
  });

  it("keeps every UI-supported precomputed boundary on the calibrated familywise alpha", () => {
    for (const alpha of [0.1, 0.05, 0.01]) {
      for (const looks of [2, 3, 4, 5, 6]) {
        expect(obfFamilywiseAlpha(obfBoundaryConstant(alpha, looks), looks, 501)).toBeCloseTo(alpha, 3);
      }
    }
  });

  it("does not let an ordinary p-value stop at the first look", () => {
    expect(assessObfSequentialLook({ pValue: 0.02, observedTotal: 1000, plannedTotal: 4000, looks: 4 }).state).toBe("continue");
    expect(assessObfSequentialLook({ pValue: 0.00001, observedTotal: 1000, plannedTotal: 4000, looks: 4 }).state).toBe("interim_boundary_crossed");
  });
});
