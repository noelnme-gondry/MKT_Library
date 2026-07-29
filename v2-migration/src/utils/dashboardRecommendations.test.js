import { describe, expect, it } from "vitest";
import { buildDashboardRecommendations } from "./dashboardRecommendations";

function verdict({ days = 28, snapshot = "high", metricRows = [] } = {}) {
  return {
    insufficient: false,
    days,
    conversionKey: "inst",
    efficiencyKey: "cpi",
    metricRows,
    retentionSnapshot: { confidence: snapshot },
  };
}

const fullMapping = {
  Date: "date", Spend: "cost", Impressions: "impressions", Clicks: "clicks",
  Installs: "installs", Actions: "actions", RevenueD7: "revenue_d7", RetD7: "ret_d7",
  Channel: "channel",
};

describe("buildDashboardRecommendations", () => {
  it("ranks a ready funnel first when its action signal is strongest", () => {
    const result = buildDashboardRecommendations({
      mapping: fullMapping,
      verdict: verdict({ metricRows: [
        { key: "cost", wow: 0.08 }, { key: "inst", wow: -0.32 },
        { key: "cpi", wow: 0.59 }, { key: "roas", wow: -0.12 }, { key: "ret", wow: -0.08 },
      ] }),
    });

    expect(result.recommendations).toHaveLength(3);
    expect(result.recommendations[0].tab).toBe("funnel");
    expect(result.recommendations[0].reason).toContain("전환량");
    expect(result.recommendations.every((item) => item.confidence !== "low")).toBe(true);
  });

  it("does not offer cohort analysis when the retention snapshot is not reliable", () => {
    const result = buildDashboardRecommendations({
      mapping: fullMapping,
      verdict: verdict({ snapshot: "low", metricRows: [{ key: "inst", wow: -0.1 }, { key: "cpi", wow: 0.12 }] }),
    });

    expect(result.recommendations.some((item) => item.tab === "cohort")).toBe(false);
    expect(result.additional.some((item) => item.tab === "cohort")).toBe(false);
  });

  it("keeps cohort analysis closed when snapshot evidence is unknown", () => {
    const result = buildDashboardRecommendations({
      mapping: fullMapping,
      verdict: verdict({ snapshot: "unknown", metricRows: [{ key: "ret", wow: -0.2 }] }),
    });

    expect(result.recommendations.some((item) => item.tab === "cohort")).toBe(false);
  });

  it("limits the content dashboard to its honest three-view set and translates its rationale", () => {
    const result = buildDashboardRecommendations({
      domain: "content",
      locale: "en",
      mapping: { Date: "date", Clicks: "clicks", Cost: "cost" },
      verdict: verdict({ days: 14, metricRows: [{ key: "cost", wow: 0.2 }] }),
    });

    expect(result.recommendations.map((item) => item.tab)).toEqual(["anomaly", "scorecard", "viz"]);
    expect(result.recommendations[0].reason).toMatch(/Spend changed/);
    expect(result.label).toMatch(/ranked by the clearest action/);
  });
});
