import { describe, expect, it } from "vitest";
import { evaluateEligibility, rankRecommendedAnalyses } from "./evaluateEligibility";

const canonicalData = { records: Array.from({ length: 24 }, (_, index) => ({ date: `2026-07-${String((index % 12) + 1).padStart(2, "0")}` })) };

describe("analysis eligibility", () => {
  it("blocks a tool when required concepts are missing", () => {
    const result = evaluateEligibility({ toolId: "5-2", mapping: { Date: "date", Spend: "cost" }, canonicalData });
    expect(result).toMatchObject({ status: "blocked" });
    expect(result.reasons[0]).toContain("installs/actions");
  });

  it("marks enough time series data as ready", () => {
    const result = evaluateEligibility({ toolId: "5-22", mapping: { Date: "date", Spend: "cost", Channel: "channel", Installs: "installs" }, canonicalData });
    expect(result).toMatchObject({ status: "ready", periodCount: 12 });
  });

  it("ranks ready analyses before caution", () => {
    expect(rankRecommendedAnalyses([{ status: "caution", priority: 1 }, { status: "ready", priority: 4 }])[0].status).toBe("ready");
  });
});
