import { describe, expect, it } from "vitest";

import { buildPanelFromColMap } from "@/components/tools/MmmColumnMapper";
import { MMM_METH_CONFIG, mmmTrendExistence } from "@/utils/mmmMath";
import { buildPaidOrganicTrend, guessPaidOrganicColumns } from "@/utils/paidOrganicTrend";

import { validateAnalysisResult } from "./analysisResultContract";
import {
  buildResponseAdapterColMap,
  RESPONSE_ANALYSIS_TOOL_IDS,
  responseAdapterFor,
  runResponseAnalysis,
} from "./responseAnalysisAdapters";

const trendRaw = Array.from({ length: 16 }, (_, index) => ({
  Date: new Date(Date.UTC(2026, 0, 5 + index * 7)).toISOString().slice(0, 10),
  Registrations: String(900 + index * 23 + (index % 3) * 7),
  "Meta Spend": String(500 + index * 11),
}));
const trendCsvData = {
  raw: trendRaw,
  headers: ["Date", "Registrations", "Meta Spend"],
  mapping: { Date: "date", Registrations: "mmm_reg", "Meta Spend": "ch_meta" },
};

const paidOrganicRaw = Array.from({ length: 8 }, (_, index) => ({
  week: new Date(Date.UTC(2026, 1, 2 + index * 7)).toISOString().slice(0, 10),
  total_signups: String(1200 + index * 8),
  paid_signups: String(260 + index * 35),
}));
const paidOrganicCsvData = {
  raw: paidOrganicRaw,
  headers: ["week", "total_signups", "paid_signups"],
  mapping: {},
};
const signatures = { inputSignature: "input-v1", mappingSignature: "mapping-v1" };

describe("Dochi response analysis adapters", () => {
  it("registers only the two safe baseline response analyses", () => {
    expect(RESPONSE_ANALYSIS_TOOL_IDS).toEqual(["5-18-trend", "5-18-paid-organic"]);
    expect(RESPONSE_ANALYSIS_TOOL_IDS.every((toolId) => responseAdapterFor(toolId))).toBe(true);
  });

  it("keeps the technical-trend percentage aligned with the existing MMM trend engine", () => {
    const colMap = buildResponseAdapterColMap(trendCsvData);
    const panel = buildPanelFromColMap(trendCsvData.headers, trendCsvData.raw, colMap, "all", "en", null, { weekStart: "monday" }).panel;
    const expected = mmmTrendExistence(panel, { ...MMM_METH_CONFIG, absorbed: new Set() }, "Regs", "en");
    const actual = runResponseAnalysis({ toolId: "5-18-trend", csvData: trendCsvData, locale: "en", ...signatures });

    expect(actual.status).toBe("success");
    expect(actual.verdict.stats).toContainEqual(expect.objectContaining({ id: "trend-change-pct", value: expected.stl_pct }));
    expect(actual.manifest.target).toBe("Regs");
    expect(actual.visualizations[0].data).toHaveLength(panel.week.length);
  });

  it("keeps the paid-organic movement verdict aligned with the existing movement-map engine", () => {
    const expected = buildPaidOrganicTrend(paidOrganicRaw, guessPaidOrganicColumns(paidOrganicCsvData.headers));
    const actual = runResponseAnalysis({ toolId: "5-18-paid-organic", csvData: paidOrganicCsvData, locale: "en", ...signatures });

    expect(actual.status).toBe("success");
    expect(actual.manifest.verdict).toBe(expected.verdict);
    expect(actual.verdict.stats).toContainEqual(expect.objectContaining({ id: "opposite-direction-weeks", value: expected.oppositeCount }));
    expect(actual.visualizations[0].data).toHaveLength(expected.recent.length);
  });

  it("abstains when the technical-trend data contract is incomplete", () => {
    const actual = runResponseAnalysis({
      toolId: "5-18-trend",
      csvData: { raw: trendRaw, headers: ["Date", "Registrations"], mapping: { Date: "date", Registrations: "mmm_reg" } },
      ...signatures,
    });

    expect(actual.status).toBe("not_computable");
    expect(actual.verdict.evidenceState).toBe("not_computable");
  });

  it("abstains when the movement map cannot make a week-over-week comparison", () => {
    const actual = runResponseAnalysis({
      toolId: "5-18-paid-organic",
      csvData: { raw: paidOrganicRaw.slice(0, 1), headers: paidOrganicCsvData.headers, mapping: {} },
      ...signatures,
    });

    expect(actual.status).toBe("not_computable");
    expect(actual.manifest.reason).toBe("insufficient_weeks");
  });

  it("never copies source rows or headers into the result manifest", () => {
    for (const [toolId, csvData] of [["5-18-trend", trendCsvData], ["5-18-paid-organic", paidOrganicCsvData]]) {
      const result = runResponseAnalysis({ toolId, csvData, ...signatures });
      expect(validateAnalysisResult(result)).toEqual({ valid: true, errors: [] });
      expect(Object.keys(result.manifest)).not.toEqual(expect.arrayContaining(["raw", "rows", "headers", "samples", "canonicalData"]));
    }
  });
});
