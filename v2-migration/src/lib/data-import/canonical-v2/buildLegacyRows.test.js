import { describe, expect, it } from "vitest";
import { buildLegacyRows } from "./buildLegacyRows";

describe("V2 compatibility adapter", () => {
  it("preserves the existing legacy engine shape including cost/spend compatibility", () => {
    expect(buildLegacyRows({ raw: [{ Cost: "1,000", Installs: "2" }], legacyMapping: { Cost: "cost", Installs: "installs" } }))
      .toEqual([{ cost: "1000", installs: "2", spend: "1000" }]);
  });

  it("projects an explicit V2 role edit only to a legacy key accepted by the active tool", () => {
    expect(buildLegacyRows({
      toolId: "5-2",
      raw: [{ Date: "2026-01-01", Expense: "1,000", Downloads: "2" }],
      legacyMapping: { Date: "date", Expense: "__ignore__", Downloads: "installs" },
      semanticBindings: [{ sourceColumn: "Expense", canonicalKey: "media_spend", decision: "SUGGEST", source: "user" }],
    })).toEqual([{ date: "2026-01-01", cost: "1000", spend: "1000", installs: "2" }]);
  });

  it("does not retain a stale legacy mapping when a V2-only role is selected", () => {
    expect(buildLegacyRows({
      toolId: "5-2",
      raw: [{ Date: "2026-01-01", Expense: "1,000", Installs: "2" }],
      legacyMapping: { Date: "date", Expense: "cost", Installs: "installs" },
      semanticBindings: [{ sourceColumn: "Expense", canonicalKey: "row_id", decision: "SUGGEST", source: "user" }],
    })).toEqual([{ date: "2026-01-01", installs: "2" }]);
  });
});
