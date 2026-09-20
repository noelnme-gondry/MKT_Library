import { expect, it } from "vitest";
import { assessDecisionPlan, decisionPlanError, serializeDecisionPlan, readDecisionPlan, decisionObservationRows } from "./decisionPlan";
import { normalizeDecisionReviewRows, serializeDecisionReviewCsv } from "./decisionReview";
import { scoreDecision } from "./weekly-review/decisionScore";
import { archiveMemo } from "./account/archiveContract";
import Papa from "papaparse";
const plan = { method: "holdout", target: "Google brand", control: "Unchanged control regions", window: "Oct 1–14", mode: "increase_percent", baseline: "5000", value: "10", unit: "people", metric: "Organic users" };
it("compares percent recovery and absolute recovery without conflating them", () => {
  expect(assessDecisionPlan({ ...plan, baseline: "0.1" }, "0.11").state).toBe("met");
  expect(assessDecisionPlan({ ...plan, baseline: "0.1" }, "0.109999999").state).toBe("not_met");
  expect(assessDecisionPlan(plan, "5499").state).toBe("not_met");
  expect(assessDecisionPlan(plan, "5500").state).toBe("met");
  expect(assessDecisionPlan({ ...plan, mode: "increase_absolute", value: "500" }, "5500").state).toBe("met");
  expect(assessDecisionPlan({ ...plan, mode: "increase_absolute", value: "10" }, "5010").state).toBe("met");
  expect(assessDecisionPlan({ ...plan, mode: "decrease_percent", value: "10" }, "4500").state).toBe("met");
});
it("rejects incomplete and mathematically undefined criteria", () => {
  for (const patch of [{ baseline: "0" }, { value: "NaN" }, { unit: "" }, { control: "" }, { window: "" }, { baseline: "" }]) expect(decisionPlanError({ ...plan, ...patch })).not.toBe("");
  expect(assessDecisionPlan(plan, "").state).toBe("waiting");
  expect(assessDecisionPlan(plan, "5500 people").state).toBe("waiting");
  expect(assessDecisionPlan({ mode: "at_most", value: "0", unit: "errors" }, "0").state).toBe("met");
});
it("preserves the plan and observation through CSV while excluding them from account memos", () => {
  const row = { id: "decision", toolId: "5-18-mmm", action: "Hold out brand search", reviewPlan: serializeDecisionPlan({ ...plan, raw: ["private"] }), targetActual: "5500" };
  const [back] = normalizeDecisionReviewRows(Papa.parse(serializeDecisionReviewCsv([row]), { header: true }).data);
  expect(readDecisionPlan(back.reviewPlan)).toEqual(plan);
  expect(back.targetActual).toBe("5500");
  expect(archiveMemo(back)).not.toHaveProperty("reviewPlan");
  expect(scoreDecision({ decision: { ...row, goalMetric: "conversions", goalDirection: "up" } })).toMatchObject({ outcome: "UNSCORED", reason: "explicit_target_review_required" });
});

it("never fills an experiment observation from a generic period aggregate", async () => {
  const { buildComparableDecisionActual } = await import("./decisionComparableActual");
  const { decisionReviewFollowUpMode } = await import("./decisionReview");
  const record = { metric: "CPA", goalMetric: "cpa", baselineDate: "2026-01-01", reviewPlan: serializeDecisionPlan(plan) };
  expect(decisionReviewFollowUpMode(record)).toBe("rerun_manual");
  expect(buildComparableDecisionActual(record)).toEqual({ state: "explicit_target_review_required" });
});

it("keeps partial recovery visible independently of an operating target", () => {
  const rows = decisionObservationRows(plan, "5300", "en");
  expect(rows).toContainEqual(["Observed change (not causal lift)", "+300 people (+6%)"]);
  expect(rows).toContainEqual(["Operating target progress (not recovery share)", "60%"]);
  expect(rows).toContainEqual(["Operating target comparison", "Below target; this does not mean no effect"]);
  expect(decisionObservationRows({ ...plan, baseline: "0" }, "300", "en").flat().join(" ")).not.toMatch(/Infinity|NaN/);
  expect(decisionObservationRows(plan, "", "en")).toEqual([]);
});
it("preserves linked experimental uncertainty through CSV but excludes it from account memos", async () => {
  const { serializeReviewEvidence, readReviewEvidence } = await import("./reviewEvidence");
  const effectEvidence = serializeReviewEvidence({ headline: "Estimate +300; interval crosses zero, not proof of no effect", stats: [{ label: "95% CI", value: "-100 to +700 people" }], points: [{ text: "Confirm assignment and total conversions" }], scope: { start: "2026-10-01" }, raw: ["private"] });
  const row = { id: "review", toolId: "5-18-mmm", action: "Review holdout", reviewPlan: serializeDecisionPlan(plan), targetActual: "5300", effectEvidence, effectSourceId: "experiment" };
  const [back] = normalizeDecisionReviewRows(Papa.parse(serializeDecisionReviewCsv([row]), { header: true }).data);
  expect(back.effectSourceId).toBe("experiment");
  expect(readReviewEvidence(back.effectEvidence).stats[0].value).toBe("-100 to +700 people");
  expect(back.effectEvidence).not.toContain("private");
  expect(archiveMemo(back)).not.toHaveProperty("effectEvidence");
  expect(archiveMemo(back)).not.toHaveProperty("effectSourceId");
});
