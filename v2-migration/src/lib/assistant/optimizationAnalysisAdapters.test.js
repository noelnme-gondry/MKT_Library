import { describe, expect, it } from "vitest";

import { buildVifSpendPanel } from "@/lib/analysis-router/vifReadiness";
import { getMappedRows } from "@/utils/dashboardAggregator";
import { buildAsaKeywordRecommendations } from "@/utils/asaKeywordMath";
import { computeVif } from "@/utils/modelDiagnostics";

import { validateAnalysisResult } from "./analysisResultContract";
import { OPTIMIZATION_TOOL_IDS, optimizationAdapterFor, runOptimizationAnalysis } from "./optimizationAnalysisAdapters";

const vifRaw = Array.from({ length: 18 }, (_, index) => ({
  Date: `2026-02-${String(index + 1).padStart(2, "0")}`,
  Channel: "Alpha",
  Spend: String(100 + index * 7 + (index % 3) * 5),
})).flatMap((row, index) => [
  row,
  { ...row, Channel: "Beta", Spend: String(80 + index * 11 + (index % 5) * 3) },
  { ...row, Channel: "Gamma", Spend: String(60 + ((index * 17) % 37)) },
]);

const vifCsvData = { raw: vifRaw, mapping: { Date: "date", Channel: "channel", Spend: "cost" } };

const asaRaw = [
  { Date: "2026-02-01", Campaign: "Discovery", Term: "budget app", Match: "Broad", Cost: "120", Taps: "12", Installs: "4", Budget: "500", TargetCPA: "40", CPT: "10" },
  { Date: "2026-02-02", Campaign: "Discovery", Term: "budget app", Match: "Broad", Cost: "120", Taps: "12", Installs: "4", Budget: "500", TargetCPA: "40", CPT: "10" },
  { Date: "2026-02-01", Campaign: "Generic", Term: "free budget", Match: "Search Match", Cost: "250", Taps: "20", Installs: "1", Budget: "100", TargetCPA: "60", CPT: "12" },
  { Date: "2026-02-02", Campaign: "Generic", Term: "free budget", Match: "Search Match", Cost: "250", Taps: "20", Installs: "1", Budget: "100", TargetCPA: "60", CPT: "12" },
];

const asaCsvData = {
  raw: asaRaw,
  mapping: { Date: "date", Campaign: "campaign_name", Term: "search_term", Match: "match_type", Cost: "cost", Taps: "clicks", Installs: "installs", Budget: "daily_budget", TargetCPA: "target_cpa", CPT: "current_cpt" },
};
const input = { inputSignature: "input-v1", mappingSignature: "mapping-v1" };

describe("Dochi optimization analysis adapters", () => {
  it("registers the independent VIF and ASA adapter surface", () => {
    expect(OPTIMIZATION_TOOL_IDS).toEqual(["5-25", "5-26"]);
    expect(OPTIMIZATION_TOOL_IDS.every((toolId) => optimizationAdapterFor(toolId))).toBe(true);
  });

  it("keeps VIF values aligned with the detailed tool engine", () => {
    const panel = buildVifSpendPanel(getMappedRows(vifCsvData).map((row) => ({ date: row.date, entity: row.channel || row.campaign_name, cost: row.cost ?? row.spend })));
    const expected = computeVif(panel.matrix);
    const actual = runOptimizationAnalysis({ toolId: "5-25", csvData: vifCsvData, ...input });
    expect(actual.status).toBe("success");
    expect(actual.verdict.stats).toContainEqual(expect.objectContaining({ id: "max-vif", value: expected.maxVif }));
    expect(actual.visualizations[0].table.rows).toEqual(expect.arrayContaining([expect.objectContaining({ entity: "Alpha", vif: expected.vif[0] })]));
  });

  it("reports singular VIF as not identified without inventing infinity", () => {
    const raw = Array.from({ length: 8 }, (_, index) => ({ Date: `2026-03-${String(index + 1).padStart(2, "0")}`, Channel: "Alpha", Spend: String(100 + index * 10) }))
      .flatMap((row) => [row, { ...row, Channel: "Beta", Spend: String(Number(row.Spend) * 2) }]);
    const actual = runOptimizationAnalysis({ toolId: "5-25", csvData: { raw, mapping: vifCsvData.mapping }, ...input });
    expect(actual.status).toBe("not_identified");
    expect(JSON.stringify(actual)).not.toContain("Infinity");
  });

  it("keeps ASA Exact and CPT action counts aligned with the detailed tool engine", () => {
    const expected = buildAsaKeywordRecommendations(getMappedRows(asaCsvData));
    const actual = runOptimizationAnalysis({ toolId: "5-26", csvData: asaCsvData, ...input });
    expect(actual.status).toBe("success");
    expect(actual.verdict.stats).toContainEqual(expect.objectContaining({ id: "exact-candidates", value: expected.filter((row) => row.isExactCandidate).length }));
    expect(actual.verdict.stats).toContainEqual(expect.objectContaining({ id: "raise-cpt", value: expected.filter((row) => row.action.code === "raise").length }));
    expect(actual.verdict.stats).toContainEqual(expect.objectContaining({ id: "lower-cpt", value: expected.filter((row) => row.action.code === "lower").length }));
  });

  it("keeps result manifests free from private CSV containers", () => {
    const actual = runOptimizationAnalysis({ toolId: "5-26", csvData: asaCsvData, ...input });
    expect(validateAnalysisResult(actual)).toEqual({ valid: true, errors: [] });
    expect(Object.keys(actual.manifest)).not.toEqual(expect.arrayContaining(["raw", "rows", "headers", "samples", "canonicalData"]));
  });
});
