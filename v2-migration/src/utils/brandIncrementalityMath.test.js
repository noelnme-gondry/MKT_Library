import { describe, expect, it } from "vitest";
import { BRAND_ITS_CONTRACT, parseCampaignFlag, prepareBrandItsSeries, runBrandInterruptedTimeSeries } from "./brandIncrementalityMath";

const innovations = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8];

function series({ pre = 24, post = 10, lift = 0, rho = 0, intervalDays = 1 } = {}) {
  let previousError = 0;
  return Array.from({ length: pre + post }, (_, index) => {
    const innovation = innovations[index % innovations.length];
    const error = rho * previousError + innovation;
    previousError = error;
    const date = new Date(Date.UTC(2025, 0, 1 + index * intervalDays)).toISOString().slice(0, 10);
    return { date, outcome: 100 + index * 2 + error + (index >= pre ? lift : 0), campaignOn: index >= pre ? "on" : "off" };
  });
}

function monthlySeries({ pre = 12, post = 3, lift = 0 } = {}) {
  return Array.from({ length: pre + post }, (_, index) => ({
    date: new Date(Date.UTC(2024, index, 1)).toISOString().slice(0, 10),
    outcome: 100 + index * 3 + innovations[index % innovations.length] + (index >= pre ? lift : 0),
    campaignOn: index >= pre ? "on" : "off",
  }));
}

describe("brand campaign ITS", () => {
  it("uses a finite HAC interval for a known lift rather than a zero-noise point interval", () => {
    const result = runBrandInterruptedTimeSeries({ rows: series({ lift: 35, rho: 0.35 }) });
    expect(result.ok).toBe(true);
    expect(result.campaignStartDate).toBe("2025-01-25");
    expect(result.incrementalTotal).toBeGreaterThan(250);
    expect(result.counterfactualTotal).toBeGreaterThan(1500);
    expect(result.standardError).toBeGreaterThan(0);
    expect(result.ci95[1] - result.ci95[0]).toBeGreaterThan(0);
    expect(result.confidenceMethod).toBe("newey_west_hac");
  });

  it("widens uncertainty for positively autocorrelated pre-period residuals", () => {
    const result = runBrandInterruptedTimeSeries({ rows: series({ lift: 20, rho: 0.8 }) });
    expect(result.ok).toBe(true);
    expect(result.diagnostics.hacLag).toBe(BRAND_ITS_CONTRACT.hacLag(24));
    expect(result.standardError).toBeGreaterThan(result.iidStandardError);
  });

  it("refuses a perfect pre-period line because uncertainty cannot be estimated", () => {
    const rows = Array.from({ length: 31 }, (_, index) => ({
      date: new Date(Date.UTC(2025, 0, 1 + index)).toISOString().slice(0, 10),
      outcome: 100 + index * 2 + (index >= 24 ? 30 : 0),
      campaignOn: index >= 24 ? "on" : "off",
    }));
    expect(runBrandInterruptedTimeSeries({ rows })).toMatchObject({ ok: false, status: "NOT_IDENTIFIED", reason: "zero_pretrend_variance" });
  });

  it("does not mark the normal seven-day cadence as a date gap", () => {
    const result = runBrandInterruptedTimeSeries({ rows: series({ pre: 12, post: 4, lift: 25, rho: 0.2, intervalDays: 7 }) });
    expect(result.ok).toBe(true);
    expect(result.diagnostics).toMatchObject({ grain: "week", hasPeriodGaps: false, missingPeriods: 0, maxGapDays: 7 });
  });

  it("allows a monthly series with a monthly-appropriate minimum", () => {
    const result = runBrandInterruptedTimeSeries({ rows: monthlySeries({ lift: 20 }) });
    expect(result.ok).toBe(true);
    expect(result.diagnostics.grain).toBe("month");
  });

  it("rejects a non-contiguous campaign window instead of inventing one counterfactual", () => {
    const rows = series();
    rows[28].campaignOn = "off";
    expect(runBrandInterruptedTimeSeries({ rows })).toMatchObject({ ok: false, status: "NOT_IDENTIFIED", reason: "multiple_campaign_windows" });
  });

  it("requires enough pre and post periods for the detected grain", () => {
    const result = runBrandInterruptedTimeSeries({ rows: series({ pre: 10, post: 3 }) });
    expect(BRAND_ITS_CONTRACT.minPeriodsByGrain.day.pre).toBe(21);
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
