import { describe, expect, it } from "vitest";
import { buildMappingParityReport } from "./buildMappingParityReport";

describe("V1/V2 mapping parity report", () => {
  it("reports binding disagreement without carrying row data", () => {
    const report = buildMappingParityReport({
      legacyMapping: { Cost: "cost", Actions: "actions" },
      bindings: [
        { sourceColumn: "Cost", canonicalKey: "media_spend" },
        { sourceColumn: "Actions", canonicalKey: null },
      ],
    });
    expect(report).toMatchObject({ comparedColumnCount: 2, matchCount: 1, mismatchCount: 1 });
    expect(JSON.stringify(report)).not.toContain("private-row-value");
  });
});
