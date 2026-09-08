import { describe, expect, it } from "vitest";
import { EMPTY_DESIGN, assessCausalDesign, designEvidenceTable } from "./causalDesignEvidence";

const declared = { unit: "person", assignment: "randomized", plannedWindow: "planned", concurrentChanges: "none", independentCounts: "unique" };
describe("declared causal design", () => {
  it("does not infer randomization or independent units from aggregate counts", () => {
    expect(assessCausalDesign(EMPTY_DESIGN, true).ready).toBe(false);
    expect(assessCausalDesign(declared, true).ready).toBe(true);
    for (const patch of [{ unit: "region" }, { independentCounts: "repeated" }, { assignment: "comparison" }, { plannedWindow: "changed" }, { concurrentChanges: "present" }]) {
      expect(assessCausalDesign({ ...declared, ...patch }, true).ready).toBe(false);
    }
  });
  it("records observational conditions without claiming randomized validity", () => {
    const values = { ...declared, unit: "time", assignment: "observational" };
    expect(assessCausalDesign(values).ready).toBe(true);
    expect(assessCausalDesign(values, true).ready).toBe(false);
    expect(designEvidenceTable(values, true).rows).toContainEqual(["assignment", "observational"]);
    expect(designEvidenceTable(values, true).title).toContain("not independently verified");
  });
});
