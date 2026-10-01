import { buildCanonicalDataset } from "@/lib/data-import/buildCanonicalDataset";
import { evaluateEligibility } from "@/lib/analysis-router/evaluateEligibility";
import { mapDataset } from "@/lib/data-import/semantic-mapper/mapDataset";
import { evaluateV2Eligibility } from "@/lib/data-import/schema/toolDataRequirements";
import { describe, expect, it } from "vitest";
import { foldSteps, partitionForSync } from "./recipe";
import { recipeVocabularyFor } from "./toolVocabulary";
import { recipeRowSource } from "./recipeRows";
import { applySaturationView, legacySaturationSteps, prepareSaturationRows, saturationEntityNames, saturationSpec } from "./saturationRecipe";
import { satBuildPoints, SAT_MATH, SAT_CONFIG } from "@/utils/satMath";
import { buildMappingContract } from "@/lib/data-import/mappingContract";
import { listCandidates } from "@/lib/vocabulary/vocabulary";

const vocabulary = recipeVocabularyFor("5-22");
const fields = new Set(["channel", "campaign_name", "cost", "installs", "date"]);
const spec = saturationSpec(fields, null);
const context = { toolId: "5-22", toolSpec: spec, mappedFields: fields, headers: [] };

describe("saturation recipe contract", () => {
  it("accepts a real platform-only export in the upload contract", () => {
    const headers = ["Date", "OS", "Spend", "Installs"];
    const rows = Array.from({ length: 21 }, (_, index) => ({ Date: `2026-01-${String(index + 1).padStart(2, "0")}`, OS: "iOS", Spend: String(1000 + index * 100), Installs: "20" }));
    const contract = buildMappingContract({ headers, rows, toolId: "5-22" });
    expect(contract.requiredMissing).toEqual([]);
    const canonicalData = buildCanonicalDataset({ headers, raw: rows, mapping: contract.mapping });
    expect(evaluateEligibility({ toolId: "5-22", mapping: contract.mapping, canonicalData }).status).not.toBe("blocked");
    expect(evaluateV2Eligibility({ toolId: "5-22", bindings: mapDataset({ headers, rows }).bindings }).status).not.toBe("blocked");
    expect(saturationSpec(new Set(Object.values(contract.mapping)), null).defaults.levels).toEqual(["platform"]);
  });

  it("does not offer comparison periods, unsupported ROAS, or PVM improvement labels", () => {
    const ids = listCandidates(vocabulary, context).map((entry) => entry.id);
    expect(ids).not.toContain("metric.saturation.roas");
    expect(ids).not.toContain("view.only.worse");
    expect(ids.some((id) => id.startsWith("period."))).toBe(false);
    expect(ids).toContain("view.saturation.worse");
    expect(foldSteps([{ id: "metric.saturation.roas" }], vocabulary, spec, context).rejected[0].code).toBe("METRIC_NOT_SUPPORTED");
  });

  it("locks conclusion, average/marginal evidence and exclusion reasons", () => {
    for (const block of spec.blocks.filter((block) => block.locked)) {
      const result = foldSteps([{ id: "view.hide", params: { block: block.id } }], vocabulary, spec, context);
      expect(result.rejected[0].code).toBe("LOCKED_BLOCK");
      expect(result.state.view.hidden).toEqual([]);
    }
  });

  it("migrates legacy campaign/ROAS settings and excludes user values from account sync", () => {
    const steps = legacySaturationSteps({ grain: "campaign", metric: "roas" });
    const result = foldSteps(steps, vocabulary, saturationSpec(fields, "revenue_d7"), context);
    expect(result.state.data.levels).toEqual(["campaign_name"]);
    expect(result.state.data.metric).toBe("roas");
    const valueStep = { id: "filter.only.view", params: { field: "channel", values: ["Private client"] } };
    expect(partitionForSync([...steps, valueStep], vocabulary)).toEqual({ syncable: steps, deviceOnly: [valueStep] });
  });

  it("preserves engine points and results for the default axis and projects a different axis without changing math", () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({ channel: "Meta", platform: "iOS", date: `2026-01-${String(i + 1).padStart(2, "0")}`, cost: 1000 + 100 * i, installs: 10 + i }));
    const original = satBuildPoints(rows, "channel", "installs", null).get("Meta");
    const prepared = prepareSaturationRows(rows, { field: "channel" });
    expect(prepared.rows).toBe(rows);
    const projected = prepareSaturationRows(rows, { field: "platform" });
    const points = satBuildPoints(projected.rows, "channel", "installs", null).get("iOS");
    expect(points).toEqual(original);
    const baseline = SAT_MATH.analyzeEntity(original, SAT_CONFIG);
    expect(SAT_MATH.analyzeEntity(points, SAT_CONFIG)).toMatchObject({
      satIndex: baseline.satIndex, r2: baseline.r2, modelType: baseline.modelType,
      avgCpr: baseline.avgCpr, marginalCpr: baseline.marginalCpr, currentCost: baseline.currentCost,
    });
    expect(rows[0].channel).toBe("Meta");
  });

  it("uses metric-specific saturation verdicts and never mutates the full evidence", () => {
    const rows = [
      { name: "A", verdict: "saturated", roas: { verdict: "scale" } },
      { name: "B", verdict: "scale", roas: { verdict: "saturated" } },
    ];
    const options = { field: "channel", view: { only: "worse" } };
    expect(applySaturationView(rows, { ...options, metric: "cpa" }).rows.map((row) => row.name)).toEqual(["A"]);
    expect(applySaturationView(rows, { ...options, metric: "roas" }).rows.map((row) => row.name)).toEqual(["B"]);
    expect(rows).toHaveLength(2);
  });

  it("matches campaign view values to actual engine names, including channel prefixes", () => {
    const rows = ["Meta", "Google"].map((channel) => ({ channel, campaign_name: "Brand", cost: 100, installs: 10, date: "2026-01-01" }));
    const names = saturationEntityNames(rows, "campaign_name", "installs", null, false);
    const result = applySaturationView([{ name: "Meta · Brand" }, { name: "Google · Brand" }, { name: "Meta · Retargeting" }], {
      field: "campaign_name", view: {}, filters: [{ field: "campaign_name", scope: "view", op: "in", values: ["brand"] }], entityNames: names,
    });
    expect(result.rows.map((row) => row.name)).toEqual(["Meta · Brand", "Google · Brand"]);
  });

  it("keeps raw column projection aligned after summary/invalid-date exclusion and preserves existing mappings", () => {
    const csv = {
      headers: ["Date", "Channel", "Cost", "Region"],
      mapping: { Date: "date", Channel: "channel", Cost: "cost", Region: "country" },
      raw: [
        { Date: "2026-01-01", Channel: "Meta", Cost: "1,000", Region: "KR" },
        { Date: "invalid", Channel: "Meta", Cost: "2,000", Region: "US" },
        { Date: "2026-01-02", Channel: "Google", Cost: "3,000", Region: "JP" },
      ],
    };
    const source = recipeRowSource(csv, ["col:Region", "col:Cost"], "5-22");
    expect(source.mappedRows.map((row) => [row.date, row.cost, row.country, row["col:Region"], row["col:Cost"]])).toEqual([
      ["2026-01-01", "1000", "KR", "KR", "1,000"],
      ["2026-01-02", "3000", "JP", "JP", "3,000"],
    ]);
    expect(csv.mapping.Region).toBe("country");
    expect(csv.raw).toHaveLength(3);
  });
});
