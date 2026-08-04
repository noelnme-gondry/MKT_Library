import { describe, expect, it } from "vitest";
import { BRAND_ITS_CONTRACT, parseCampaignFlag, prepareBrandItsSeries, runBrandInterruptedTimeSeries } from "./brandIncrementalityMath";

function seededInnovations(length, seed = 20260805) {
  let state = seed >>> 0;
  return Array.from({ length }, () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return ((state / 4294967296) - 0.5) * 12;
  });
}

function series({ pre = 24, post = 10, lift = 0, rho = 0, intervalDays = 1 } = {}) {
  const innovations = seededInnovations(pre + post);
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
  const innovations = seededInnovations(pre + post);
  return Array.from({ length: pre + post }, (_, index) => ({
    date: new Date(Date.UTC(2024, index, 1)).toISOString().slice(0, 10),
    outcome: 100 + index * 3 + innovations[index % innovations.length] + (index >= pre ? lift : 0),
    campaignOn: index >= pre ? "on" : "off",
  }));
}

describe("brand campaign ITS", () => {
  it("uses a finite AR(1) interval for a known lift rather than a zero-noise point interval", () => {
    const result = runBrandInterruptedTimeSeries({ rows: series({ lift: 35, rho: 0.35 }) });
    expect(result.ok).toBe(true);
    expect(result.campaignStartDate).toBe("2025-01-25");
    expect(result.incrementalTotal).toBeGreaterThan(250);
    expect(result.counterfactualTotal).toBeGreaterThan(1500);
    expect(result.standardError).toBeGreaterThan(0);
    expect(result.ci95[1] - result.ci95[0]).toBeGreaterThan(0);
    expect(result.confidenceMethod).toBe("ar1_prais_winsten");
  });

  it("uses AR(1) as the primary interval and retains corrected HAC only as a reference diagnostic", () => {
    const result = runBrandInterruptedTimeSeries({ rows: series({ lift: 20, rho: 0.8 }) });
    expect(result.ok).toBe(true);
    expect(result.diagnostics.residualAr1).toBeGreaterThan(0);
    expect(result.diagnostics.hacLag).toBeGreaterThanOrEqual(BRAND_ITS_CONTRACT.hacLag(24));
    expect(result.diagnostics).toMatchObject({ hacBandwidthMethod: "andrews_ar1_bartlett", ar1EvidenceTier: "exploratory" });
    expect(result.diagnostics.hacFiniteSampleScale).toBeCloseTo(24 / 22, 12);
    expect(result.diagnostics.hacReferenceStandardError).toBeGreaterThan(0);
    expect(result.standardError).toBeGreaterThan(0);
  });

  it("adds a deterministic rho profile interval without changing the current result contract", () => {
    const result = runBrandInterruptedTimeSeries({ rows: series({ pre: 150, post: 10, lift: 20, rho: 0.8 }) });
    expect(result.ok).toBe(true);
    expect(result.confidenceMethod).toBe("ar1_prais_winsten");
    expect(result.profileInterval).toHaveLength(2);
    expect(result.profileTrend).toMatchObject({ intercept: expect.any(Number), slope: expect.any(Number) });
    expect(result.diagnostics.ar1Profile.rhoMle).toBeGreaterThan(0.5);
    expect(result.diagnostics.ar1Profile.rhoInterval[0]).toBeLessThanOrEqual(result.diagnostics.ar1Profile.rhoMle);
    expect(result.diagnostics.ar1Profile.rhoInterval[1]).toBeGreaterThanOrEqual(result.diagnostics.ar1Profile.rhoMle);
    expect(result.profileInterval[0]).toBeLessThanOrEqual(result.diagnostics.ar1Profile.conditionalInterval[0]);
    expect(result.profileInterval[1]).toBeGreaterThanOrEqual(result.diagnostics.ar1Profile.conditionalInterval[1]);
    expect(result.profileInterval[1] - result.profileInterval[0]).toBeGreaterThanOrEqual(result.ci95[1] - result.ci95[0]);
  });

  it("keeps short histories explicitly exploratory even when the rho profile is available", () => {
    const result = runBrandInterruptedTimeSeries({ rows: series({ pre: 24, post: 10, lift: 20, rho: 0.85 }) });
    expect(result.ok).toBe(true);
    expect(result.diagnostics.ar1EvidenceTier).toBe("exploratory");
    expect(result.profileInterval).toHaveLength(2);
    expect(result.diagnostics.ar1Profile.acceptedFits).toBeGreaterThan(1);
  });

  it("increases the Bartlett bandwidth as residual autocorrelation rises", () => {
    const n = 150;
    expect(BRAND_ITS_CONTRACT.hacLag(n, 0.85)).toBeGreaterThan(BRAND_ITS_CONTRACT.hacLag(n, 0.5));
    expect(BRAND_ITS_CONTRACT.hacLag(n, 0.5)).toBeGreaterThan(BRAND_ITS_CONTRACT.hacLag(n, 0));
  });

  it("uses the Andrews univariate Bartlett plug-in rather than the old (1-rho)^4 expression", () => {
    const n = 150;
    const rho = 0.85;
    const alpha = (4 * rho ** 2) / (1 - rho ** 2) ** 2;
    const expected = Math.min(n - 2, Math.max(Math.floor(4 * (n / 100) ** (2 / 9)), Math.floor(1.1447 * (alpha * n) ** (1 / 3))));
    expect(BRAND_ITS_CONTRACT.hacLag(n, rho)).toBe(expected);
  });

  it("uses the stationary AR(1) covariance exactly for the future residual-sum variance", () => {
    const result = runBrandInterruptedTimeSeries({ rows: series({ pre: 150, post: 10, rho: 0.8 }) });
    expect(result.ok).toBe(true);
    const rho = result.diagnostics.residualAr1;
    const periods = result.postPeriods;
    let multiplier = periods;
    for (let offset = 1; offset < periods; offset += 1) multiplier += 2 * (periods - offset) * rho ** offset;
    expect(result.diagnostics.ar1FutureVariance).toBeCloseTo(result.diagnostics.ar1ResidualVariance * multiplier, 10);
  });

  it("widens the primary AR(1) interval as controlled persistence rises", () => {
    const ratios = [0, 0.45, 0.8].map((rho) => {
      const result = runBrandInterruptedTimeSeries({ rows: series({ pre: 300, post: 10, rho }) });
      expect(result.ok).toBe(true);
      return result.standardError / result.iidStandardError;
    });
    expect(ratios[1]).toBeGreaterThanOrEqual(ratios[0]);
    expect(ratios[2]).toBeGreaterThanOrEqual(ratios[1]);
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
