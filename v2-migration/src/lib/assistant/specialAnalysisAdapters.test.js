import { describe, expect, it } from "vitest";

import { buildCreativeQuickSummary } from "@/lib/analysis-results/creativeQuickSummary";
import { classifyStoreShift, decomposeStoreConversion } from "@/utils/asoStoreMath";
import { validateAnalysisResult } from "./analysisResultContract";
import { SPECIAL_TOOL_IDS, runSpecialAnalysis, specialAdapterFor } from "./specialAnalysisAdapters";

const input = { inputSignature: "input-v1", mappingSignature: "mapping-v1" };

function storeCsv() {
  const raw = Array.from({ length: 8 }, (_, index) => {
    const date = `2026-02-${String(index + 1).padStart(2, "0")}`;
    const isLater = index >= 4;
    return [
      { Date: date, Source: "Search", Views: isLater ? "300" : "700", Installs: isLater ? "150" : "350" },
      { Date: date, Source: "Browse", Views: isLater ? "700" : "300", Installs: isLater ? "70" : "30" },
    ];
  }).flat();
  return {
    raw,
    mapping: { Date: "date", Source: "store_source", Views: "product_page_views", Installs: "installs" },
  };
}

function creativeCsv() {
  const raw = Array.from({ length: 16 }, (_, day) => ["A", "B"].map((creativeId, index) => {
    const impressions = 4_000 + index * 200;
    const ctr = creativeId === "A" ? Math.max(0.008, 0.08 - day * 0.005) : 0.045;
    return {
      Date: `2026-03-${String(day + 1).padStart(2, "0")}`,
      Creative: creativeId,
      Impressions: String(impressions),
      Clicks: String(Math.round(impressions * ctr)),
    };
  })).flat();
  return {
    raw,
    mapping: { Date: "date", Creative: "creative_id", Impressions: "impressions", Clicks: "clicks" },
  };
}

describe("Dochi special analysis adapters", () => {
  it("registers the ASO and creative adapter surface", () => {
    expect(SPECIAL_TOOL_IDS).toEqual(["5-27", "9-6"]);
    expect(SPECIAL_TOOL_IDS.every((toolId) => specialAdapterFor(toolId))).toBe(true);
  });

  it("keeps the ASO mix verdict and primary conversion series aligned with asoStoreMath", () => {
    const csvData = storeCsv();
    const expected = classifyStoreShift(decomposeStoreConversion(
      [
        { source: "Search", views: 2_800, installs: 1_400 },
        { source: "Browse", views: 1_200, installs: 120 },
      ],
      [
        { source: "Search", views: 1_200, installs: 600 },
        { source: "Browse", views: 2_800, installs: 280 },
      ],
    ));
    const actual = runSpecialAnalysis({ toolId: "5-27", csvData, ...input });
    expect(actual.status).toBe("success");
    expect(actual.manifest.verdict).toBe(expected.verdict);
    expect(actual.visualizations[0].data.dates).toHaveLength(8);
    expect(actual.visualizations[0].data.overall.at(0)).toBeCloseTo(0.38, 12);
  });

  it("keeps the creative headline counts aligned with the creative quick summary", () => {
    const csvData = creativeCsv();
    const expected = buildCreativeQuickSummary(csvData);
    const actual = runSpecialAnalysis({ toolId: "9-6", csvData, ...input });
    expect(actual.status).toBe("success");
    expect(actual.verdict.stats).toContainEqual(expect.objectContaining({ id: "creative-count", value: expected.creativeCount }));
    expect(actual.verdict.stats).toContainEqual(expect.objectContaining({ id: "fatigued-count", value: expected.fatiguedCount }));
    expect(actual.visualizations[0].data.reduce((sum, row) => sum + row.count, 0)).toBe(expected.creativeCount);
  });

  it("withholds an ASO result when there are too few dates", () => {
    const csvData = storeCsv();
    const actual = runSpecialAnalysis({
      toolId: "5-27",
      csvData: { ...csvData, raw: csvData.raw.slice(0, 6) },
      ...input,
    });
    expect(actual.status).toBe("not_computable");
    expect(actual.verdict.evidenceState).toBe("not_computable");
  });

  it("returns only derived result data and no private CSV containers in the manifest", () => {
    const actual = runSpecialAnalysis({ toolId: "9-6", csvData: creativeCsv(), ...input });
    expect(validateAnalysisResult(actual)).toEqual({ valid: true, errors: [] });
    expect(Object.keys(actual.manifest)).not.toEqual(expect.arrayContaining(["raw", "rows", "headers", "samples", "canonicalData"]));
  });
});
