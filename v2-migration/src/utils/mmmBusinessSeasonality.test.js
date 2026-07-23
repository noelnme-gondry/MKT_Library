import fs from "node:fs";
import Papa from "papaparse";
import { describe, expect, it } from "vitest";
import {
  businessWeekOfYear,
  buildObservedYearShapes,
  classifyBusinessSeasonality,
  compareObservedYearShapes,
} from "./mmmBusinessSeasonality.js";
import {
  MMM_METH_CONFIG,
  mmmBayesianRun,
} from "./mmmMath.js";

const csvPath = process.env.MMM_CSV_PATH;

function sundayLabels(count, start = "2024-01-07") {
  const first = new Date(`${start}T00:00:00Z`);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(first.getTime() + index * 7 * 24 * 60 * 60 * 1000);
    return date.toISOString().slice(0, 10);
  });
}

function recurringResiduals(count) {
  return Array.from({ length: count }, (_, index) => {
    const week = index % 52;
    return 1000 * Math.sin((2 * Math.PI * week) / 52)
      + 320 * Math.cos((4 * Math.PI * week) / 52)
      + 40 * (((index * 17) % 9) - 4);
  });
}

function parseRealCsv(path) {
  const { data: rows, meta } = Papa.parse(fs.readFileSync(path, "utf8"), { header: true, skipEmptyLines: true });
  const headers = meta.fields;
  const clean = (value) => {
    const number = Number(String(value ?? "").replace(/[$,\s]/g, ""));
    return Number.isFinite(number) ? number : 0;
  };
  const brand = headers.filter((key) => key.startsWith("brand_"));
  const performance = headers.filter((key) => key.startsWith("performance_"));
  const externalKeys = ["dating_market_downloads_android", "dating_market_downloads_ios"];
  const dummy = headers.filter((key) => !["Week of", "RR", ...brand, ...performance, ...externalKeys].includes(key));
  return {
    week: rows.map((_, index) => index + 1),
    dateLabel: rows.map((row) => row["Week of"]),
    ch: Object.fromEntries([...brand, ...performance].map((key) => [key, rows.map((row) => clean(row[key]))])),
    channels: [
      ...brand.map((key) => ({ key, label: key, kind: "brand" })),
      ...performance.map((key) => ({ key, label: key, kind: "perf" })),
    ],
    targets: { RR: rows.map((row) => clean(row.RR)) },
    dummy: Object.fromEntries(dummy.map((key) => [key, rows.map((row) => clean(row[key]))])),
    useDummies: true,
    steps: {},
    external: Object.fromEntries(externalKeys.map((key) => [key, rows.map((row) => clean(row[key]))])),
    externalDefs: externalKeys.map((key) => ({ key, label: key })),
  };
}

function sumChannels(panel, keys) {
  return Array.from({ length: panel.week.length }, (_, index) => keys.reduce((sum, key) => sum + panel.ch[key][index], 0));
}

function groupedMediaPanel(panel) {
  const brand = panel.channels.filter((channel) => channel.kind === "brand").map((channel) => channel.key);
  const performance = panel.channels.filter((channel) => channel.kind !== "brand").map((channel) => channel.key);
  return {
    ...panel,
    ch: { __brand: sumChannels(panel, brand), __performance: sumChannels(panel, performance) },
    channels: [
      { key: "__brand", label: "Brand", kind: "brand" },
      { key: "__performance", label: "Performance", kind: "perf" },
    ],
  };
}

function observedEvidenceForPanel(panel) {
  const run = mmmBayesianRun(panel, {
    ...MMM_METH_CONFIG,
    seasonalityPeriods: [],
    seasonalityCandidates: [{ id: "none", periods: [] }],
    baselineKnots: [],
  }, "RR", false, {
    skipTransformUncertainty: true,
    enableSeasonalitySelection: false,
    enableBaselineSelection: false,
    enableMediaPenaltySelection: false,
  });
  const shapes = buildObservedYearShapes(panel.dateLabel, run.weeks.map((week) => week.residual));
  const evidence = compareObservedYearShapes(shapes);
  return {
    shapes,
    evidence,
    confidence: classifyBusinessSeasonality(evidence, panel.week.length),
  };
}

describe("business seasonality diagnostics", () => {
  it("recognizes a stable observed annual shape", () => {
    const labels = sundayLabels(104);
    const evidence = compareObservedYearShapes(buildObservedYearShapes(labels, recurringResiduals(104)));
    expect(evidence.available).toBe(true);
    expect(evidence.observedYearCorrelation).toBeGreaterThan(0.9);
    expect(classifyBusinessSeasonality(evidence, 104).level).toBe("moderate");
  });

  it("does not recognize unrelated year shapes as recurring seasonality", () => {
    const labels = sundayLabels(104);
    const residuals = recurringResiduals(52).concat(Array.from({ length: 52 }, (_, index) => ((index * 31) % 97) - 48));
    const evidence = compareObservedYearShapes(buildObservedYearShapes(labels, residuals));
    expect(evidence.available).toBe(true);
    expect(evidence.observedYearCorrelation).toBeLessThan(0.4);
    expect(classifyBusinessSeasonality(evidence, 104).level).toBe("weak");
  });

  it("withholds automatic confidence below 96 observed weeks", () => {
    const labels = sundayLabels(80);
    const evidence = compareObservedYearShapes(buildObservedYearShapes(labels, recurringResiduals(80)));
    expect(classifyBusinessSeasonality(evidence, 80).level).toBe("none");
    expect(classifyBusinessSeasonality(evidence, 80).reason).toBe("insufficient-history");
  });

  it("uses observed recurrence as a soft production penalty when calendar dates exist", () => {
    const dateLabel = sundayLabels(104);
    const panel = {
      week: dateLabel.map((_, index) => index + 1),
      dateLabel,
      ch: {},
      channels: [],
      targets: { Regs: dateLabel.map((label, index) => {
        const week = businessWeekOfYear(label) || (index % 52) + 1;
        return 5000 + 1000 * Math.sin((2 * Math.PI * week) / 52) + 320 * Math.cos((4 * Math.PI * week) / 52);
      }) },
      dummy: {},
      steps: {},
      external: {},
    };
    const run = mmmBayesianRun(panel, {
      ...MMM_METH_CONFIG,
      steps: {},
      seasonalityMinHistory: 96,
      adstockGrid: [0],
      bayesHalfSaturationQuantiles: [0.6],
      bayesHillSlopeGrid: [1],
      mediaPenaltyCandidates: [0.5],
    }, "Regs", false, {
      skipTransformUncertainty: true,
    });
    expect(run.seasonalitySelection.evidence.observedRecurrenceGate).toBe(true);
    expect(run.seasonalitySelection.evidence.observedConfidence.level).toBe("moderate");
    expect(run.seasonalitySelection.evidence.observedRecurrencePenaltyMultiplier).toBeCloseTo(1, 6);
    expect(run.seasonalityPeriods.length).toBeGreaterThan(0);
  });

  it.skipIf(!csvPath)("reports observed RR year-to-year recurrence from the provided CSV", () => {
    const panel = parseRealCsv(csvPath);
    const variants = [
      ["full", panel],
      ["no-external", { ...panel, external: {}, externalDefs: [] }],
      ["no-events", { ...panel, dummy: {}, useDummies: false }],
      ["no-external-no-events", { ...panel, external: {}, externalDefs: [], dummy: {}, useDummies: false }],
      ["grouped-media", groupedMediaPanel(panel)],
    ];
    const results = Object.fromEntries(variants.map(([name, variantPanel]) => {
      const result = observedEvidenceForPanel(variantPanel);
      return [name, {
        years: result.shapes.map((shape) => ({ year: shape.year, observedWeeks: shape.observedWeeks, missingWeeks: shape.missingWeeks })),
        evidence: result.evidence,
        confidence: result.confidence,
      }];
    }));
    const productionRun = mmmBayesianRun(panel, MMM_METH_CONFIG, "RR", false, {
      skipTransformUncertainty: true,
    });
    console.log(JSON.stringify({
      observedWeeks: panel.week.length,
      variants: results,
      productionSelection: {
        seasonalityPeriods: productionRun.seasonalityPeriods,
        selected: productionRun.seasonalitySelection?.selected?.id,
        r2: productionRun.posterior?.r2,
        rmse: Math.sqrt(productionRun.weeks.reduce((sum, week) => sum + (Number(week.residual) || 0) ** 2, 0) / productionRun.weeks.length),
        observedConfidence: productionRun.seasonalitySelection?.evidence?.observedConfidence,
        observedRecurrenceGate: productionRun.seasonalitySelection?.evidence?.observedRecurrenceGate,
      },
    }, null, 2));
    expect(Object.keys(results)).toHaveLength(5);
    expect(results.full.evidence.available).toBe(true);
    expect(productionRun.seasonalityPeriods.length).toBeGreaterThan(0);
    expect(productionRun.seasonalitySelection?.selected?.id).toBe("annual-4");
    expect(productionRun.seasonalitySelection?.evidence?.observedRecurrenceScale).toBeCloseTo(0.5, 6);
  });
});
