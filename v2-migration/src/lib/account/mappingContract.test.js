import { expect, it } from "vitest";
import { accountMappingRule, applyAccountMappings } from "./mappingContract";
import { buildLegacyRows } from "@/lib/data-import/canonical-v2/buildLegacyRows";
const rule = (name, key) => accountMappingRule({ normalizedColumnName: name, canonicalKey: key });
it("accepts only column names and known rules, never values or source data", () => {
  expect(rule("My Spend", "media_spend")).toEqual({ normalizedColumnName: "my_spend", canonicalKey: "media_spend" });
  for (const input of [null, [], { ...rule("Spend", "media_spend"), raw: [100] }, { ...rule("Spend", "media_spend"), profile: { values: [1] } }, { normalizedColumnName: "__proto__", canonicalKey: "media_spend" }, { normalizedColumnName: "a", canonicalKey: "__proto__" }]) expect(() => accountMappingRule(input)).toThrow("INVALID_MAPPING");
});
it("connects saved rules to both the visible mapping and actual calculation", () => {
  const input = { headers: ["My Spend", "Other"], mapping: { "My Spend": "__ignore__", Other: "cost" }, semanticMapping: { bindings: [{ sourceColumn: "My Spend", decision: "UNKNOWN" }, { sourceColumn: "Other", canonicalKey: "media_spend", decision: "SUGGEST" }] }, rules: [rule("My Spend", "media_spend")], toolId: "5-2" };
  const result = applyAccountMappings(input);
  expect(result.mapping).toEqual({ "My Spend": "cost", Other: "__ignore__" });
  expect(result.applied).toBe(1);
  expect(result.semanticMapping.bindings[1].canonicalKey).toBeNull();
  expect(result.semanticMapping.bindings[0].canonicalKey).toBe("media_spend");
  const rows = buildLegacyRows({ raw: [{ "My Spend": "100", Other: "900" }], legacyMapping: result.mapping, semanticBindings: result.semanticMapping.bindings, toolId: "5-2" });
  expect(rows[0].cost).toBe("100");
});
it("does not force unsupported or competing fields into a tool", () => {
  const input = { headers: ["A", "B", "C"], mapping: { A: "__ignore__", B: "__ignore__", C: "__ignore__" }, semanticMapping: { bindings: [] }, rules: [rule("a", "media_spend"), rule("b", "media_spend"), rule("c", "churn_event")], toolId: "5-2" };
  const result = applyAccountMappings(input);
  expect(result.applied).toBe(0);
  expect(result.skipped.sort()).toEqual(["A", "B", "C"]);
  expect(result.mapping).toEqual(input.mapping);
});
