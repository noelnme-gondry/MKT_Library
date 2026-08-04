import { describe, expect, it } from "vitest";
import { BRAND_ITS_CONTRACT, parseCampaignFlag, prepareBrandItsSeries, runBrandInterruptedTimeSeries } from "./brandIncrementalityMath";

function series({ pre = 24, post = 10, lift = 0 } = {}) {
  return Array.from({ length: pre + post }, (_, index) => {
    const date = new Date(Date.UTC(2025, 0, 1 + index)).toISOString().slice(0, 10);
    return { date, outcome: 100 + index * 2 + (index >= pre ? lift : 0), campaignOn: index >= pre ? "on" : "off" };
  });
}

describe("brand campaign ITS", () => {
  it("estimates a known post-campaign lift against the pre-period trend", () => {
    const result = runBrandInterruptedTimeSeries({ rows: series({ lift: 30 }) });
    expect(result.ok).toBe(true);
    expect(result.campaignStartDate).toBe("2025-01-25");
    expect(result.incrementalTotal).toBeCloseTo(300, 8);
    expect(result.counterfactualTotal).toBeCloseTo(1570, 8);
    expect(result.ci95[0]).toBeGreaterThan(0);
  });

  it("rejects a non-contiguous campaign window instead of inventing one counterfactual", () => {
    const rows = series();
    rows[28].campaignOn = "off";
    expect(runBrandInterruptedTimeSeries({ rows })).toMatchObject({ ok: false, status: "NOT_IDENTIFIED", reason: "multiple_campaign_windows" });
  });

  it("requires enough pre and post periods", () => {
    const result = runBrandInterruptedTimeSeries({ rows: series({ pre: 10, post: 3 }) });
    expect(BRAND_ITS_CONTRACT.minPrePeriods).toBe(21);
    expect(result).toMatchObject({ ok: false, status: "INSUFFICIENT_DATA", reason: "insufficient_pre_periods" });
  });

  it("aggregates same-date detail rows only when campaign state agrees", () => {
    const prepared = prepareBrandItsSeries([
      { date: "2025-01-01", outcome: "10", campaignOn: "0" },
      { date: "2025-01-01", outcome: "5", campaignOn: "off" },
    ]);
    expect(prepared).toMatchObject({ ok: true, points: [{ date: "2025-01-01", value: 15, isCampaignOn: false }] });
    expect(parseCampaignFlag("집행")).toBe(true);
    expect(parseCampaignFlag("paused")).toBe(false);
  });
});
