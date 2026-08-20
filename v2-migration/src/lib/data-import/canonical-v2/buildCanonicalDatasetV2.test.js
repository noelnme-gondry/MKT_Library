import { describe, expect, it } from "vitest";
import { buildCanonicalDatasetV2 } from "./buildCanonicalDatasetV2";

describe("Canonical Dataset V2", () => {
  it("keeps repeatable wide media measures instead of overwriting them", () => {
    const result = buildCanonicalDatasetV2({
      headers: ["date", "meta_spend", "google_spend"],
      raw: [{ date: "2026-01-01", meta_spend: "₩100", google_spend: "₩200" }],
      bindings: [
        { sourceColumn: "date", canonicalKey: "date", decision: "SUGGEST" },
        { sourceColumn: "meta_spend", canonicalKey: "media_spend", decision: "SUGGEST", member: { dimension: "channel", value: "Meta" } },
        { sourceColumn: "google_spend", canonicalKey: "media_spend", decision: "SUGGEST", member: { dimension: "channel", value: "Google" } },
      ],
      representation: "wide",
    });
    expect(result.records[0]).toMatchObject({
      time: { date: "2026-01-01" },
      measures: { media_spend: [{ value: 100 }, { value: 200 }] },
    });
  });

  it("does not copy an unknown source value into the V2 dataset", () => {
    const result = buildCanonicalDatasetV2({
      headers: ["date", "secret"], raw: [{ date: "2026-01-01", secret: "private-row-value" }],
      bindings: [{ sourceColumn: "date", canonicalKey: "date", decision: "SUGGEST" }, { sourceColumn: "secret", canonicalKey: null, decision: "UNKNOWN" }],
    });
    expect(JSON.stringify(result)).not.toContain("private-row-value");
  });
});
