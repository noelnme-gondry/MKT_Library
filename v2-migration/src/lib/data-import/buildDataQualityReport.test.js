import { describe, expect, it } from "vitest";
import { buildDataQualityReport } from "./buildDataQualityReport";

describe("buildDataQualityReport", () => {
  it("reports duplicates and invalid values as caution", () => {
    const report = buildDataQualityReport({
      records: [{ date: "2026-07-01", dimensions: { channel: "Meta" } }, { date: "2026-07-01", dimensions: { channel: "Meta" } }],
      summary: { invalidValueCount: 1 },
    });
    expect(report).toMatchObject({ grade: "caution", periodCount: 1 });
    expect(report.issues).toHaveLength(2);
  });

  it("profiles gaps, missingness, zero values, and outliers without changing source rows", () => {
    const report = buildDataQualityReport({
      records: [
        { date: "2026-07-01", dimensions: {}, metrics: { cost: 10, installs: 0 } },
        { date: "2026-07-02", dimensions: {}, metrics: { cost: null, installs: 0 } },
        { date: "2026-07-10", dimensions: {}, metrics: { cost: 12, installs: 0 } },
        { date: "2026-07-11", dimensions: {}, metrics: { cost: 13, installs: 0 } },
        { date: "2026-07-12", dimensions: {}, metrics: { cost: 14, installs: 0 } },
        { date: "2026-07-13", dimensions: {}, metrics: { cost: 1000, installs: 0 } },
        { date: "2026-07-14", dimensions: {}, metrics: { cost: null, installs: 0 } },
      ],
      summary: {},
    }, { metricKeys: ["cost", "installs"] });
    expect(report.periodStats.gapCount).toBe(1);
    expect(report.metricStats.cost.missingRate).toBeCloseTo(2 / 7);
    expect(report.metricStats.installs.zeroRate).toBe(1);
    expect(report.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(["period_gaps", "high_missing_rate", "all_zero_metric", "outliers"]));
    // 경고는 대상을 가리킨다: 어느 지표에서 몇 건, 평소 범위, 가장 크게 벗어난 날짜와 값.
    const outliers = report.issues.find((issue) => issue.code === "outliers");
    expect(outliers.details).toHaveLength(1);
    expect(outliers.details[0]).toMatchObject({ field: "cost", count: 1, example: { date: "2026-07-13", value: 1000 } });
    expect(outliers.details[0].highFence).toBeLessThan(1000);
    expect(outliers.details[0].lowFence).toBeLessThanOrEqual(10);
  });

  it("does not invent missing dates or duplicates for an undated episode dataset", () => {
    const report = buildDataQualityReport({
      records: [
        { date: null, dimensions: {}, metrics: { tenure_periods: 1, event_observed: 1 } },
        { date: null, dimensions: {}, metrics: { tenure_periods: 2, event_observed: 0 } },
      ],
      summary: {},
    }, { metricKeys: ["tenure_periods", "event_observed"], requiresDate: false });

    expect(report).toMatchObject({ grade: "ready", requiresDate: false, rowCount: 2, periodCount: 0 });
    expect(report.issues.map((issue) => issue.code)).not.toEqual(expect.arrayContaining(["missing_date", "duplicates", "period_gaps"]));
    expect(report.channelCoverage).toEqual([]);
  });
});
