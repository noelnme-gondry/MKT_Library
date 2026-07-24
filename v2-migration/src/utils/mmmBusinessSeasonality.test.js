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
  mmmBuildFeatures,
  mmmSeasonalityRegularizationDecision,
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

function pearson(left, right) {
  const pairs = left.map((value, index) => [value, right[index]])
    .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
  if (pairs.length < 3) return null;
  const meanA = pairs.reduce((sum, [a]) => sum + a, 0) / pairs.length;
  const meanB = pairs.reduce((sum, [, b]) => sum + b, 0) / pairs.length;
  const numerator = pairs.reduce((sum, [a, b]) => sum + (a - meanA) * (b - meanB), 0);
  const denominator = Math.sqrt(
    pairs.reduce((sum, [a]) => sum + (a - meanA) ** 2, 0)
    * pairs.reduce((sum, [, b]) => sum + (b - meanB) ** 2, 0),
  );
  return denominator > 1e-12 ? numerator / denominator : null;
}

function omitPanelRows(panel, omitted) {
  const keep = panel.week.map((_, index) => index).filter((index) => !omitted.has(index));
  const pick = (values) => keep.map((index) => values[index]);
  return {
    ...panel,
    week: pick(panel.week),
    dateLabel: pick(panel.dateLabel),
    ch: Object.fromEntries(Object.entries(panel.ch).map(([key, values]) => [key, pick(values)])),
    targets: Object.fromEntries(Object.entries(panel.targets).map(([key, values]) => [key, pick(values)])),
    dummy: Object.fromEntries(Object.entries(panel.dummy).map(([key, values]) => [key, pick(values)])),
    external: Object.fromEntries(Object.entries(panel.external).map(([key, values]) => [key, pick(values)])),
  };
}

function fixedSeasonalityRun(panel, candidate) {
  return mmmBayesianRun(panel, {
    ...MMM_METH_CONFIG,
    seasonalityPeriods: candidate.periods,
    seasonalityBasis: candidate.seasonalityBasis || null,
    seasonalityPenaltyProfile: candidate.seasonalityPenaltyProfile || null,
    seasonalityPenaltyStrength: candidate.seasonalityPenaltyStrength || 0,
  }, "RR", false, {
    skipTransformUncertainty: true,
    enableSeasonalitySelection: false,
    enableBaselineSelection: false,
    enableMediaPenaltySelection: false,
  });
}

function fixedSeasonalityDiagnostics(panel, candidate) {
  const run = fixedSeasonalityRun(panel, candidate);
  const seasonal = run.weeks.map((week) => Number(week.contrib?.Seasonality) || 0);
  const residual = run.weeks.map((week) => Number(week.residual) || 0);
  const rmse = Math.sqrt(residual.reduce((sum, value) => sum + value ** 2, 0) / residual.length);
  const blockCorrelations = [];
  for (let start = 0; start < panel.week.length; start += 4) {
    const omitted = new Set(Array.from({ length: 4 }, (_, offset) => start + offset).filter((index) => index < panel.week.length));
    const reducedPanel = omitPanelRows(panel, omitted);
    const reducedRun = fixedSeasonalityRun(reducedPanel, candidate);
    const reducedSeasonal = reducedRun.weeks.map((week) => Number(week.contrib?.Seasonality) || 0);
    const fullKept = seasonal.filter((_, index) => !omitted.has(index));
    const correlation = pearson(fullKept, reducedSeasonal);
    if (Number.isFinite(correlation)) blockCorrelations.push(correlation);
  }
  const firstYear = seasonal.slice(0, 52);
  const turningPoints = firstYear.reduce((count, value, index) => {
    if (index === 0 || index === firstYear.length - 1) return count;
    const before = value - firstYear[index - 1];
    const after = firstYear[index + 1] - value;
    return count + (before * after < 0 ? 1 : 0);
  }, 0);
  const extrema = firstYear.map((value, index) => {
    const before = firstYear[(index - 1 + firstYear.length) % firstYear.length];
    const after = firstYear[(index + 1) % firstYear.length];
    if (value > before && value > after) return { week: index + 1, value, type: "peak" };
    if (value < before && value < after) return { week: index + 1, value, type: "trough" };
    return null;
  }).filter(Boolean);
  return {
    r2: run.posterior?.r2,
    rmse,
    residualAcf1: pearson(residual.slice(1), residual.slice(0, -1)),
    blockShapeCorrelation: blockCorrelations.reduce((sum, value) => sum + value, 0) / blockCorrelations.length,
    blockShapeWorst: Math.min(...blockCorrelations),
    peakWeek: firstYear.indexOf(Math.max(...firstYear)) + 1,
    troughWeek: firstYear.indexOf(Math.min(...firstYear)) + 1,
    turningPoints,
    extrema,
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

  it("reports observed recurrence without forcing a production penalty", () => {
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
      // 이 검증은 production 2단계 순서가 아니라 기존 자동 반복성 진단을 확인한다.
      trendDirectionFirst: false,
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
    expect(run.seasonalitySelection.cfg.seasonalityPenaltyMultiplier).toBe(1);
    expect(run.seasonalityPeriods.length).toBeGreaterThan(0);
  });

  it("builds a continuous cyclic business-seasonality basis", () => {
    const panel = {
      week: Array.from({ length: 105 }, (_, index) => index + 1),
      ch: {},
      channels: [],
      targets: { RR: Array(105).fill(1) },
      dummy: {},
      steps: {},
      external: {},
    };
    const built = mmmBuildFeatures(panel, {
      ...MMM_METH_CONFIG,
      seasonalityPeriods: [52.18],
      seasonalityBasis: { type: "cyclic-rbf", knots: 8 },
      baselineKnots: [],
    }, 0, false);
    const seasonalNames = built.names.filter((name) => name.startsWith("season_rbf_"));
    expect(seasonalNames).toHaveLength(7);
    seasonalNames.forEach((name) => {
      const index = built.names.indexOf(name);
      expect(Math.abs(built.X[0][index] - built.X[52][index])).toBeLessThan(0.04);
    });
  });

  it("rejects a regularization win that is smaller than fold uncertainty", () => {
    const base = { id: "annual-4" };
    const candidate = { id: "shrink", seasonalityPenaltyProfile: "harmonic-order" };
    const rolling = new Map([
      [base.id, { meanWmape: 2, foldWmapes: [1.8, 2.2, 2] }],
      [candidate.id, { meanWmape: 1.96, foldWmapes: [1.7, 2.25, 1.93] }],
    ]);
    const decision = mmmSeasonalityRegularizationDecision(base, [candidate], rolling, 0.05);
    expect(decision.selected.id).toBe("annual-4");
    expect(decision.evidence.accepted).toBe(false);
  });

  it("accepts a predeclared regularization candidate when every fold improves materially", () => {
    const base = { id: "annual-4" };
    const candidate = { id: "shrink", seasonalityPenaltyProfile: "harmonic-order" };
    const rolling = new Map([
      [base.id, { meanWmape: 2, foldWmapes: [2, 2, 2] }],
      [candidate.id, { meanWmape: 1.8, foldWmapes: [1.8, 1.8, 1.8] }],
    ]);
    const decision = mmmSeasonalityRegularizationDecision(base, [candidate], rolling, 0.05);
    expect(decision.selected.id).toBe("shrink");
    expect(decision.evidence.accepted).toBe(true);
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
    const fixedCandidates = Object.fromEntries(MMM_METH_CONFIG.seasonalityCandidates.map((candidate) => [
      candidate.id,
      fixedSeasonalityDiagnostics(panel, candidate),
    ]));
    console.log(JSON.stringify({
      observedWeeks: panel.week.length,
      variants: results,
      fixedCandidates,
      productionSelection: {
        seasonalityPeriods: productionRun.seasonalityPeriods,
        selected: productionRun.seasonalitySelection?.selected?.id,
        candidates: productionRun.seasonalitySelection?.candidates?.map((candidate) => ({
          id: candidate.id,
          finalBic: candidate.finalBic,
          rollingWmape: candidate.rollingWmape,
          rollingFolds: candidate.rollingFolds,
        })),
        r2: productionRun.posterior?.r2,
        rmse: Math.sqrt(productionRun.weeks.reduce((sum, week) => sum + (Number(week.residual) || 0) ** 2, 0) / productionRun.weeks.length),
        observedConfidence: productionRun.seasonalitySelection?.evidence?.observedConfidence,
        observedRecurrenceGate: productionRun.seasonalitySelection?.evidence?.observedRecurrenceGate,
        regularizationSelection: productionRun.seasonalitySelection?.evidence?.regularizationSelection,
      },
    }, null, 2));
    expect(Object.keys(results)).toHaveLength(5);
    expect(results.full.evidence.available).toBe(true);
    expect(productionRun.seasonalityPeriods.length).toBeGreaterThan(0);
    expect(productionRun.seasonalitySelection?.selected?.id).toBe("annual-4");
    expect(productionRun.seasonalitySelection?.evidence?.regularizationSelection?.accepted).toBe(false);
    expect(productionRun.seasonalitySelection?.evidence?.observedRecurrenceScale).toBeCloseTo(0.5, 6);
  }, 15000);
});
