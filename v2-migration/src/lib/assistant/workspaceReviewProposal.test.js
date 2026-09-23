import { describe, expect, it } from "vitest";
import { workspaceReviewProposal } from "./workspaceReviewProposal";
import { readDecisionPlan } from "@/lib/decisionPlan";

const result = {
  status: "success", toolId: "5-21", manifest: { resultField: "actions", periodDays: 7 },
  verdict: { headline: "Observed change", action: "Review campaign changes", stats: [{ id: "prior-unit-cost", value: 5000 }, { id: "recent-unit-cost", value: 5500 }] },
  visualizations: [{ id: "pvm-channel-contributions", data: [{ entity: "Channel A", contribution: 100 }, { entity: "Channel B", contribution: -400 }] }],
};
describe("workspace review proposals", () => {
  it.each(["ko", "en"])("preserves the actual baseline, largest absolute contributor and operating benchmark (%s)", locale => {
    const proposal = workspaceReviewProposal(result, locale, "KRW");
    expect(proposal).toMatchObject({ actionTarget: "Channel B", baseline: "5500", goalMetric: "cpa", comparisonWindowDays: 7 });
    expect(readDecisionPlan(proposal.reviewPlan)).toMatchObject({ method: "observe", value: "5000", baseline: "5500", mode: "at_most", unit: "KRW" });
  });
  it("does not create goals from failed results, unknown amounts or unknown currency", () => {
    expect(workspaceReviewProposal({ ...result, status: "not_identified" })).toBeNull();
    expect(workspaceReviewProposal({ ...result, verdict: { ...result.verdict, stats: [] } }).reviewPlan).toBeUndefined();
    expect(workspaceReviewProposal(result).reviewPlan).toBe("");
  });
  it("retains the improved observed benchmark instead of proposing a worse goal", () => {
    const proposal = workspaceReviewProposal({ ...result, verdict: { ...result.verdict, stats: [{ id: "prior-unit-cost", value: 5000 }, { id: "recent-unit-cost", value: 4500 }] } }, "en", "KRW");
    expect(readDecisionPlan(proposal.reviewPlan).value).toBe("4500");
  });
});
