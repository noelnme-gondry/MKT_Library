import fs from "node:fs";
import path from "node:path";
import Papa from "papaparse";
import { expect, it } from "vitest";
import { prepareDatasetForTool } from "./data-import/prepareDatasetForTool";
import { getMappedRows } from "@/utils/dashboardAggregator";
import { classifyStoreShift, decomposeStoreConversion } from "@/utils/asoStoreMath";
import { buildAsaKeywordRecommendations } from "@/utils/asaKeywordMath";
import { qualifyAsaRecommendations } from "@/utils/asaRecommendationQuality";
import { calculateMarketingMetric } from "./calculators";
import { METRIC_BY_ID } from "@/utils/metrics/metricRegistry";

function load(name, toolId) {
  const csv = Papa.parse(fs.readFileSync(path.join(process.cwd(), "public/examples", name), "utf8"), { header: true, skipEmptyLines: true });
  expect(csv.errors).toEqual([]);
  return getMappedRows(prepareDatasetForTool({ raw: csv.data, headers: csv.meta.fields, toolId }));
}
it("reproduces the published Korean metric and uplift examples with existing engines", () => {
  expect(METRIC_BY_ID.cpi.compute({ cost: 5000000, denom: 5000 })).toBe(1000);
  expect(calculateMarketingMetric("roas", { adSpend: 5000000, revenue: 15000000 }).primary).toBe(3);
  const uplift = calculateMarketingMetric("uplift", { treatmentUsers: 1000, treatmentConversions: 80, controlUsers: 1000, controlConversions: 50 });
  expect(uplift.primary).toBeCloseTo(0.03, 12);
  expect(uplift.secondary).toBeCloseTo(0.6, 12);
  const arpu = METRIC_BY_ID.arpu.compute({ revenue: 3000000, denom: 1000 });
  const arppu = METRIC_BY_ID.arppu.compute({ revenue: 3000000, purchases: 30 });
  expect(arppu / arpu).toBeCloseTo(100 / 3, 12);
});
it("reproduces marketing analysis totals and the performance-marketing profitability example", () => {
  const parsed = Papa.parse(fs.readFileSync(path.join(process.cwd(), "public/examples/weekly-report-campaigns.csv"), "utf8"), { header: true, skipEmptyLines: true });
  expect(parsed.errors).toEqual([]);
  const total = rows => rows.reduce((sum, row) => ({ cost: sum.cost + Number(row.cost), installs: sum.installs + Number(row.installs) }), { cost: 0, installs: 0 });
  const before = total(parsed.data.filter(row => row.date < "2026-09-07"));
  const after = total(parsed.data.filter(row => row.date >= "2026-09-07"));
  expect(before).toEqual({ cost: 700000, installs: 700 });
  expect(after).toEqual({ cost: 840000, installs: 700 });
  const campaignA = total(parsed.data.filter(row => row.date >= "2026-09-07" && row.campaign_id === "A"));
  expect(campaignA).toEqual({ cost: 420000, installs: 280 });
  expect(campaignA.cost / campaignA.installs).toBe(1500);
  expect(calculateMarketingMetric("roas", { adSpend: 1000000, revenue: 3000000 }).primary).toBe(3);
  expect(calculateMarketingMetric("break-even-roas", { grossMarginPct: 25, variableFeePct: 0 }).primary).toBe(4);
  expect(3000000 * 0.25 - 1000000).toBe(-250000);
});
it("reproduces the ASO article from real export-shaped headers", () => {
  const rows = load("aso-mix-only.csv", "5-27").map((row) => ({ date: row.date, source: row.store_source, views: row.product_page_views, installs: row.installs }));
  const result = decomposeStoreConversion(rows.filter((row) => row.date < "2026-08-03"), rows.filter((row) => row.date >= "2026-08-03"));
  expect(result.funnelBefore.viewToInstall).toBeCloseTo(0.34, 12);
  expect(result.funnelAfter.viewToInstall).toBeCloseTo(0.16, 12);
  expect(classifyStoreShift(result).totals.rate).toBeCloseTo(0, 12);
});
it("reproduces the ASA case and holds it until maturity is declared", () => {
  const rules = buildAsaKeywordRecommendations(load("asa-mature-candidate.csv", "5-26"));
  expect(rules).toHaveLength(1);
  const [result] = qualifyAsaRecommendations(rules, "mature");
  expect(result.taps).toBe(40);
  expect(result.installs).toBe(12);
  expect(result.cpa).toBeCloseTo(4000 / 12, 10);
  expect(result.recommendedCpt).toBeCloseTo(115, 10);
  expect(result.isExactCandidate).toBe(true);
  expect(qualifyAsaRecommendations(rules)[0].recommendedCpt).toBeNull();
});
it("the sparse saturation case has one observation per channel", () => {
  const rows = load("saturation-sparse.csv", "5-22");
  expect(rows).toHaveLength(24);
  expect(new Set(rows.map((row) => row.channel)).size).toBe(24);
  expect(new Set(rows.map((row) => row.date)).size).toBe(8);
});
