import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import fs from "node:fs";
import { ALLOC_MATH } from "@/utils/allocationMath";
import { ALLOCATION_MODEL_TYPES, predictAllocationCost } from "@/utils/allocationModels";
import { allocationCostWorkbook } from "./allocationCostWorkbook";
import { buildAnalysisExportPayload } from "./exportContract";
import { writeAnalysisWorkbook } from "./analysisWorkbook";

export function costWorkbookFixture() {
  const fits = {
    Linear: ALLOC_MATH.fitLinear([[100, 12], [200, 14], [300, 16], [400, 18]]),
    Log: ALLOC_MATH.fitLog([100, 200, 300, 400].map(x => [x, 2 * Math.log(x) + 1])),
    Poly2: ALLOC_MATH.fitPoly2([100, 200, 300, 400].map(x => [x, 20 - 0.0001 * (x - 300) ** 2])),
    Power: ALLOC_MATH.fitPower([100, 200, 300, 400].map(x => [x, 5 * Math.sqrt(x)])),
  };
  const models = new Map(Object.entries(fits).map(([name, model]) => [name, { model, xMin: 100, xMax: 400, poly2Shape: ALLOC_MATH.detectPoly2Shape(model), kept: [{ date: "2026-01-01" }, { date: "2026-01-28" }] }]));
  models.set("Missing", null);
  const groupings = ["OS/channel", "Channel"].map(label => ({ label, models: { actions: models, revenue_d7: models }, history: Object.fromEntries([...models.keys()].map(name => [name, { totalCost: 200 }])) }));
  const tables = allocationCostWorkbook({ groupings, metric: "actions", periodDays: 7, locale: "en" });
  const payload = buildAnalysisExportPayload({ toolId: "5-3", locale: "en", addon: { calculationTables: tables } });
  return { models, tables, bytes: writeAnalysisWorkbook(payload) };
}

describe("cost-only prediction workbook", () => {
  it("exports live input links for both groupings and every supported model", () => {
    const { bytes } = costWorkbookFixture();
    const workbook = XLSX.read(bytes, { type: "array", cellFormula: true });
    expect(workbook.SheetNames).toEqual(expect.arrayContaining(["COST_INPUT", "COST_MODELS", "COST_CURVES"]));
    const helpers = workbook.Sheets.COST_CURVES;
    const range = XLSX.utils.decode_range(helpers["!ref"]);
    for (let r = 1; r <= range.e.r; r += 1) for (const col of ["B", "C", "D", "E", "F", "G", "I", "J", "K", "L", "M", "N"]) {
      expect(helpers[`${col}${r + 1}`].f, `${col}${r + 1}`).toBeTypeOf("string");
    }
    expect(workbook.Sheets.COST_INPUT.C2.v).toBe(1400);
    expect(workbook.Sheets.COST_INPUT.E2.f).toContain("COST_CURVES");
    expect(workbook.Workbook.CalcPr.calcMode).toBe("auto");
  });
  it("covers every model from the shared model registry", () => {
    const { models } = costWorkbookFixture();
    expect([...models.keys()].filter(key => key !== "Missing")).toEqual(Object.values(ALLOCATION_MODEL_TYPES));
    for (const wrapper of [...models.values()].filter(Boolean)) {
      expect(predictAllocationCost(wrapper, 0).results).toBe(0);
      expect(predictAllocationCost(wrapper, -1)).toBeNull();
      expect(predictAllocationCost(wrapper, 50).estimated).toBe(true);
      expect(predictAllocationCost(wrapper, 800).estimated).toBe(true);
    }
  });
  it("leaves unobserved current spend empty instead of seeding a zero-cost scenario", () => {
    const { models } = costWorkbookFixture();
    const tables = allocationCostWorkbook({ groupings: [{ label: "Channel", models: { actions: models }, history: {} }], metric: "actions" });
    expect(tables[0].rows[1][2]).toBe("");
    expect(tables[0].rows[1][4].value).toBeUndefined();
    expect(tables[2].rows[2][13].value).toBe(2);
  });
  it("can provide the actual workbook and independent browser-engine targets for recalc proof", () => {
    const { bytes, models } = costWorkbookFixture();
    if (process.env.ALLOCATION_WORKBOOK_PROOF === "1") {
      fs.writeFileSync("/tmp/allocation-cost-proof.xlsx", Buffer.from(bytes));
      const cases = Object.fromEntries([...models].map(([name, wrapper]) => [name, [0, 50, 200, 350, 800].map(cost => ({ cost: cost * 7, prediction: predictAllocationCost(wrapper, cost) }))]));
      fs.writeFileSync("/tmp/allocation-cost-proof-targets.json", JSON.stringify(cases));
    }
    expect(bytes.byteLength).toBeGreaterThan(1000);
  });
});
