import { describe, expect, it } from "vitest";
import {
  assessForecastActual,
  createForecastReviewSnapshot,
  findForecastActualMatches,
  forecastReviewDate,
  normalizeForecastPeriod,
} from "@/lib/forecastReview";

describe("forecast review contract", () => {
  it("normalizes only concrete calendar periods and schedules review after the week closes", () => {
    expect(normalizeForecastPeriod("26-08-03")).toBe("2026-08-03");
    expect(normalizeForecastPeriod("2026-08-03")).toBe("2026-08-03");
    expect(normalizeForecastPeriod("+1")).toBe("");
    expect(normalizeForecastPeriod("2026-02-30")).toBe("");
    expect(forecastReviewDate("26-08-03")).toBe("2026-08-10");
  });

  it("stores one forecast week without raw rows or file identity", () => {
    expect(createForecastReviewSnapshot({
      forecast: { futLabels: ["26-08-03", "26-08-10"], predFut: [120, 130], lo: [100, 110], hi: [140, 150] },
      target: "Regs",
      platform: "all",
      sourceThrough: new Date(Date.UTC(2026, 6, 27)),
    })).toEqual({
      comparisonKind: "forecast_actual",
      forecastPeriod: "2026-08-03",
      forecastTarget: "Regs",
      forecastPlatform: "all",
      forecastValue: "120",
      forecastLower: "100",
      forecastUpper: "140",
      forecastSourceThrough: "2026-07-27",
    });
    expect(createForecastReviewSnapshot({ forecast: { futLabels: ["+1"], predFut: [120] }, target: "Regs" })).toBeNull();
  });

  it("matches only the same tool, target, platform, and calendar period", () => {
    const panel = {
      dates: [new Date(Date.UTC(2026, 6, 27)), new Date(Date.UTC(2026, 7, 3))],
      targets: { Regs: [100, 126] },
    };
    const records = [
      { id: "match", toolId: "5-18", comparisonKind: "forecast_actual", forecastPeriod: "2026-08-03", forecastTarget: "Regs", forecastPlatform: "all", forecastValue: "120", actual: "" },
      { id: "wrong-platform", toolId: "5-18", comparisonKind: "forecast_actual", forecastPeriod: "2026-08-03", forecastTarget: "Regs", forecastPlatform: "ios", forecastValue: "120", actual: "" },
      { id: "missing-forecast", toolId: "5-18", comparisonKind: "forecast_actual", forecastPeriod: "2026-08-03", forecastTarget: "Regs", forecastPlatform: "all", forecastValue: "", actual: "" },
      { id: "done", toolId: "5-18", comparisonKind: "forecast_actual", forecastPeriod: "2026-08-03", forecastTarget: "Regs", forecastPlatform: "all", forecastValue: "120", actual: "126" },
    ];
    expect(findForecastActualMatches(records, panel, "all")).toEqual([expect.objectContaining({ recordId: "match", actualValue: 126, predictedValue: 120 })]);
    expect(findForecastActualMatches(records, panel, "all", "Revenue")).toEqual([]);
  });

  it("reports signed point error and reference-range coverage without calling it causal", () => {
    expect(assessForecastActual({ comparisonKind: "forecast_actual", forecastValue: "120", forecastLower: "100", forecastUpper: "140", actual: "126" })).toMatchObject({
      state: "within_range", delta: 6, errorPct: 0.05, absolutePctError: 0.05,
    });
    expect(assessForecastActual({ comparisonKind: "forecast_actual", forecastValue: "120", forecastLower: "100", forecastUpper: "140", actual: "150" }).state).toBe("outside_range");
    expect(assessForecastActual({ comparisonKind: "forecast_actual", forecastValue: "120", actual: "126" }).state).toBe("point_only");
    expect(assessForecastActual({ comparisonKind: "forecast_actual", forecastValue: "120", actual: "" }).state).toBe("incomplete");
  });
});
