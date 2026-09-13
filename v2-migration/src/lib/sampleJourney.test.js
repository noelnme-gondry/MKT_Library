import { describe, expect, it } from "vitest";
import { buildSampleJourney, getSampleJourney } from "./sampleJourney";
import { buildDemoCsv } from "@/utils/demoData";
import { compareSamplePerformance } from "@/utils/sampleSpendPreview";
import { getMappedRows } from "@/utils/dashboardAggregator";
import { runEfficiencyAnalysis } from "@/lib/assistant/efficiencyAnalysisAdapters";
import { runReview } from "@/lib/weekly-review/reviewPipeline";

describe("guided sample continuity", () => {
  it.each(["ko", "en"])("uses identical CPA values in the home preview, actual result adapter and weekly pipeline (%s)", locale => {
    const full = buildDemoCsv("efficiency", locale);
    const expected = compareSamplePerformance(full.raw).channels[0];
    const csvData = buildSampleJourney(locale);
    const sample = getSampleJourney(csvData);
    expect(csvData.importSource).toBe("demo");
    expect(csvData.raw.length).toBeGreaterThan(0);
    expect(csvData.raw.length).toBeLessThan(full.raw.length);
    expect(new Set(csvData.raw.map(row => row.channel))).toEqual(new Set([expected.channel]));
    const output = runEfficiencyAnalysis({ toolId: "5-2", csvData, inputSignature: "sample-source", mappingSignature: "sample-mapping", options: { denomBasis: "actions", displayCurrency: "KRW" }, locale });
    expect(output.status).toBe("success");
    const table = output.visualizations[0].table.rows;
    const cpa = table.find(row => row.metric === "cpa");
    expect(cpa.prior).toBeCloseTo(expected.prior.cpa, 8);
    expect(cpa.recent).toBeCloseTo(expected.recent.cpa, 8);
    const review = runReview({ rows: getMappedRows(csvData), customPeriod: sample.period });
    expect(review.ok).toBe(true);
    expect(review.periods.current.days).toBe(7);
    expect(review.periods.previous.days).toBe(7);
    expect(review.metrics.previous.cpa).toBeCloseTo(cpa.prior, 8);
    expect(review.metrics.current.cpa).toBeCloseTo(cpa.recent, 8);
    expect(review.routing.kpi.deltaPct).toBeCloseTo(expected.cpaChange, 10);
  });

  it("never grants the sample shortcut from filenames or copied metadata", () => {
    const sample = buildSampleJourney();
    expect(getSampleJourney(sample)).not.toBeNull();
    expect(getSampleJourney({ ...sample, currency: "USD" })).toBe(getSampleJourney(sample));
    expect(getSampleJourney({ ...sample, raw: [...sample.raw] })).toBeNull();
    expect(getSampleJourney({ ...sample, mapping: { ...sample.mapping } })).toBeNull();
    expect(getSampleJourney({ ...sample, importSource: "csv" })).toBeNull();
    expect(getSampleJourney(buildDemoCsv("efficiency"))).toBeNull();
    expect(getSampleJourney(null)).toBeNull();
  });
});
