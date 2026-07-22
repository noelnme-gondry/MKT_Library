import { describe, expect, it } from "vitest";
import { buildGraphSheetRows, buildRawIsoRows, classifySeasonalitySource } from "./seasonalityExport";

describe("seasonality export", () => {
  it("classifies explicit source values without treating unknown as paid", () => {
    expect(classifySeasonalitySource("Organic")).toBe("organic");
    expect(classifySeasonalitySource("Google Ads")).toBe("paid");
    expect(classifySeasonalitySource("brand_search")).toBe("other");
  });

  it("preserves every raw header and appends ISO annotations", () => {
    const rows = buildRawIsoRows({
      raw: [{ Date: "2025-01-02", Source: "Organic", Extra: "keep me" }],
      headers: ["Date", "Source", "Extra"],
      mapping: { Date: "date", Source: "source" },
      grain: "week",
    });
    expect(rows[0]).toMatchObject({ Date: "2025-01-02", Source: "Organic", Extra: "keep me", iso_period: "2025-W01", source_group: "organic" });
  });

  it("exports graph rows with actual, trend and seasonal index columns", () => {
    const result = {
      points: [{ year: 2024, bucket: 1, value: 110, trend: 100 }],
      seasonal: [{ bucket: 1, index: 110, delta: 10, n: 2 }],
      yearMean: new Map([[2024, 100]]),
    };
    const row = buildGraphSheetRows(result, "paid", "Paid", "month", (bucket) => `${bucket}월`)[0];
    expect(row).toMatchObject({
      series: "paid",
      period_label: "1월",
      actual_value: 110,
      trend_baseline: 100,
      seasonal_delta_pct: 10,
    });
    expect(row.detrend_index_pct).toBeCloseTo(110, 8);
  });
});
