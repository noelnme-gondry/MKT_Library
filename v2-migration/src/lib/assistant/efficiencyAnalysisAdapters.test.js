import { describe, expect, it } from "vitest";

import { buildDashboardVerdict } from "@/utils/dashboardVerdict";
import { PVM_MATH } from "@/utils/pvmMath";
import { SAT_CONFIG, SAT_MATH, satBuildPoints } from "@/utils/satMath";
import { validateAnalysisResult } from "./analysisResultContract";
import { EFFICIENCY_TOOL_IDS, efficiencyAdapterFor, runEfficiencyAnalysis } from "./efficiencyAnalysisAdapters";

const raw = Array.from({ length: 14 }, (_, day) => {
  const date = `2026-01-${String(day + 1).padStart(2, "0")}`;
  return [
    { Date: date, Channel: "Alpha", Spend: String(100 + day * 5), Installs: String(10 + day), Actions: String(4 + Math.floor(day / 2)) },
    { Date: date, Channel: "Beta", Spend: String(80 + day * 2), Installs: String(12 + Math.floor(day / 2)), Actions: String(5 + Math.floor(day / 3)) },
  ];
}).flat();

const mapping = { Date: "date", Channel: "channel", Spend: "cost", Installs: "installs", Actions: "actions" };
const csvData = { raw, mapping, fileName: "fixture.csv" };
const input = { csvData, inputSignature: "input-v1", mappingSignature: "mapping-v1" };

describe("Dochi efficiency analysis adapters", () => {
  it("registers exactly the reusable efficiency-family adapter surface", () => {
    expect(EFFICIENCY_TOOL_IDS).toEqual(["5-2", "5-21", "5-22", "5-3"]);
    expect(EFFICIENCY_TOOL_IDS.every((toolId) => efficiencyAdapterFor(toolId))).toBe(true);
  });

  it("keeps the dashboard verdict headline and metric table aligned with the existing engine", () => {
    const expected = buildDashboardVerdict({ csvData, windowDays: 7 });
    const actual = runEfficiencyAnalysis({ toolId: "5-2", ...input });
    expect(actual.status).toBe("success");
    expect(actual.verdict.headline).toBe(expected.headline);
    expect(actual.visualizations[0]).toMatchObject({ kind: "bar", options: { variant: "period-comparison" } });
    expect(actual.visualizations[0].table.rows.find((row) => row.metric === "cost")).toMatchObject({
      prior: expected.metricRows.find((row) => row.key === "cost").prev,
      recent: expected.metricRows.find((row) => row.key === "cost").recent,
    });
  });

  it("keeps PVM total unit costs aligned with PVM_MATH", () => {
    const rows = raw.map((row) => ({ date: row.Date, channel: row.Channel, cost: row.Spend, installs: row.Installs, actions: row.Actions, spend: row.Spend }));
    const expected = PVM_MATH.decomposeFinest(rows.slice(0, 14), rows.slice(14), { ch: "channel", cmp: null, cr: null, resultField: "installs" });
    const actual = runEfficiencyAnalysis({ toolId: "5-21", ...input });
    expect(actual.status).toBe("success");
    expect(actual.verdict.stats).toContainEqual(expect.objectContaining({ id: "prior-unit-cost", value: expected.CPA1 }));
    expect(actual.verdict.stats).toContainEqual(expect.objectContaining({ id: "recent-unit-cost", value: expected.CPA2 }));
  });

  it("keeps saturation analyzable counts aligned with SAT_MATH", () => {
    const rows = raw.map((row) => ({ date: row.Date, channel: row.Channel, cost: Number(row.Spend), installs: Number(row.Installs) }));
    const expected = [...satBuildPoints(rows, "channel", "installs", null).values()]
      .map((points) => SAT_MATH.analyzeEntity(points, SAT_CONFIG))
      .filter((entry) => entry.ok && entry.verdict).length;
    const actual = runEfficiencyAnalysis({ toolId: "5-22", ...input });
    expect(actual.status).toBe("success");
    expect(actual.verdict.stats).toContainEqual(expect.objectContaining({ id: "analyzable", value: expected }));
    expect(actual.visualizations[0]).toMatchObject({ kind: "bar", options: { x: "entity", y: "saturationIndex" } });
    expect(actual.visualizations[0].table.rows).toHaveLength(expected);
  });

  it("returns a safe estimated baseline allocation and never puts CSV rows in its manifest", () => {
    const actual = runEfficiencyAnalysis({ toolId: "5-3", ...input });
    expect(actual.status).toBe("success");
    expect(actual.verdict.evidenceState).toBe("estimated");
    expect(actual.manifest.budgetSource).toBe("observed_daily_total");
    expect(validateAnalysisResult(actual)).toEqual({ valid: true, errors: [] });
    expect(Object.keys(actual.manifest)).not.toEqual(expect.arrayContaining(["raw", "rows", "headers", "samples", "canonicalData"]));
  });

  it("does not turn missing PVM inputs into a success result", () => {
    const actual = runEfficiencyAnalysis({
      toolId: "5-21",
      csvData: { raw, mapping: { Date: "date", Spend: "cost", Installs: "installs" } },
      inputSignature: "input-v1",
      mappingSignature: "mapping-v1",
    });
    expect(actual.status).toBe("not_computable");
    expect(actual.verdict.evidenceState).toBe("not_computable");
  });
});
