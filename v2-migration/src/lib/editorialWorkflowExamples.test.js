import fs from "node:fs";
import path from "node:path";
import Papa from "papaparse";
import { expect, it } from "vitest";
import { prepareDatasetForTool } from "./data-import/prepareDatasetForTool";
import { getMappedRows } from "@/utils/dashboardAggregator";
import { getPostBySlug } from "./blog";

function fixture(name) {
  const text = fs.readFileSync(path.join(process.cwd(), "public/examples", name), "utf8");
  expect(text).toMatch(/^\uFEFF/);
  expect(text).toContain("\r\n");
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  expect(parsed.errors).toEqual([]);
  return parsed;
}

it.each(["5-21", "5-2"])("weekly CSV reaches %s with the article's actual totals", toolId => {
  const parsed = fixture("weekly-report-campaigns.csv");
  const rows = getMappedRows(prepareDatasetForTool({ raw: parsed.data, headers: parsed.meta.fields, toolId }));
  expect(rows).toHaveLength(28);
  expect(new Set(rows.map(row => row.date)).size).toBe(14);
  const totals = subset => subset.reduce((sum, row) => ({ cost: sum.cost + Number(row.cost), installs: sum.installs + Number(row.installs) }), { cost: 0, installs: 0 });
  const before = totals(rows.filter(row => row.date < "2026-09-07"));
  const after = totals(rows.filter(row => row.date >= "2026-09-07"));
  expect(before).toEqual({ cost: 700000, installs: 700 });
  expect(after).toEqual({ cost: 840000, installs: 700 });
  const campaignKey = toolId === "5-21" ? "campaign_id" : "campaign_name";
  expect(new Set(rows.map(row => row[campaignKey]))).toEqual(new Set(["A", "B"]));
  const campaignA = totals(rows.filter(row => row.date >= "2026-09-07" && row[campaignKey] === "A"));
  const campaignB = totals(rows.filter(row => row.date >= "2026-09-07" && row[campaignKey] === "B"));
  expect(campaignA.cost / campaignA.installs).toBe(1500);
  expect(campaignB.cost / campaignB.installs).toBe(1000);
});

it("monthly source values reproduce observed recovery, distinct from interpolation", () => {
  const rows = fixture("cac-payback-monthly.csv").data;
  expect(new Set(rows.map(row => row.cohort)).size).toBe(1);
  const target = Number(rows[0].acquisition_cost_krw);
  expect(target / Number(rows[0].new_customers)).toBe(100000);
  let sum = 0;
  const cumulative = rows.map(row => {
    expect(Number(row.acquisition_cost_krw)).toBe(target);
    sum += Number(row.gross_revenue_krw) - Number(row.refunds_krw) - Number(row.variable_cost_krw);
    return sum;
  });
  expect(cumulative).toEqual([2000000, 4500000, 7000000, 9000000, 10500000]);
  expect(cumulative.findIndex(value => value >= target) + 1).toBe(5);
  expect(cumulative.slice(0, 3).findIndex(value => value >= target)).toBe(-1);
  expect(4 + (target - cumulative[3]) / (cumulative[4] - cumulative[3])).toBeCloseTo(14 / 3, 12);
});

it.each(["ko", "en"])("%s worksheets are writing resources and GA4 has seven actual checks", locale => {
  const blank = fixture(`weekly-report-template-${locale}.csv`).data;
  const filled = fixture(`weekly-report-filled-${locale}.csv`).data;
  expect(blank).toHaveLength(8);
  expect(filled).toHaveLength(8);
  expect(blank.every(row => Object.values(row)[1] === "")).toBe(true);
  expect(filled.every(row => Object.values(row)[1].length > 0)).toBe(true);
  expect(blank.map(row => Object.values(row)[0])).toEqual(filled.map(row => Object.values(row)[0]));
  const post = getPostBySlug("ga4-data-traps", locale);
  const checks = [...post.html.matchAll(/<h2[^>]*>(?:함정|Trap) (\d)\./g)].map(match => Number(match[1]));
  expect(checks).toEqual([1, 2, 3, 4, 5, 6, 7]);
  expect(post.title).toContain("7");
});

it.each(["5-21", "5-2"])("three-week review preserves the baseline and actual totals in %s", toolId => {
  const parsed = fixture("weekly-report-three-weeks.csv");
  expect(parsed.data.slice(0, 28)).toEqual(fixture("weekly-report-campaigns.csv").data);
  const rows = getMappedRows(prepareDatasetForTool({ raw: parsed.data, headers: parsed.meta.fields, toolId }));
  expect(rows).toHaveLength(42);
  const current = rows.filter(row => row.date >= "2026-09-14");
  expect(current).toHaveLength(14);
  const sum = (list, key) => list.reduce((n, row) => n + Number(row[key]), 0);
  expect(sum(current, "cost")).toBe(840000);
  expect(sum(current, "installs")).toBe(770);
  const key = toolId === "5-21" ? "campaign_id" : "campaign_name";
  const a = current.filter(row => row[key] === "A");
  expect(sum(a, "installs")).toBe(350);
  expect(sum(a, "cost") / sum(a, "installs")).toBe(1200);
  for (const locale of ["ko", "en"]) {
    const report = fixture(`weekly-report-followup-${locale}.csv`).data;
    expect(report).toHaveLength(9);
    expect(Object.values(report.at(-1))[1]).toMatch(/추정 불가|unidentified/);
  }
});
