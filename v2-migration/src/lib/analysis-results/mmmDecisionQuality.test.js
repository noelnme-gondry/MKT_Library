import { expect, it } from "vitest";
import { mmmDecisionQuality, mmmBaselineEvidence } from "./mmmDecisionQuality";
it("does not approve missing identification or validation from a good training fit", () => {
  expect(mmmDecisionQuality({ run: { posterior: { r2: 0.99 } }, health: { wmape: 1 } }).budgetEligible).toBe(false);
});
it("carries a failed health diagnostic into the final budget gate", () => {
  const input = { run: { identification: { budgetEligible: true }, backtest: { n: 10, wmape: 5 } }, actual: Array.from({ length: 50 }, (_, index) => index < 40 ? 100 : 200), health: { oos: { wmape: 5 }, coverage90: 0.9, flags: [] } };
  expect(mmmDecisionQuality(input).budgetEligible).toBe(true);
  expect(mmmDecisionQuality({ ...input, health: { ...input.health, flags: [{ key: "negativeBaseline", severity: "fail" }] } }).reasons).toContain("health:negativeBaseline");
  expect(mmmDecisionQuality({ ...input, notices: [{ dropped: false }] }).budgetEligible).toBe(false);
});
it("holds a finite low model error when a constant baseline is exact", () => {
  const run = { identification: { budgetEligible: true }, backtest: { n: 10, wmape: 5 } };
  const quality = mmmDecisionQuality({ run, actual: Array(50).fill(100), health: { oos: run.backtest } });
  expect(quality.baseline.baselineWmape).toBe(0);
  expect(quality.reasons).toContain("baseline_not_beaten");
  expect(quality.budgetEligible).toBe(false);
});
it("uses recorded rolling cuts and equally weighted fold errors, not the final n weeks", () => {
  const run = { backtest: { source: "channel-model-rolling-origin", wmape: 15, n: 4 }, rollingBacktest: { cuts: [2, 4], horizon: 2, foldWmapes: [10, 20] } };
  const result = mmmBaselineEvidence(run, [100, 100, 200, 200, 100, 100, 999]);
  expect(result.baselineWmape).toBe(75);
  expect(result.modelWmape).toBe(15);
  expect(result.folds.map((fold) => fold.cut)).toEqual([2, 4]);
  expect(result.beatsBaseline).toBe(true);
  expect(mmmBaselineEvidence({ ...run, rollingBacktest: undefined }, [100, 100, 200, 200, 100, 100])).toBeNull();
});
it("does not invent evidence for malformed or mismatched windows", () => {
  const run = { backtest: { source: "aggregate-model-rolling-origin", wmape: 15 }, aggregateRollingBacktest: { cuts: [2], horizon: 2, foldWmapes: [10] } };
  expect(mmmBaselineEvidence(run, [100, 100, 200, 200])).toBeNull();
  expect(mmmBaselineEvidence(run, [100, 100, NaN, 200])).toBeNull();
  expect(mmmBaselineEvidence({ backtest: { n: 10, wmape: 5 } }, Array(50).fill(0))).toBeNull();
});
