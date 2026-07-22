import { describe, expect, it } from "vitest";
import { evaluateEligibility, rankRecommendedAnalyses } from "./evaluateEligibility";

const isoDay = (index) => new Date(Date.UTC(2026, 6, index + 1)).toISOString().slice(0, 10);
const canonicalData = {
  records: Array.from({ length: 24 }, (_, index) => ({
    date: isoDay(index),
    dimensions: { channel: index % 2 ? "Meta" : "Google" },
    metrics: { cost: 100 + index, installs: 10 + (index % 4) },
  })),
};

function mmmData(weeks) {
  return {
    records: Array.from({ length: weeks }, (_, index) => ({
      date: new Date(Date.UTC(2025, 0, 1 + index * 7)).toISOString().slice(0, 10),
      dimensions: {},
      metrics: {
        mmm_reg: 100 + index,
        ch_google_roi: 200 + (index % 5) * 80,
        ch_meta: 160 + ((index * 3) % 7) * 55,
      },
    })),
  };
}

describe("analysis eligibility", () => {
  it("blocks a tool when required concepts are missing", () => {
    const result = evaluateEligibility({ toolId: "5-2", mapping: { Date: "date", Spend: "cost" }, canonicalData });
    expect(result).toMatchObject({ status: "blocked" });
    expect(result.reasons[0]).toContain("installs/actions");
  });

  it("marks enough time series data as ready", () => {
    const result = evaluateEligibility({ toolId: "5-22", mapping: { Date: "date", Spend: "cost", Channel: "channel", Installs: "installs" }, canonicalData });
    expect(result).toMatchObject({ status: "ready", periodCount: 24 });
  });

  it("ranks ready analyses before caution", () => {
    expect(rankRecommendedAnalyses([{ status: "caution", priority: 1 }, { status: "ready", priority: 4 }])[0].status).toBe("ready");
  });

  it("keeps 12-week MMM open for exploration, not budget decisions", () => {
    const result = evaluateEligibility({
      toolId: "5-18",
      mapping: { Week: "week", Registrations: "mmm_reg", Google: "ch_google_roi", Meta: "ch_meta" },
      canonicalData: mmmData(12),
    });
    expect(result).toMatchObject({ status: "caution", confidenceTier: "exploratory" });
    expect(result.reasonDetails.join(" ")).toContain("52주 미만");
  });

  it("marks a 52-week independent MMM panel as decision-ready", () => {
    const result = evaluateEligibility({
      toolId: "5-18",
      mapping: { Week: "week", Registrations: "mmm_reg", Google: "ch_google_roi", Meta: "ch_meta" },
      canonicalData: mmmData(52),
    });
    expect(result).toMatchObject({ status: "ready", confidenceTier: "decision" });
  });
});
