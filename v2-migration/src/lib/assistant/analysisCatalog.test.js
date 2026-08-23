import { describe, expect, it } from "vitest";

import { ANALYSIS_CATALOG, analysisCatalogEntry, publishedAnalysisToolIds, validateAnalysisCatalog } from "./analysisCatalog";

describe("Dochi analysis catalog", () => {
  it("covers every published data analysis route exactly once", () => {
    const ids = ANALYSIS_CATALOG.map((entry) => entry.toolId);
    expect(ids).toEqual(publishedAnalysisToolIds());
    expect(new Set(ids).size).toBe(ids.length);
    expect(validateAnalysisCatalog()).toEqual({ missing: [], orphaned: [], duplicateToolIds: [] });
  });

  it("keeps subscription survival as a dedicated episode analysis, not a comparison tool", () => {
    const subscription = analysisCatalogEntry("5-28");
    expect(subscription.supportedGrains).toEqual(["subscription_episode"]);
    expect(subscription.runMode).toBe("baseline");
    expect(subscription.decisionQuestion).toMatch(/구독/);
  });

  it("only marks lightweight baseline tools as candidates for automatic execution", () => {
    expect(ANALYSIS_CATALOG.filter((entry) => entry.runMode === "baseline").every((entry) => entry.executionCost === "light")).toBe(true);
    expect(analysisCatalogEntry("5-18-mmm").runMode).toBe("confirm_model");
    expect(analysisCatalogEntry("5-23").runMode).toBe("confirm_design");
  });
});
