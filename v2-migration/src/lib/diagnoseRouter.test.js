import { describe, expect, it } from "vitest";
import { buildSymptomDiagnosis, getDiagnoseSymptoms } from "./diagnoseRouter";

describe("symptom diagnosis router", () => {
  it("provides the same symptom coverage in KR and EN", () => {
    expect(getDiagnoseSymptoms("ko").map((item) => item.id)).toEqual(getDiagnoseSymptoms("en").map((item) => item.id));
  });

  it("prioritizes incrementality when causal proof is the goal, even with observational paid-organic data", () => {
    const diagnosis = buildSymptomDiagnosis({ symptom: "organic-drop", data: "organic", goal: "proof" });
    expect(diagnosis.steps.map((step) => step.toolId)).toEqual(["5-23", "5-18-cannibal", "5-3"]);
  });

  it("prioritizes creative analysis when creative data is available", () => {
    const diagnosis = buildSymptomDiagnosis({ symptom: "cpi-rise", data: "creative", goal: "cause", locale: "en" });
    expect(diagnosis.steps[0].toolId).toBe("9-6");
    expect(diagnosis.steps[0].href).toBe("/en/content/freshness");
  });

  it("returns null without a known symptom", () => {
    expect(buildSymptomDiagnosis({ symptom: "unknown" })).toBeNull();
  });
});
