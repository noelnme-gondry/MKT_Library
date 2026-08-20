import { describe, expect, it } from "vitest";
import { buildMappingMemoryRecord, findCompatibleMemory, isMemoryCompatible } from "./mappingMemory";

const profile = { inferredType: "number", missingRate: 0, cardinality: "high", rates: { numeric: 1, currencyLike: 1, percentLike: 0 } };

describe("mapping memory privacy and compatibility", () => {
  it("stores only approved profile summaries", () => {
    const record = buildMappingMemoryRecord({ normalizedColumnName: "Meta Spend", canonicalKey: "media_spend", profile, context: { representation: "wide", roleFamilies: ["MEDIA", "OUTCOME"], fileName: "must-not-store.csv" } });
    expect(record).toMatchObject({ normalizedColumnName: "meta_spend", canonicalKey: "media_spend", context: { representation: "wide", roleFamilies: ["MEDIA", "OUTCOME"] } });
    expect(JSON.stringify(record)).not.toContain("must-not-store");
  });

  it("refuses a matching name when the profile or representation changed", () => {
    const record = buildMappingMemoryRecord({ normalizedColumnName: "Meta Spend", canonicalKey: "media_spend", profile, context: { representation: "wide" } });
    expect(isMemoryCompatible(record, { normalizedColumnName: "Meta Spend", profile, context: { representation: "wide" } })).toBe(true);
    expect(isMemoryCompatible(record, { normalizedColumnName: "Meta Spend", profile: { ...profile, inferredType: "string" }, context: { representation: "wide" } })).toBe(false);
    expect(isMemoryCompatible(record, { normalizedColumnName: "Meta Spend", profile, context: { representation: "long" } })).toBe(false);
  });

  it("returns no record until compatibility is proven", () => {
    const record = buildMappingMemoryRecord({ normalizedColumnName: "Meta Spend", canonicalKey: "media_spend", profile, context: { representation: "wide" } });
    expect(findCompatibleMemory([record], { normalizedColumnName: "Other", profile, context: { representation: "wide" } })).toBeNull();
  });
});
