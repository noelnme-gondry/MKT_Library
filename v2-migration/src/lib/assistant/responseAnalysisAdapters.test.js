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

function monthlyTrendCsvData(periodCount, { includeSpend = true } = {}) {
  const raw = Array.from({ length: periodCount }, (_, index) => ({
    Date: new Date(Date.UTC(2025, index, 1)).toISOString().slice(0, 10),
    Registrations: String(900 + index * 23 + (index % 3) * 7),
    ...(includeSpend ? { "Meta Spend": String(500 + index * 11) } : {}),
  }));
  const headers = includeSpend ? trendCsvData.headers : ["Date", "Registrations"];
  const mapping = includeSpend
    ? trendCsvData.mapping
    : { Date: "date", Registrations: "mmm_reg" };
  return { raw, headers, mapping };
}

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

  // 월 단위 입력에서는 경계 달의 완결 여부를 확인할 수 없다. 진단만 만들고 카드가
  // 말하지 않으면 사용자가 뒤집을 근거를 못 받으므로, caveat 도달까지 고정한다(§16).
  it("tells the reader that a monthly panel cannot verify its boundary months", () => {
    const monthlyCsvData = monthlyTrendCsvData(18);

    const actualKo = runResponseAnalysis({ toolId: "5-18-trend", csvData: monthlyCsvData, locale: "ko", ...signatures });
    const actualEn = runResponseAnalysis({ toolId: "5-18-trend", csvData: monthlyCsvData, locale: "en", ...signatures });

    expect(actualKo.status).toBe("success");
    expect(actualKo.manifest.sourceCadence).toBe("monthly");
    expect(actualKo.manifest.observedPeriodCount).toBe(18);
    expect(actualKo.manifest.observedMonthCount).toBe(18);
    expect(actualKo.manifest).not.toHaveProperty("observedWeekCount");
    expect(actualKo.verdict.headline).toContain("월간");
    expect(actualKo.verdict.headline).not.toContain("주간");
    expect(actualKo.verdict.caveats.some((text) => text.includes("완결된 달인지 확인할 수 없습니다"))).toBe(true);
    expect(actualEn.verdict.headline).toContain("monthly");
    expect(actualEn.verdict.headline).not.toContain("weekly");
  });

  it("does not add the monthly boundary caveat to a weekly panel", () => {
    const actual = runResponseAnalysis({ toolId: "5-18-trend", csvData: trendCsvData, locale: "ko", ...signatures });
    expect(actual.verdict.caveats.some((text) => text.includes("완결된 달인지"))).toBe(false);
    expect(actual.manifest.sourceCadence).toBe("weekly");
    expect(actual.manifest.observedPeriodCount).toBe(16);
    expect(actual.manifest.observedWeekCount).toBe(16);
    expect(actual.manifest).not.toHaveProperty("observedMonthCount");
  });

  it("preserves the weekly minimum-period reason and manifest alias", () => {
    const actual = runResponseAnalysis({
      toolId: "5-18-trend",
      csvData: { ...trendCsvData, raw: trendRaw.slice(0, 2) },
      locale: "en",
      ...signatures,
    });

    expect(actual.status).toBe("not_computable");
    expect(actual.manifest.reason).toBe("insufficient_weeks");
    expect(actual.manifest.sourceCadence).toBe("weekly");
    expect(actual.manifest.observedPeriodCount).toBe(2);
    expect(actual.manifest.observedWeekCount).toBe(2);
    expect(actual.manifest).not.toHaveProperty("observedMonthCount");
    expect(actual.verdict.headline).toContain("weeks");
    expect(actual.verdict.headline).not.toContain("months");
  });

  it.each([
    ["ko", "월", "주차"],
    ["en", "month", "week"],
  ])("uses monthly mapping language for %s when cadence is monthly", (locale, expected, unexpected) => {
    const actual = runResponseAnalysis({
      toolId: "5-18-trend",
      csvData: monthlyTrendCsvData(4, { includeSpend: false }),
      locale,
      ...signatures,
    });

    expect(actual.status).toBe("not_computable");
    expect(actual.manifest.sourceCadence).toBe("monthly");
    expect(actual.manifest.observedPeriodCount).toBe(4);
    expect(actual.manifest.observedMonthCount).toBe(4);
    expect(actual.verdict.headline).toContain(expected);
    expect(actual.verdict.headline).not.toContain(unexpected);
  });

  it.each([
    ["ko", "월", "주차"],
    ["en", "months", "weeks"],
  ])("uses a monthly minimum-period contract for %s", (locale, expected, unexpected) => {
    const actual = runResponseAnalysis({
      toolId: "5-18-trend",
      csvData: monthlyTrendCsvData(2),
      locale,
      ...signatures,
    });

    expect(actual.status).toBe("not_computable");
    expect(actual.manifest.reason).toBe("insufficient_months");
    expect(actual.manifest.sourceCadence).toBe("monthly");
    expect(actual.manifest.observedPeriodCount).toBe(2);
    expect(actual.manifest.observedMonthCount).toBe(2);
    expect(actual.manifest).not.toHaveProperty("observedWeekCount");
    expect(actual.verdict.headline).toContain(expected);
    expect(actual.verdict.headline).not.toContain(unexpected);
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
