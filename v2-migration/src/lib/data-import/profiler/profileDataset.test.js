import { describe, expect, it } from "vitest";
import { profileDatasetV2 } from "./profileDataset";
import { sampleRowIndexes } from "./sampleRows";

describe("Profiler V2", () => {
  it("samples a large dataset deterministically across its full range", () => {
    const indexes = sampleRowIndexes(10_000);
    expect(indexes).toHaveLength(500);
    expect(indexes[0]).toBe(0);
    expect(indexes.at(-1)).toBe(9_999);
    expect(indexes).toEqual(sampleRowIndexes(10_000));
  });

  it("returns distribution metadata without returning raw or sample values", () => {
    const rows = [
      { Date: "2026-01-01", Spend: "₩1,000", Secret: "do-not-store" },
      { Date: "2026-01-02", Spend: "₩2,000", Secret: "still-do-not-store" },
    ];
    const profile = profileDatasetV2({ headers: ["Date", "Spend", "Secret"], rows });
    expect(profile.columns.find((column) => column.header === "Spend")).toMatchObject({
      inferredType: "number", numeric: { min: 1000, max: 2000 }, rates: { currencyLike: 1 },
    });
    expect(JSON.stringify(profile)).not.toContain("do-not-store");
    expect(JSON.stringify(profile)).not.toContain("2026-01-01");
  });
});
