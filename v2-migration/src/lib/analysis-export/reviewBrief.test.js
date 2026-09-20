import { expect, it } from "vitest";
import { unzipSync, strFromU8 } from "fflate";
import { buildAnalysisExportPayload } from "./exportContract";
import { buildWeeklyReviewExport } from "./weeklyReviewExport";
import { buildReviewBrief, documentTableBands, reportCellText, renderAnalysisBrief } from "./reviewBrief";
import { createAnalysisDocument } from "./analysisDocument";
import { buildAnalysisWorkbook } from "./analysisWorkbook";

const successPlan = JSON.stringify({ method: "holdout", target: "Brand search", control: "Control regions", window: "Oct 1–14", mode: "increase_percent", baseline: "5000", value: "10", unit: "people", metric: "Organic users" });
const effectEvidence = JSON.stringify({ version: 1, headline: "Partial recovery estimate", stats: [{ label: "95% CI", value: "-100 to +700 people" }], points: [{ text: "Uncertain, not proof of no effect" }], scope: { start: "2026-10-01" } });
const record = { effectEvidence, reviewPlan: successPlan, targetActual: "5500", id: "d", toolId: "5-29", action: "국가별 구성 확인", conclusion: "구성 효과", learning: "국가 비중 변화를 분리", actual: "−4.2%", reviewDate: "2026-09-20", raw: [{ private: true }] };
it("keeps all columns and repeats the identifier without inventing formula values", () => {
  const headers = Array.from({ length: 13 }, (_, index) => `column-${index}`);
  const bands = documentTableBands([headers, ["campaign", ...Array.from({ length: 12 }, (_, index) => index)]]);
  expect(new Set(bands.flatMap(band => band[0]))).toEqual(new Set(headers));
  expect(bands.every(band => band[1][0] === "campaign")).toBe(true);
  expect(reportCellText({ formula: "=A1", value: null }, "en")).toContain("no cached result");
  expect(reportCellText({ formula: "=A1", value: 0 })).toBe("0");
});
it.each(["ko", "en"])("preserves evidence and saved feedback in the actual Word document (%s)", async locale => {
  const payload = buildAnalysisExportPayload({ toolId: "5-29", toolTitle: "Composition", locale, headline: "Observed shift", stats: [{ label: "Effect", value: "−4.2%", detail: "95% CI −6% ~ −2%" }], scope: { dateStart: "2026-09-01", currency: "KRW" }, reviewRecords: [record, { id: "followup", parentDecisionId: "d", action: "Extend holdout observation", reviewDate: "2026-10-15" }], addon: { calculationTables: [{ name: "WIDE", rows: [Array.from({ length: 13 }, (_, i) => `Header${i}`), ["campaign", 1, 2, 3, 4, 5, 6, 7, 8, { formula: "=A1", value: 7250 }, 10, 11, "Final observation"]] }], method: { limitations: ["Not causal"] } } });
  const doc = await createAnalysisDocument(payload);
  const xml = strFromU8(unzipSync(new Uint8Array(await doc.arrayBuffer()))["word/document.xml"]);
  expect(xml).toContain("Header12");
  expect(xml).toContain("Final observation");
  expect(xml).toContain("7,250");
  expect(xml).toContain("95% CI");
  expect(xml).toContain(record.learning);
  for (const value of ["Extend holdout observation", "2026-10-15", "Control regions", "Organic users", "5,500", "10%", "-100 to +700 people", "Uncertain, not proof of no effect", locale === "en" ? "effect evidence must be reviewed separately" : "효과 근거는 별도 검토"]) {
    expect(xml).toContain(value);
    expect(renderAnalysisBrief(payload)).toContain(value);
    expect(JSON.stringify(buildAnalysisWorkbook(payload).Sheets)).toContain(value);
  }
  expect(xml).not.toContain("private");
  expect(renderAnalysisBrief(payload)).toContain("2026-09-01");
  expect(renderAnalysisBrief(payload)).toContain("Not causal");
});
it("weekly export includes numeric KPI evidence instead of dropping the last columns", () => {
  const period = { start: "2026-09-01", end: "2026-09-07" };
  const payload = buildWeeklyReviewExport({ csvData: { raw: [] }, locale: "ko", text: "Review", evidence: { metric: "cpa", currency: "KRW", campaigns: [{ label: "Campaign", previous: { cost: 1000, conversions: 10, cpa: 100 }, current: { cost: 1500, conversions: 10, cpa: 150 }, deltaPct: .5, status: "comparable" }] }, review: { previous: { period }, current: { period: { start: "2026-09-08", end: "2026-09-14" } }, metrics: { previous: { cpa: 100, cost: 1000, conversions: 10 }, current: { cpa: 150, cost: 1500, conversions: 10 } } } });
  expect(payload.summary.stats[0]).toMatchObject({ label: "CPA", value: "150 KRW", detail: "지난 기간: 100 KRW" });
  expect(payload.calculationTables[0].rows[1][10]).toMatchObject({ value: 150 });
  const workbook = buildAnalysisWorkbook(payload);
  expect(workbook.Sheets.WEEKLY_CAMPAIGNS.K2).toMatchObject({ f: expect.any(String), v: 150 });
});

it("builds collected Word sections with per-tool scope, stats and uncertainty", async () => {
  const { buildCollectedReviewExport } = await import("./collectedReviewExport");
  const payload = buildCollectedReviewExport({ title: "Review", blocks: [{ toolId: "5-4", toolTitle: "Experiment", headline: "Inconclusive", points: ["Collect more data"], stats: [{ label: "Lift", displayValue: "3%", detail: "95% CI −2% ~ 8%" }], scope: { dateStart: "2026-09-01" } }], notes: [{ text: "Wait for full week" }] }, { locale: "en" });
  const xml = strFromU8(unzipSync(new Uint8Array(await (await createAnalysisDocument(payload)).arrayBuffer()))["word/document.xml"]);
  expect(xml).toContain("95% CI −2% ~ 8%");
  expect(xml).toContain("2026-09-01");
  expect(xml).toContain("Wait for full week");
  expect(xml).not.toContain("Statistical model estimates are browser-engine outputs");
});

it.each(["ko", "en"])("keeps zero baselines and next actions in reports (%s)", locale => {
  const review = buildReviewBrief({ locale, records: [
    { id: "parent", action: "Hold out search", metric: "Organic users", baseline: 0 },
    { id: "child", parentDecisionId: "parent", action: "Extend observation", reviewDate: "2026-10-10" },
  ] });
  const fields = review.decisions.find(item => item.action === "Hold out search").fields;
  expect(fields).toContainEqual([locale === "en" ? "Metric / baseline" : "지표 / 기준값", "Organic users / 0"]);
  const followup = fields.find(([label]) => label === (locale === "en" ? "Follow-up decisions" : "이어지는 다음 행동"))[1];
  expect(followup).toContain("Extend observation");
  expect(followup).toContain("2026-10-10");
});
