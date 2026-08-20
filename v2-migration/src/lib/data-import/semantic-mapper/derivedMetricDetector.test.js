import { describe, expect, it } from "vitest";
import { detectDerivedMetricBindings } from "./derivedMetricDetector";

describe("derived metric detector", () => {
  it("recognizes CTR only when the row-level formula is accurate", () => {
    const rows = Array.from({ length: 12 }, (_, index) => ({ clicks: String(10 + index), impressions: String(100 + index * 10), ctr: ((10 + index) / (100 + index * 10)).toFixed(4) }));
    const bindings = [
      { sourceColumn: "clicks", canonicalKey: "media_clicks", decision: "SUGGEST" },
      { sourceColumn: "impressions", canonicalKey: "media_impressions", decision: "SUGGEST" },
      { sourceColumn: "ctr", canonicalKey: null, decision: "UNKNOWN" },
    ];
    expect(detectDerivedMetricBindings({ headers: ["clicks", "impressions", "ctr"], rows, bindings })).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceColumn: "ctr", canonicalKey: "derived_ctr" }),
    ]));
  });

  it("does not call correlation alone a formula match", () => {
    const rows = Array.from({ length: 12 }, (_, index) => ({ clicks: String(10 + index), impressions: String(100 + index * 10), ctr: String(100 + index) }));
    const bindings = [{ sourceColumn: "clicks", canonicalKey: "media_clicks", decision: "SUGGEST" }, { sourceColumn: "impressions", canonicalKey: "media_impressions", decision: "SUGGEST" }, { sourceColumn: "ctr", canonicalKey: null, decision: "UNKNOWN" }];
    expect(detectDerivedMetricBindings({ headers: ["clicks", "impressions", "ctr"], rows, bindings })).toEqual([]);
  });
});
