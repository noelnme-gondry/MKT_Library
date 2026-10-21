import { describe, expect, it } from "vitest";
import { ADVANCED_TOOLS, ADVANCED_IDS } from "./registry";
import { ADVANCED_ENGINES, executeAdvanced } from "./execute";
import { advancedDemoOptions, buildAdvancedDemo } from "./demo";
import { projectAdvancedRows } from "./input";
import { buildMappingContract } from "../data-import/mappingContract";
import { buildToolDemo } from "../toolDemo";
import { TOOL_REQUIRED_FIELDS, STANDARD_FIELDS } from "@/utils/csvConstants";

describe("advanced analysis end-to-end contracts", () => {
  it("gives every route exactly one engine", () => {
    expect(Object.keys(ADVANCED_ENGINES).sort()).toEqual([...ADVANCED_IDS].sort());
  });
  it.each(ADVANCED_TOOLS)("runs $id from its actual common-uploader demo", (tool) => {
    const csv = buildToolDemo(tool.id), rows = projectAdvancedRows(csv, tool.id);
    expect(rows.length).toBe(csv.raw.length);
    const report = executeAdvanced(tool.id, rows, advancedDemoOptions(tool.id));
    expect(report.status).toBe("ready");
    expect(report.metrics.some((m) => Number.isFinite(m.value))).toBe(true);
    expect(report.tables.length).toBeGreaterThan(0);
    expect(JSON.stringify(report)).not.toContain("null,null,null");
  }, 30000);
  it.each(ADVANCED_TOOLS)("maps exported human-readable headers for $id", (tool) => {
    const csv = buildAdvancedDemo(tool.id);
    const contract = buildMappingContract({ headers: csv.headers, raw: csv.raw, toolId: tool.id });
    for (const key of TOOL_REQUIRED_FIELDS[tool.id]) {
      expect(STANDARD_FIELDS[key], key).toBeTruthy();
      expect(Object.values(contract.mapping), `${tool.id}:${key}`).toContain(key);
    }
  });
});
