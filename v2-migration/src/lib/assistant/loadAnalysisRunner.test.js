import { describe, expect, it } from "vitest";
import { EFFICIENCY_TOOL_IDS, runEfficiencyAnalysis } from "./efficiencyAnalysisAdapters";
import { OPTIMIZATION_TOOL_IDS, runOptimizationAnalysis } from "./optimizationAnalysisAdapters";
import { RESPONSE_ANALYSIS_TOOL_IDS, runResponseAnalysis } from "./responseAnalysisAdapters";
import { SPECIAL_TOOL_IDS, runSpecialAnalysis } from "./specialAnalysisAdapters";
import { SUBSCRIPTION_ANALYSIS_TOOL_IDS, runSubscriptionAnalysis } from "./subscriptionAnalysisAdapters";
import { loadAnalysisRunner } from "./loadAnalysisRunner";

describe("on-demand analysis runner", () => {
  it("preserves every registered adapter through its CSV group", async () => {
    const families = [
      [EFFICIENCY_TOOL_IDS, runEfficiencyAnalysis],
      [OPTIMIZATION_TOOL_IDS, runOptimizationAnalysis],
      [RESPONSE_ANALYSIS_TOOL_IDS, runResponseAnalysis],
      [SPECIAL_TOOL_IDS, runSpecialAnalysis],
      [SUBSCRIPTION_ANALYSIS_TOOL_IDS, runSubscriptionAnalysis],
    ];
    expect(families.reduce((count, [ids]) => count + ids.length, 0)).toBeGreaterThan(0);
    for (const [ids, run] of families) {
      for (const id of ids) expect(await loadAnalysisRunner(id)).toBe(run);
    }
  });

  it("does not claim an unregistered tool has a runnable adapter", async () => {
    expect(await loadAnalysisRunner("unknown")).toBeNull();
    expect(await loadAnalysisRunner("5-18-mmm")).toBeNull();
    expect(await loadAnalysisRunner("5-4")).toBeNull();
  });
});
