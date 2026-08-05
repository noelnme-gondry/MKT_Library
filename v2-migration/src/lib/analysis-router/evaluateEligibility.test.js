import { describe, expect, it } from "vitest";
import { evaluateEligibility, formatEligibilityBlocker, rankRecommendedAnalyses } from "./evaluateEligibility";

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

function efficiencyPanel(days, rowsForDay) {
  return {
    records: Array.from({ length: days }, (_, day) => rowsForDay(day)).flat(),
  };
}

describe("analysis eligibility", () => {
  it("blocks a tool when required concepts are missing", () => {
    const result = evaluateEligibility({ toolId: "5-2", mapping: { Date: "date", Spend: "cost" }, canonicalData });
    expect(result).toMatchObject({ status: "blocked" });
    expect(result.reasons[0]).toContain("installs/actions");
    expect(formatEligibilityBlocker(result, "ko")).toContain("CSV 매핑");
    expect(formatEligibilityBlocker(result, "en")).toContain("Map these required fields");
  });

  it("marks enough time series data as ready", () => {
    const result = evaluateEligibility({ toolId: "5-22", mapping: { Date: "date", Spend: "cost", Channel: "channel", Installs: "installs" }, canonicalData });
    expect(result).toMatchObject({ status: "ready", periodCount: 24 });
  });

  it("ranks ready analyses before caution", () => {
    expect(rankRecommendedAnalyses([{ status: "caution", priority: 1 }, { status: "ready", priority: 4 }])[0].status).toBe("ready");
  });

  it("uses a data-backed recommendation score within the same readiness tier", () => {
    const ranked = rankRecommendedAnalyses([
      { status: "ready", priority: 1, recommendationScore: 0 },
      { status: "ready", priority: 4, recommendationScore: 100 },
    ]);
    expect(ranked[0].recommendationScore).toBe(100);
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

  it("warns when PVM channel coverage does not span enough active dates", () => {
    const result = evaluateEligibility({
      toolId: "5-21",
      mapping: { Date: "date", Spend: "spend", Channel: "channel", Installs: "installs" },
      canonicalData: efficiencyPanel(14, (day) => [{
        date: isoDay(day), dimensions: { channel: "Google" }, metrics: { spend: day < 7 ? 100 : 0, installs: day < 7 ? 10 : 0 },
      }]),
    });
    expect(result).toMatchObject({ status: "caution" });
    expect(result.reasonDetails.join(" ")).toContain("운영 관측이 8기간 미만");
  });

  it("accepts standard cost as the PVM spend input", () => {
    const result = evaluateEligibility({
      toolId: "5-21",
      mapping: { Date: "date", Cost: "cost", Channel: "channel", Installs: "installs" },
      canonicalData,
    });
    expect(result).toMatchObject({ status: "ready" });
    expect(result.recommendationReason).toContain("최근 성과 변화의 원인");
  });

  it("warns when saturation data has no meaningful spend variation", () => {
    const result = evaluateEligibility({
      toolId: "5-22",
      mapping: { Date: "date", Cost: "cost", Channel: "channel", Installs: "installs" },
      canonicalData: efficiencyPanel(10, (day) => ["Google", "Meta"].map((channel) => ({
        date: isoDay(day), dimensions: { channel }, metrics: { cost: 100, installs: 10 + (day % 2) },
      }))),
    });
    expect(result).toMatchObject({ status: "caution" });
    expect(result.reasonDetails.join(" ")).toContain("지출 변동이 너무 작은");
  });
});
