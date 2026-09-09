import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { unzipSync, strFromU8 } from "fflate";
import { buildAnalysisExportPayload } from "./exportContract";
import { createAnalysisDocument } from "./analysisDocument";
import { writeAnalysisWorkbook } from "./analysisWorkbook";
import { buildWeeklyReviewExport } from "./weeklyReviewExport";
import { runReview, kpiFor } from "../weekly-review/reviewPipeline";
import { buildWorkspaceEvidence } from "../weekly-review/workspaceEvidence";

describe("paid report files", () => {
  it.each(["cpi", "roas", "conversions"])("exports observed inputs through the real weekly pipeline (%s)", metric => {
    const rows = [
      { date: "2026-08-30", campaign_name: "A", cost: 100, actions: 10, installs: 20, revenue: 300 },
      { date: "2026-09-06", campaign_name: "A", cost: 200, actions: 30, installs: 40, revenue: 500 },
    ];
    const project = { kpi: kpiFor(metric), currency: "KRW" };
    const review = runReview({ rows, project });
    expect(review.ok).toBe(true);
    const evidence = buildWorkspaceEvidence(review, project);
    const payload = buildWeeklyReviewExport({ locale: "en", text: "Review", csvData: { raw: rows }, review, evidence });
    const sheet = XLSX.read(writeAnalysisWorkbook(payload), { type: "array", cellFormula: true }).Sheets.WEEKLY_CAMPAIGNS;
    expect([sheet.D2.v, sheet.E2.v, sheet.H2.v, sheet.I2.v]).toEqual([20, 300, 40, 500]);
    expect(sheet.K2.f).toBe(metric === "cpi" ? 'IF(AND(ISNUMBER(F2),ISNUMBER(H2),H2>0),F2/H2,"")' : metric === "roas" ? 'IF(AND(ISNUMBER(F2),F2>0,ISNUMBER(I2)),I2/F2,"")' : 'IF(ISNUMBER(G2),G2,"")');
  });
  it.each(["ko", "en"])("creates real Word content with evidence and limitations (%s)", async locale => {
    const payload = buildAnalysisExportPayload({ toolId: "5-2", toolTitle: "Operations", locale, headline: "Observed change <not causal>", points: [{ text: "Check attribution delay" }], source: { rows: [{ cost: "100" }] }, addon: { method: { name: "Comparison", limitations: ["No control group"] } } });
    const blob = await createAnalysisDocument(payload);
    const zip = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    const xml = strFromU8(zip["word/document.xml"]);
    expect(xml).toContain("Observed change &lt;not causal&gt;"); expect(xml).toContain("Check attribution delay"); expect(xml).toContain("No control group");
  });
  it("stores editable native charts and preserves null observations instead of zero", () => {
    const payload = buildAnalysisExportPayload({ toolId: "5-2", headline: "Result" });
    payload.charts = [{ title: "Cost & result", type: "line", labels: ["Before", "After"], series: [{ label: "CPA", values: [{ x: 0, y: 10 }, { x: 1, y: null }] }] }];
    const bytes = writeAnalysisWorkbook(payload);
    const zip = unzipSync(new Uint8Array(bytes));
    const chart = strFromU8(zip["xl/charts/chart1.xml"]);
    expect(chart).toContain("Cost &amp; result"); expect(chart).toContain("09_CHART_DATA"); expect(chart).toContain('<c:dispBlanksAs val="gap"/>');
    expect(chart).not.toContain('<c:pt idx="1"><c:v>0</c:v>');
    const workbook = XLSX.read(bytes, { type: "array" });
    expect(workbook.Sheets["09_CHART_DATA"].B3.v).toBe(10);
    expect(workbook.Sheets["09_CHART_DATA"].B4?.v).toBeUndefined();
  });
  it("keeps stopped-campaign CPA unscored in live Excel formulas", () => {
    const period = { start: "2026-09-01", end: "2026-09-07" };
    const payload = buildWeeklyReviewExport({ locale: "en", text: "Review", csvData: { raw: [] }, review: { previous: { period }, current: { period } }, evidence: { metric: "cpa", currency: "KRW", campaigns: [{ label: "Stopped", previous: { cost: 100, conversions: 10 }, current: { cost: 0, conversions: 0 }, status: "unknown" }] } });
    const workbook = XLSX.read(writeAnalysisWorkbook(payload), { type: "array", cellFormula: true });
    expect(workbook.Sheets.WEEKLY_CAMPAIGNS.K2.f).toContain('G2>0');
    expect(workbook.Sheets.WEEKLY_CAMPAIGNS.K2.f).toContain(',"")');
    expect(workbook.Sheets.WEEKLY_CAMPAIGNS.L2.f).toContain('ISNUMBER(K2)');
  });
});
