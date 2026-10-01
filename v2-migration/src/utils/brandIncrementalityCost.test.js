import { describe, expect, it } from "vitest";
import { summarizeBrandCampaignCost, brandIncrementalUnitCost } from "./brandIncrementalityCost";

const points = [{ date: "2025-01-01", isCampaignOn: false }, { date: "2025-01-02", isCampaignOn: true }, { date: "2025-01-03", isCampaignOn: true }];
const rows = [{ date: "2025-01-01", campaignOn: "off", cost: 999 }, { date: "2025-01-02", campaignOn: "on", cost: "1,000" }, { date: "2025-01-03", campaignOn: "on", cost: 500 }];
describe("brand campaign cost overlay", () => {
  it("sums only the model's campaign dates, including additive rows on one date", () => {
    expect(summarizeBrandCampaignCost({ rows: [...rows, { date: "2025-01-02", campaignOn: 1, cost: 100 }, { date: "2025-01-04", campaignOn: 1, cost: 9999 }], points, hasCostColumn: true })).toMatchObject({ ok: true, total: 1600, periods: 2 });
  });
  it.each(["", "bad", -1, Infinity])("rejects missing/invalid campaign cost %s instead of partial totals", cost => {
    expect(summarizeBrandCampaignCost({ rows: [rows[0], rows[1], { ...rows[2], cost }], points, hasCostColumn: true })).toMatchObject({ ok: false, total: null });
  });
  it("distinguishes explicit zero, missing column, missing dates and excluded outcome rows", () => {
    expect(summarizeBrandCampaignCost({ rows: rows.map(row => ({ ...row, cost: 0 })), points, hasCostColumn: true }).total).toBe(0);
    expect(summarizeBrandCampaignCost({ rows, points }).reason).toBe("missing_column");
    expect(summarizeBrandCampaignCost({ rows: rows.slice(0, 2), points, hasCostColumn: true }).reason).toBe("incomplete_cost");
    expect(summarizeBrandCampaignCost({ rows, points, hasCostColumn: true, invalidOutcomeRows: 1 }).reason).toBe("invalid_outcome_rows");
  });
  it("divides by incremental outcomes, reversing the positive interval endpoints", () => {
    expect(brandIncrementalUnitCost({ spend: { ok: true, total: 200 }, estimate: 100, interval: [50, 200], referenceOnly: true })).toEqual({ value: 2, range: [1, 4], status: "reference", reason: null });
  });
  it.each([-1, null, Infinity, NaN])("rejects invalid totals even in a claimed valid summary", total => {
    expect(brandIncrementalUnitCost({ spend: { ok: true, total }, estimate: 10, interval: [5, 20] }).value).toBeNull();
  });
  it.each([[0, [-10, 10]], [-2, [-5, -1]], [10, [-1, 20]], [10, [0, 20]], [10, null]])("withholds a ratio for an unidentified positive increment", (estimate, interval) => {
    expect(brandIncrementalUnitCost({ spend: { ok: true, total: 100 }, estimate, interval }).value).toBeNull();
  });
});
