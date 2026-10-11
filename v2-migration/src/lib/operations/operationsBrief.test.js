import { buildOperationsDemo } from "./operationsDemo";
import { getMappedRows } from "@/utils/dashboardAggregator";
import { dashboardPeriods } from "@/lib/analysis-results/dashboardPeriods";
import { buildMappingContract } from "@/lib/data-import/mappingContract";
import { describe, expect, it } from "vitest";
import { prepareOperationsBrief, planOperationsBudget, operationsTotals } from "./operationsBrief";

function fixture() {
  const rows = [];
  for (let day = 0; day < 70; day++) for (let campaign = 0; campaign < 2; campaign++) {
    const date = new Date(Date.UTC(2026, 6, 1 + day)).toISOString().slice(0, 10);
    const cost = 100000 + (day % 11) * 14000;
    const cpr = (campaign ? 1800 : 600) + cost * (campaign ? 0.006 : 0.001);
    const installs = cost / cpr;
    const creativeParts = campaign === 0 && day >= 63 ? [["established", 0.7], ["new", 0.3]] : [["established", 1]];
    for (const [creative, share] of creativeParts) rows.push({ date, cost: cost * share, installs: installs * share,
      impressions: installs * 200 * share, clicks: installs * 10 * share, country: "KR", platform: "iOS", channel: "Meta",
      campaign_id: `id-${campaign}`, campaign_name: `Campaign ${campaign}`, creative_id: creative });
  }
  return { rows, periods: { current: { start: "2026-09-02", end: "2026-09-08" }, previous: { start: "2026-08-26", end: "2026-09-01" } },
    metric: "installs", mappedFields: ["cost", "installs", "impressions", "clicks", "creative_id"] };
}

describe("operations brief composition", () => {
  it("conserves the same budget, honors caps and compares two predictions from the same models", () => {
    const brief = prepareOperationsBrief(fixture());
    const plan = planOperationsBudget(brief);
    expect(brief.budgetHolds).toEqual([]);
    expect(plan.ok).toBe(true);
    expect(plan.items.reduce((sum, row) => sum + row.budget, 0)).toBeCloseTo(plan.totalBudget, 6);
    expect(plan.expectedResults).toBeGreaterThan(plan.baselineResults);
    expect(plan.baselineCpr).toBeCloseTo(plan.totalBudget / plan.baselineResults, 9);
    for (const row of plan.items) {
      expect(Math.abs(row.budget / row.current - 1)).toBeLessThanOrEqual(0.200000001);
      expect(row.budget).toBeGreaterThanOrEqual(row.min - 1e-6);
      expect(row.budget).toBeLessThanOrEqual(row.max + 1e-6);
    }
    const unchanged = planOperationsBudget(brief, { changeLimit: 0 });
    expect(unchanged.ok).toBe(true);
    expect(unchanged.improvementPct).toBeCloseTo(0, 10);
    unchanged.items.forEach(row => expect(row.budget).toBeCloseTo(row.current, 6));
  });

  it("keeps first observations campaign-scoped and excludes future history", () => {
    const input = fixture();
    input.rows.push({ ...input.rows[0], date: "2026-09-09", creative_id: "future", cost: 1e9 });
    const brief = prepareOperationsBrief(input);
    expect(brief.creatives.filter(row => row.creative === "established")).toHaveLength(2);
    expect(brief.creatives.filter(row => row.isNew).map(row => row.creative)).toEqual(["new"]);
    expect(brief.creatives.find(row => row.creative === "new").firstDate).toBe("2026-09-02");
    expect(brief.creatives.some(row => row.creative === "future")).toBe(false);
    expect([...brief.models.values()].every(model => model.scopeEnd <= input.periods.current.end)).toBe(true);
    expect(planOperationsBudget(brief).totalBudget).toBeCloseTo(brief.current.cost / brief.days, 8);
  });

  it("uses aggregate ratios and existing exact PVM/stage identities", () => {
    const brief = prepareOperationsBrief(fixture());
    for (const campaign of brief.campaigns) {
      expect(campaign.current.cpr).toBeCloseTo(campaign.current.cost / campaign.current.results, 10);
      expect(campaign.pvm).not.toBeNull();
      expect(campaign.pvm.finest.reduce((sum, row) => sum + row.contribution, 0)).toBeCloseTo(campaign.pvm.deltaCpa, 8);
      expect(campaign.stages.ok).toBe(true);
      expect(campaign.stages.stages.reduce((sum, row) => sum + row.contribution, 0)).toBeCloseTo(campaign.stages.delta, 8);
    }
  });

  it.each([["missing", ""], ["outcomes", 0]])("withholds the whole forecast for %s instead of hiding the affected entity", (reason, installs) => {
    const input = fixture();
    input.rows[0].installs = installs;
    const brief = prepareOperationsBrief(input);
    const plan = planOperationsBudget(brief);
    expect(plan.ok).toBe(false);
    expect(plan.holds.some(hold => hold.reason === reason)).toBe(true);
    expect(plan.expectedResults).toBeNull();
    expect(plan.items).toEqual([]);
  });

  it("withholds daily forecasts when campaign coverage is missing or data is weekly", () => {
    const input = fixture();
    input.rows = input.rows.filter(row => !(row.date === "2026-09-04" && row.campaign_id === "id-1"));
    expect(planOperationsBudget(prepareOperationsBrief(input)).holds.some(hold => hold.reason === "cadence")).toBe(true);
    const weekly = fixture();
    weekly.rows = weekly.rows.filter(row => new Date(row.date).getUTCDay() === 3);
    expect(planOperationsBudget(prepareOperationsBrief(weekly)).ok).toBe(false);
  });

  it("keeps duplicate campaign labels separate across channel/platform/country", () => {
    const input = fixture();
    input.rows.forEach(row => { row.campaign_name = "Same name"; });
    input.rows.push(...input.rows.filter(row => row.campaign_id === "id-0").map(row => ({ ...row, channel: "Google", country: "US" })));
    const brief = prepareOperationsBrief(input);
    expect(brief.campaigns).toHaveLength(3);
    expect(new Set(brief.campaigns.map(row => row.id)).size).toBe(3);
    expect(planOperationsBudget(brief).holds.some(hold => hold.reason === "countries")).toBe(true);
  });

  it("preserves unavailable outcomes and never turns a new campaign into a zero-cost comparison", () => {
    expect(operationsTotals([{ cost: 100, installs: "" }], "installs").cpr).toBeNull();
    expect(operationsTotals([{ cost: 100, installs: 0 }], "installs").cpr).toBeNull();
    const input = fixture();
    input.rows = input.rows.filter(row => row.campaign_id !== "id-1" || row.date >= "2026-09-02");
    const campaign = prepareOperationsBrief(input).campaigns.find(row => row.name === "Campaign 1");
    expect(campaign.previous.cpr).toBeNull();
    expect(campaign.changePct).toBeNull();
  });

  it("withholds poorly identified models and unsupported constraints", () => {
    const input = fixture();
    input.rows.forEach(row => { row.cost = 100000; row.installs = 50; });
    const plan = planOperationsBudget(prepareOperationsBrief(input));
    expect(plan.ok).toBe(false);
    expect(plan.holds.some(hold => ["confidence", "range"].includes(hold.reason))).toBe(true);
    expect(planOperationsBudget(prepareOperationsBrief(fixture()), { changeLimit: NaN }).holds[0].reason).toBe("constraints");
  });
});


describe("operations planner sample", () => {
  it("maps export-style headers and demonstrates all three decisions from one dataset", () => {
    const data = buildOperationsDemo();
    const contract = buildMappingContract({ headers: data.headers, rows: data.raw, toolId: "5-31", source: "csv" });
    expect(Object.values(contract.mapping)).toEqual(expect.arrayContaining(["cost", "installs", "campaign_id", "creative_id", "date"]));
    const brief = prepareOperationsBrief({ rows: getMappedRows(data), periods: dashboardPeriods(data, {}, 7), mappedFields: Object.values(data.mapping) });
    const plan = planOperationsBudget(brief);
    expect(brief.campaigns).toHaveLength(4);
    expect(brief.creatives.filter(row => row.isNew)).toHaveLength(2);
    expect(brief.creatives.filter(row => row.isNew).every(row => row.vsEstablishedPct < 0)).toBe(true);
    expect(brief.campaigns.find(row => row.name.includes("리타기팅")).changePct).toBeGreaterThan(15);
    expect(plan.holds).toEqual([]);
    expect(plan.ok).toBe(true);
    expect(plan.improvementPct).toBeGreaterThan(0);
    expect(plan.totalBudget).toBeCloseTo(brief.current.cost / brief.days, 7);
  });
});
