import { describe, expect, it } from "vitest";
import { buildMappingContract } from "@/lib/data-import/mappingContract";
import { prepareImportedData } from "@/lib/data-import/dataPreparationWorkerClient";
import { evaluateV2Eligibility } from "@/lib/data-import/schema/toolDataRequirements";
import { projectSemanticBindingsToLegacyMapping } from "@/lib/data-import/canonical-v2/legacyProjection";
import { allocationCadence, prepareAllocationObservations, allocationHistory } from "./allocationObservations";
import { allocationPointMap, fitAllocationChannel } from "./allocationModels";
import { selectAllocationRegime } from "./allocationRegime";

describe("weekly allocation observations", () => {
  const rows = [
    { date: "2026-09-14", channel: "A", platform: "iOS", cost: 700, actions: 70, revenue_d7: 1400 },
    { date: "2026-09-21", channel: "A", platform: "iOS", cost: 1400, actions: 140, revenue_d7: 2800 },
    { date: "2026-09-28", channel: "A", platform: "iOS", cost: 2100, actions: 210, revenue_d7: 4200 },
    { date: "2026-10-05", channel: "A", platform: "iOS", cost: 2800, actions: 280, revenue_d7: 5600 },
  ];
  it("maps actual weekly extract names without changing other tools' date contract", () => {
    const source = [{ week_start: "2026-09-14", campaign_platform: "iOS", channel: "Meta", cost: "700", regs: "70", rev_d7: "1400", snapshot_date: "2026-10-08" }];
    const contract = buildMappingContract({ toolId: "5-3", headers: Object.keys(source[0]), rows: source });
    expect(contract.mapping.week_start).toBe("date");
    expect(contract.mapping.regs).toBe("actions");
    expect(contract.mapping.rev_d7).toBe("revenue_d7");
    expect(contract.requiredMissing).toEqual([]);
    expect(allocationCadence({ mapping: contract.mapping })).toBe("weekly");
    expect(allocationCadence({ mapping: { date: "date" } })).toBe("daily");
  });
  it("allows the same weekly extract through semantic readiness", async () => {
    const raw = Array.from({ length: 16 }, (_, i) => ({ week_start: new Date(Date.UTC(2026, 4, 4 + i * 7)).toISOString().slice(0, 10), campaign_platform: "iOS", channel: "Meta", cost: String(14000 + (i % 6) * 700), regs: String(140 + (i % 6) * 7), rev_d7: String(9800 + i * 100), snapshot_date: "2026-09-01" }));
    const prepared = await prepareImportedData({ toolId: "5-3", headers: Object.keys(raw[0]), raw });
    const readiness = evaluateV2Eligibility({ toolId: "5-3", bindings: prepared.semanticMapping.bindings });
    expect(readiness.status, JSON.stringify({ readiness, bindings: prepared.semanticMapping.bindings.map(binding => [binding.sourceColumn, binding.canonicalKey, binding.decision]) })).toBe("ready");
    expect(evaluateV2Eligibility({ toolId: "5-2", bindings: prepared.semanticMapping.bindings }).status).toBe("blocked");
    const projected = projectSemanticBindingsToLegacyMapping({ toolId: "5-3", legacyMapping: prepared.insights.mapping, bindings: prepared.semanticMapping.bindings.map(binding => ({ ...binding, source: "user" })) });
    expect(projected.week_start).toBe("date");
  });
  it("keeps one point per week and computes the daily baseline only once", () => {
    const output = prepareAllocationObservations(rows, { cadence: "weekly", asOfDate: "2026-10-08", metric: "actions" });
    expect(output.rows).toHaveLength(3);
    expect(output.rows[0].cost).toBe(100);
    expect(output.rows[2].revenue_d7).toBeNull();
    const points = allocationPointMap(output.rows, "channel", "actions");
    expect(points.get("A · iOS")).toHaveLength(3);
    const history = allocationHistory(output.rows, "channel", "A · iOS", "actions", { recentDays: 14 });
    expect(history.totalCost).toBe(250);
    expect(history.totalResults).toBe(25);
    expect(history.avgCPR).toBe(10);
    expect(rows[0].cost).toBe(700);
  });
  it("uses a conservative completed D7 window, keeps uncertainty distinct from zero", () => {
    const output = prepareAllocationObservations(rows, { cadence: "weekly", asOfDate: "2026-10-08", metric: "revenue_d7" });
    expect(output.rows.map(row => row.date)).toEqual(["2026-09-14", "2026-09-21"]);
    expect(output.excluded.map(item => item.reason)).toEqual(["IMMATURE_D7", "INCOMPLETE_PERIOD"]);
    const unknown = prepareAllocationObservations(rows, { cadence: "weekly", metric: "revenue_d7" });
    expect(unknown.rows).toHaveLength(0);
    expect(unknown.maturityKnown).toBe(false);
    expect(unknown.excluded.every(item => item.reason === "D7_AS_OF_MISSING")).toBe(true);
  });
  it("rejects overlapping, partial-week and invalid-value inputs", () => {
    const overlap = prepareAllocationObservations([rows[0], { ...rows[0], date: "2026-09-15" }], { cadence: "weekly", metric: "actions", matureRevenue: false });
    expect(overlap.rows).toHaveLength(0);
    expect(overlap.excluded.every(item => item.reason === "OVERLAPPING_PERIODS")).toBe(true);
    const partial = prepareAllocationObservations([rows[0]], { cadence: "weekly", metric: "actions", range: { start: "2026-09-14", end: "2026-09-16" } });
    expect(partial.rows).toHaveLength(0);
    expect(partial.excluded[0].reason).toBe("PARTIAL_SELECTED_PERIOD");
    expect(prepareAllocationObservations([{ ...rows[0], actions: "" }], { metric: "actions" }).excluded[0].reason).toBe("INVALID_MEASUREMENT");
  });
});

describe("allocation regime candidates", () => {
  const points = Array.from({ length: 24 }, (_, i) => ({ date: new Date(Date.UTC(2026, 0, i + 1)).toISOString().slice(0, 10), x: 100 + (i % 6) * 10, y: i < 12 ? 10 : 20 }));
  it("selects a persistent efficiency shift at comparable costs", () => {
    const regime = selectAllocationRegime(points, { regimeMode: "auto" });
    expect(regime.start).toBe("2026-01-13");
    expect(regime.kept).toHaveLength(12);
    expect(regime.candidate.relativeShift).toBe(1);
  });
  it("does not call a spend-range change or small sample a regime", () => {
    expect(selectAllocationRegime(points.map((p, i) => ({ ...p, x: i < 12 ? p.x : p.x + 1000 })), { regimeMode: "auto" }).start).toBe("");
    expect(selectAllocationRegime(points.slice(0, 8), { regimeMode: "auto" }).start).toBe("");
    const sameCurve = points.map(p => ({ ...p, y: 0.1 * p.x + 5 }));
    expect(selectAllocationRegime(sameCurve, { regimeMode: "auto" }).start).toBe("");
  });
  it("manual start affects model fitting and keeps explicit-model R² numeric", () => {
    const fitted = fitAllocationChannel(points, { regimeMode: "manual", regimeStart: "2026-01-13", trendType: "linear", outlierMethod: "none" });
    expect(fitted.kept).toHaveLength(12);
    expect(Number.isFinite(fitted.r2)).toBe(true);
    expect(fitted.regime.excluded).toBe(12);
  });
});
