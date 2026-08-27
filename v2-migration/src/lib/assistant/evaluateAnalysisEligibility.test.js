import { describe, expect, it } from "vitest";

import { ANALYSIS_CATALOG } from "./analysisCatalog";
import { evaluateAnalysisEligibility, evaluateCatalogEligibility, rankRecommendedAnalyses } from "./evaluateAnalysisEligibility";

const efficiencyMapping = {
  Date: "date",
  Channel: "channel",
  Spend: "cost",
  Installs: "installs",
};

describe("evaluateAnalysisEligibility", () => {
  it("does not turn an empty uploaded dataset into a ready analysis", () => {
    const result = evaluateAnalysisEligibility({ toolId: "5-2", mapping: efficiencyMapping, profile: { rowCount: 0, grain: "campaign_daily" } });
    expect(result.status).toBe("blocked");
    expect(result.blockers).toContainEqual({ code: "no_rows" });
  });

  it("offers model work only after the required data is present", () => {
    const result = evaluateAnalysisEligibility({
      toolId: "5-18-mmm",
      mapping: { Week: "week", Revenue: "mmm_reg", Meta: "ch_meta" },
      profile: { rowCount: 52, periodCount: 52, grain: "weekly_panel" },
    });
    expect(result.status).toBe("confirm_model");
    expect(result.requiresConfirmation).toEqual(expect.arrayContaining(["outcome", "model_limit"]));
  });

  it("accepts a confirmed calendar-date mapping wherever the response panel requires week", () => {
    const result = evaluateAnalysisEligibility({
      toolId: "5-18-trend",
      mapping: { dt: "date", Signups: "mmm_reg", Spend: "ch_meta" },
      profile: { rowCount: 90, periodCount: 13, grain: "weekly_panel", cadence: "daily" },
    });
    expect(result.status).toBe("ready");
    expect(result.blockers).toEqual([]);
  });

  it("keeps tool-owned user/event and content analyses as design confirmation", () => {
    const aha = evaluateAnalysisEligibility({
      toolId: "5-20",
      mapping: ["user_id", "outcome_binary", "numeric_feature"],
      profile: { rowCount: 100, grain: "user_event" },
    });
    const content = evaluateAnalysisEligibility({
      toolId: "9-1",
      mapping: ["outcome_numeric", "numeric_feature"],
      profile: { rowCount: 30, grain: "content_item" },
    });
    expect(aha.status).toBe("confirm_design");
    expect(content.status).toBe("confirm_model");
  });

  it("classifies every catalog tool into exactly one supported state", () => {
    const results = evaluateCatalogEligibility({ catalog: ANALYSIS_CATALOG, mapping: {}, profile: { rowCount: 0 } });
    expect(results).toHaveLength(ANALYSIS_CATALOG.length);
    expect(results.every((result) => ["ready", "confirm_model", "confirm_design", "manual", "blocked"].includes(result.status))).toBe(true);
  });

  it("ranks equivalent inputs deterministically and places available baseline work first", () => {
    const input = [
      { toolId: "5-3", status: "ready" },
      { toolId: "5-18-mmm", status: "confirm_model" },
      { toolId: "5-2", status: "ready" },
    ];
    expect(rankRecommendedAnalyses(input).map((item) => item.toolId)).toEqual(["5-2", "5-3", "5-18-mmm"]);
    expect(rankRecommendedAnalyses(input)).toEqual(rankRecommendedAnalyses(input));
  });
});
