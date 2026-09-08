import fs from "node:fs";
import path from "node:path";
import Papa from "papaparse";
import { expect, it } from "vitest";
import { prepareDatasetForTool } from "./data-import/prepareDatasetForTool";
import { getMappedRows } from "@/utils/dashboardAggregator";
import { classifyStoreShift, decomposeStoreConversion } from "@/utils/asoStoreMath";
import { buildAsaKeywordRecommendations } from "@/utils/asaKeywordMath";
import { qualifyAsaRecommendations } from "@/utils/asaRecommendationQuality";

function load(name, toolId) {
  const csv = Papa.parse(fs.readFileSync(path.join(process.cwd(), "public/examples", name), "utf8"), { header: true, skipEmptyLines: true });
  expect(csv.errors).toEqual([]);
  return getMappedRows(prepareDatasetForTool({ raw: csv.data, headers: csv.meta.fields, toolId }));
}
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
