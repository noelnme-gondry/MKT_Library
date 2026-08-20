import { describe, expect, it } from "vitest";
import { CANONICAL_FIELDS } from "./canonicalFields";
import { evaluateV2Eligibility, TOOL_DATA_REQUIREMENTS_V2 } from "./toolDataRequirements";

describe("V2 tool data requirements", () => {
  it("derives each mapped requirement from the canonical migration table", () => {
    for (const contract of Object.values(TOOL_DATA_REQUIREMENTS_V2)) {
      for (const requirement of contract.requires) {
        for (const field of requirement.fields) {
          if (field.canonicalKey) expect(CANONICAL_FIELDS[field.canonicalKey], `${contract.toolId}:${field.legacyKey}`).toBeTruthy();
        }
      }
    }
  });

  it("does not treat unmigrated or UNKNOWN fields as analysis-ready", () => {
    const result = evaluateV2Eligibility({
      toolId: "5-2",
      bindings: [
        { canonicalKey: "date", decision: "SUGGEST" },
        { canonicalKey: "media_spend", decision: "SUGGEST" },
        { canonicalKey: "outcome_installs", decision: "UNKNOWN" },
      ],
    });
    expect(result.status).toBe("blocked");
    expect(result.missing).toHaveLength(1);
  });
});
