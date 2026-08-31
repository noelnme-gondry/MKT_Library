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

  it("excludes summary and invalid-date rows from calculations while normalizing valid values", () => {
    expect(buildLegacyRows({
      toolId: "5-2",
      raw: [
        { Date: "08/31/2026", Cost: "1,350,000원", Actions: "10" },
        { Date: "not-a-date", Cost: "900", Actions: "90" },
        { Date: "합계", Cost: "900", Actions: "100" },
      ],
      legacyMapping: { Date: "date", Cost: "cost", Actions: "actions" },
    })).toEqual([{ date: "2026-08-31", cost: "1350000", spend: "1350000", actions: "10" }]);
  });
});
