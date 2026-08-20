import { describe, expect, it } from "vitest";
import { parseMappingMemory, serializeMappingMemory } from "./feedbackFile";

describe("mapping memory feedback file", () => {
  it("round-trips only non-row mapping metadata", () => {
    const file = serializeMappingMemory([{ normalizedColumnName: "meta_spend", canonicalKey: "media_spend", profile: { inferredType: "number" }, context: { representation: "wide" }, confirmationCount: 2, confirmedAt: 1, raw: "must-not-export" }]);
    expect(JSON.stringify(file)).not.toContain("must-not-export");
    expect(parseMappingMemory(JSON.stringify(file))).toEqual([expect.objectContaining({ normalizedColumnName: "meta_spend", canonicalKey: "media_spend" })]);
  });

  it("rejects unsafe keys and unknown canonical roles", () => {
    expect(() => parseMappingMemory('{"schemaVersion":1,"product":"growthopt-playbook-mapping-memory","__proto__":{},"records":[]}')).toThrow("MAPPING_MEMORY_FILE_UNSAFE_KEY");
    expect(() => parseMappingMemory('{"schemaVersion":1,"product":"growthopt-playbook-mapping-memory","records":[{"normalizedColumnName":"x","canonicalKey":"missing"}]}')).toThrow("MAPPING_MEMORY_FILE_INVALID_RECORD");
  });
});
