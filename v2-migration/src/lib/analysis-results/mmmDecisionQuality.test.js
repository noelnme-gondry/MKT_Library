import { expect, it } from "vitest";
import { mmmDecisionQuality } from "./mmmDecisionQuality";
it("does not approve missing identification or validation from a good training fit", () => {
  expect(mmmDecisionQuality({ run: { posterior: { r2: 0.99 } }, health: { wmape: 1 } }).budgetEligible).toBe(false);
});
it("carries a failed health diagnostic into the final budget gate", () => {
  const input = { run: { identification: { budgetEligible: true } }, health: { oos: { wmape: 5 }, coverage90: 0.9, flags: [] } };
  expect(mmmDecisionQuality(input).budgetEligible).toBe(true);
  expect(mmmDecisionQuality({ ...input, health: { ...input.health, flags: [{ key: "negativeBaseline", severity: "fail" }] } }).reasons).toContain("health:negativeBaseline");
  expect(mmmDecisionQuality({ ...input, notices: [{ dropped: false }] }).budgetEligible).toBe(false);
});
