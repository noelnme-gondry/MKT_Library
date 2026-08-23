import { describe, expect, it } from "vitest";

import { analysisProgress, beginNextAnalysis, cancelPendingAnalyses, confirmAnalysis, createAnalysisQueue, markQueueStale, settleAnalysis } from "./analysisQueue";

const baseline = { toolId: "5-2", status: "ready", runMode: "baseline", executionCost: "light" };
const model = { toolId: "5-18-mmm", status: "confirm_model", runMode: "confirm_model", executionCost: "heavy" };

describe("Dochi analysis queue", () => {
  it("automatically queues only lightweight baseline analyses", () => {
    const queue = createAnalysisQueue({ inputSignature: "i", mappingSignature: "m", eligibility: [baseline, model] });
    expect(queue.items).toEqual([expect.objectContaining({ toolId: "5-2", automatic: true })]);
  });

  it("adds a model only after an approval bound to the current signatures", () => {
    const queue = createAnalysisQueue({ inputSignature: "i", mappingSignature: "m", eligibility: [baseline, model] });
    const confirmed = confirmAnalysis({ queue, toolId: "5-18-mmm", inputSignature: "i", mappingSignature: "m", eligibility: model });
    expect(confirmed.items.map((item) => item.toolId)).toEqual(["5-2", "5-18-mmm"]);
    expect(confirmAnalysis({ queue, toolId: "5-18-mmm", inputSignature: "changed", mappingSignature: "m", eligibility: model })).toBe(queue);
  });

  it("records confirmed model work as a detailed-tool handoff without running it in the workspace", () => {
    const queue = createAnalysisQueue({ inputSignature: "i", mappingSignature: "m", eligibility: [model] });
    const confirmed = confirmAnalysis({ queue, toolId: "5-18-mmm", inputSignature: "i", mappingSignature: "m", eligibility: model });
    expect(confirmed.items).toEqual([expect.objectContaining({ toolId: "5-18-mmm", automatic: false, state: "handoff" })]);
    expect(beginNextAnalysis(confirmed)).toBe(confirmed);
  });

  it("keeps completed work, cancels only pending work, and stales all work after mapping changes", () => {
    const queue = createAnalysisQueue({ inputSignature: "i", mappingSignature: "m", eligibility: [baseline, model], confirmedAnalysisIds: ["5-18-mmm:i:m"] });
    const running = beginNextAnalysis(queue);
    const complete = settleAnalysis(running, { toolId: "5-2", result: { headline: "done" } });
    const cancelled = cancelPendingAnalyses(complete);
    expect(cancelled.items.find((item) => item.toolId === "5-2").state).toBe("complete");
    expect(cancelled.items.find((item) => item.toolId === "5-18-mmm").state).toBe("handoff");
    const stale = markQueueStale(cancelled, { inputSignature: "i", mappingSignature: "new" });
    expect(stale.items.every((item) => item.state === "stale")).toBe(true);
    expect(analysisProgress(complete)).toEqual({ approved: 2, completed: 1, pending: 1 });
  });
});
