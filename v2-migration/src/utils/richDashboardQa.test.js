import { describe, expect, it } from "vitest";
import {
  calculateKPIs,
  computeWeightedRetention,
  effectiveDenomBasis,
  hasUsableDenomBasis,
  getMappedRows,
  getMonFilteredRows,
} from "./dashboardAggregator.js";
import { buildFunnelData } from "./funnelMath.js";
import { buildMaturationRows } from "./cohortMath.js";

// 리치 CSV 정합 QA: 효율 대시보드가 함께 소비하는 비용·퍼널·리텐션·Dn 매출을
// 하나의 업로드 형태로 주입한다. 기대값은 입력값에서 독립적으로 계산한 고정값이다.
const mapping = {
  Date: "date", Channel: "channel", OS: "platform", Country: "country",
  Cost: "cost", Impressions: "impressions", Clicks: "clicks",
  Installs: "installs", Actions: "actions", RevenueD0: "revenue_d0",
  RevenueD7: "revenue_d7", RevenueD30: "revenue_d30", PurchasesD7: "pu_d7",
  RetentionD7: "ret_d7", RetentionD30: "ret_d30",
};

const raw = [
  { Date: "2026-07-01", Channel: "Meta", OS: "iOS", Country: "KR", Cost: "1000", Impressions: "10000", Clicks: "500", Installs: "100", Actions: "40", RevenueD0: "1000", RevenueD7: "2000", RevenueD30: "3600", PurchasesD7: "10", RetentionD7: "0.5", RetentionD30: "0.2" },
  { Date: "2026-07-01", Channel: "Google", OS: "Android", Country: "KR", Cost: "3000", Impressions: "30000", Clicks: "900", Installs: "300", Actions: "60", RevenueD0: "3000", RevenueD7: "6000", RevenueD30: "10800", PurchasesD7: "30", RetentionD7: "0.8", RetentionD30: "0.4" },
  { Date: "2026-07-02", Channel: "Meta", OS: "iOS", Country: "KR", Cost: "2000", Impressions: "20000", Clicks: "800", Installs: "200", Actions: "80", RevenueD0: "2000", RevenueD7: "4000", RevenueD30: "7200", PurchasesD7: "20", RetentionD7: "0.25", RetentionD30: "0.1" },
  { Date: "2026-07-02", Channel: "Google", OS: "Android", Country: "KR", Cost: "6000", Impressions: "80000", Clicks: "1200", Installs: "400", Actions: "200", RevenueD0: "4000", RevenueD7: "9000", RevenueD30: "14400", PurchasesD7: "40", RetentionD7: "0.75", RetentionD30: "0.5" },
];

const csvData = { raw, mapping };
const rows = getMappedRows(csvData);
const mappedKeys = new Set(Object.values(mapping));

describe("rich dashboard CSV QA", () => {
  it("maps, filters, and aggregates the complete efficiency CSV without losing fields", () => {
    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({ cost: "1000", spend: "1000", revenue_d30: "3600", ret_d30: "0.2" });
    const google = getMonFilteredRows(csvData, {
      dateStart: "2026-07-01", dateEnd: "2026-07-02",
      platforms: new Set(["Android"]), countries: new Set(["KR"]),
      channels: new Set(["Google"]), sources: null,
    });
    expect(google).toHaveLength(2);
    expect(google.reduce((sum, row) => sum + Number(row.cost), 0)).toBe(9000);
  });

  it("falls back from an all-zero install column to usable actions", () => {
    const csvData = {
      raw: [{ Installs: "0", Actions: "1,200" }, { Installs: "0", Actions: "8" }],
      mapping: { Installs: "installs", Actions: "actions" },
    };
    expect(hasUsableDenomBasis(csvData, "installs")).toBe(false);
    expect(hasUsableDenomBasis(csvData, "actions")).toBe(true);
    expect(effectiveDenomBasis(csvData, "installs")).toBe("actions");
  });

  it("keeps KPI totals and the installs/actions denominator toggle mathematically consistent", () => {
    expect(effectiveDenomBasis(csvData, "actions")).toBe("actions");
    const installs = calculateKPIs(rows, 7, "installs");
    expect(installs).toMatchObject({
      cost: 12000, impressions: 140000, clicks: 3400, installs: 1000,
      actions: 380, revenue: 21000, purchases: 100, denom: 1000,
    });
    expect(installs.cpm).toBeCloseTo(85.7142857);
    expect(installs.ctr).toBeCloseTo(3400 / 140000);
    expect(installs.cpi).toBeCloseTo(12);
    expect(installs.cvr).toBeCloseTo(1000 / 3400);
    expect(installs.roas).toBeCloseTo(1.75);
    expect(installs.arpu).toBeCloseTo(21);

    const actions = calculateKPIs(rows, 7, "actions");
    expect(actions.denom).toBe(380);
    expect(actions.cpi).toBeCloseTo(12000 / 380);
    expect(actions.cvr).toBeCloseTo(380 / 3400);
    expect(actions.arpu).toBeCloseTo(21000 / 380);
    expect(actions.roas).toBeCloseTo(installs.roas);
  });

  it("uses weighted retention rather than a misleading arithmetic average", () => {
    const d7Installs = computeWeightedRetention(rows, 7, "installs");
    const d30Installs = computeWeightedRetention(rows, 30, "installs");
    const d7Actions = computeWeightedRetention(rows, 7, "actions");
    expect(d7Installs).toMatchObject({ rate: 0.64, survivors: 640, denom: 1000, isRate: true });
    expect(d30Installs).toMatchObject({ rate: 0.36, survivors: 360, denom: 1000, isRate: true });
    expect(d7Actions.rate).toBeCloseTo(238 / 380);
  });

  it("preserves full-funnel totals and channel-level conversion rates", () => {
    const funnel = buildFunnelData(rows, mappedKeys, {
      unitField: "channel", cvrStep: 2, weekdayAdj: false,
    });
    expect(funnel.overall).toMatchObject({ impr: 140000, clk: 3400, inst: 1000, act: 380, rev: 21000 });
    expect(funnel.selCvr).toBeCloseTo(1000 / 3400);
    const meta = funnel.rows.find((row) => row.unit === "Meta");
    const google = funnel.rows.find((row) => row.unit === "Google");
    expect(meta.steps.map((step) => step.count)).toEqual([30000, 1300, 300, 120]);
    expect(google.steps.map((step) => step.count)).toEqual([110000, 2100, 700, 260]);
  });

  it("keeps D0/D7/D30 revenue maturity inputs aligned by channel", () => {
    const maturation = buildMaturationRows(raw, mapping, { unitField: "channel", anchorDns: [0, 7, 30] });
    expect(maturation.availDns).toEqual([0, 7, 30]);
    const meta = maturation.units.find((unit) => unit.unit === "Meta");
    const google = maturation.units.find((unit) => unit.unit === "Google");
    expect(meta.cost).toBe(3000);
    expect(meta.roas).toMatchObject({ 0: 1, 7: 2, 30: 3.6 });
    expect(google.cost).toBe(9000);
    expect(google.roas).toMatchObject({ 0: 7 / 9, 7: 15 / 9, 30: 25.2 / 9 });
  });
});
