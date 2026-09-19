import { expect, it } from "vitest";
import { runReview, pickDecisionToScore, kpiFor } from "./reviewPipeline";
import { createDecisionComparisonScope } from "@/lib/decisionComparisonScope";
const rows = Array.from({ length: 14 }, (_, i) => ({ date: `2026-09-${String(i + 1).padStart(2, "0")}`, campaign: "A", country: "US", cost: 10000, actions: i < 7 ? 1000 : 2000 }));
it("blocks success scoring when a non-weekly decision has a different saved scope", () => {
  const decision = { id: "foreign-scope", toolId: "5-3", action: "KR budget", actionKind: "hold", actionTarget: "A", goalMetric: "conversions", goalDirection: "up", guardrailMetric: "cpa", guardrailOp: "lte", guardrailValue: "100", createdAt: "2026-09-07", baselineDate: "2026-09-07", comparisonScope: createDecisionComparisonScope({ dataGroup: "efficiency", filter: { countries: ["KR"], dateStart: "2026-08-01", dateEnd: "2026-08-07" } }) };
  const review = runReview({ rows, project: { kpi: kpiFor("cpa"), currency: "USD" }, decisionRecords: [decision], customPeriod: { currentStart: "2026-09-08", currentEnd: "2026-09-14", previousStart: "2026-09-01", previousEnd: "2026-09-07" } });
  expect(review.ok).toBe(true);
  expect(review.lastDecision.score).toMatchObject({ outcome: "UNSCORED", reason: "comparison_context_mismatch" });
});
it("does not let a future unscorable decision hide a due decision", () => {
  const due = { id: "due", createdAt: "2026-09-06", baselineDate: "2026-09-06", reviewDate: "2026-09-08", goalMetric: "cpa", goalDirection: "down", guardrailMetric: "cpa", guardrailOp: "lte", guardrailValue: "10" };
  const later = { id: "future", createdAt: "2026-09-07", baselineDate: "2026-09-07", reviewDate: "2026-12-31" };
  expect(pickDecisionToScore([due, later], { currentPeriodStart: "2026-09-08" }).id).toBe("due");
});
