import Papa from "papaparse";
import { describe, expect, it } from "vitest";
import {
  businessWeekOfYear,
  buildObservedBusinessSeasonality,
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

function diagnosticCsvFixture() {
  const start = Date.parse("2024-01-07T00:00:00Z");
  const rows = [];
  let seed = 246813579;
  const random = () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296 - 0.5;
  };

  for (let index = 0; index < 104; index += 1) {
    const dateLabel = new Date(start + index * 7 * 86400000).toISOString().slice(0, 10);
    const angle = 2 * Math.PI * index / 52;
    const brandTv = 1200
      + 260 * Math.sin(2 * Math.PI * index / 17 + 0.2)
      + 130 * Math.cos(2 * Math.PI * index / 31)
      + 2.1 * index;
    const brandVideo = 900
      + 210 * Math.sin(2 * Math.PI * index / 23 + 1.1)
      + 100 * Math.cos(2 * Math.PI * index / 37)
      - 0.8 * index;
    const search = 1800
      + 320 * Math.sin(2 * Math.PI * index / 13 + 2.2)
      + 170 * Math.cos(2 * Math.PI * index / 29)
      + 1.4 * index;
    const social = 1400
      + 280 * Math.sin(2 * Math.PI * index / 19 + 3.1)
      + 140 * Math.cos(2 * Math.PI * index / 41)
      + 0.6 * index;
    // 외부 통제가 연간 shape를 우연히 흡수하지 않도록 7/9주 고주파를 사용한다.
    const android = 24000 + 900 * Math.sin(2 * Math.PI * index / 7 + 0.3);
    const ios = 18000 + 700 * Math.cos(2 * Math.PI * index / 9 + 0.7);
    const holiday = index % 52 >= 50 ? 1 : 0;
    const productLaunch = index === 34 || index === 86 ? 1 : 0;
    const seasonal = 5000 * Math.sin(angle)
      + 2600 * Math.cos(2 * angle)
      + 1600 * Math.sin(3 * angle)
      + 1100 * Math.cos(4 * angle);
    const rr = 42000 + 18 * index + seasonal
      + 0.3 * brandTv + 0.25 * brandVideo
      + 0.18 * search + 0.14 * social
      + 0.01 * android + 0.008 * ios
      + 500 * holiday + 350 * productLaunch
      + 30 * random();

    rows.push({
      "Week of": dateLabel,
      RR: Number(rr.toFixed(4)),
      brand_tv: Number(brandTv.toFixed(4)),
      brand_video: Number(brandVideo.toFixed(4)),
      performance_search: Number(search.toFixed(4)),
      performance_social: Number(social.toFixed(4)),
      dating_market_downloads_android: Number(android.toFixed(4)),
      dating_market_downloads_ios: Number(ios.toFixed(4)),
      holiday,
      product_launch: productLaunch,
    });
  }
  return Papa.unparse(rows);
}

function parseCsvText(csvText) {
  const { data: rows, meta } = Papa.parse(csvText, { header: true, skipEmptyLines: true });
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
  return Array.from({ length: panel.week.length }, (_, index) => (
    keys.reduce((sum, key) => sum + panel.ch[key][index], 0)
  ));
}

function groupedMediaPanel(panel) {
  const brand = panel.channels.filter((channel) => channel.kind === "brand").map((channel) => channel.key);
  const performance = panel.channels.filter((channel) => channel.kind !== "brand").map((channel) => channel.key);
  return {
    ...panel,
    ch: {
      __brand: sumChannels(panel, brand),
      __performance: sumChannels(panel, performance),
    },
    channels: [
      { key: "__brand", label: "Brand", kind: "brand" },
      { key: "__performance", label: "Performance", kind: "perf" },
    ],
  };
}

function observedEvidenceForPanel(panel) {
  const run = mmmBayesianRun(panel, {
    ...MMM_METH_CONFIG,
    // 강제 계절성 basis가 관측 반복성을 먼저 제거하지 않도록 진단 경로만 분리한다.
    trendDirectionFirst: false,
    seasonalityPeriods: [],
    seasonalityCandidates: [{ id: "none", periods: [] }],
    baselineKnots: [],
  }, "RR", false, {
    skipTransformUncertainty: true,
    enableSeasonalitySelection: false,
    enableBaselineSelection: false,
    enableMediaPenaltySelection: false,
  });
  const shapes = buildObservedYearShapes(
    panel.dateLabel,
    run.weeks.map((week) => week.residual),
  );
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

  it("builds a centered business shape from repeated observed calendar years", () => {
    const shape = buildObservedBusinessSeasonality(sundayLabels(104), recurringResiduals(104));
    expect(shape.available).toBe(true);
    expect(shape.yearCount).toBe(2);
    expect(shape.values).toHaveLength(52);
    expect(Math.abs(shape.values.reduce((sum, value) => sum + value, 0) / 52)).toBeLessThan(1e-9);
    expect(shape.amplitude).toBeGreaterThan(0);
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

  it("reports observed RR year-to-year recurrence from a deterministic CSV fixture", () => {
    const panel = parseCsvText(diagnosticCsvFixture());
    const variants = [
      ["full", panel],
      ["no-external", { ...panel, external: {}, externalDefs: [] }],
      ["no-events", { ...panel, dummy: {}, useDummies: false }],
      ["no-external-no-events", {
        ...panel,
        external: {},
        externalDefs: [],
        dummy: {},
        useDummies: false,
      }],
      ["grouped-media", groupedMediaPanel(panel)],
    ];
    const results = Object.fromEntries(variants.map(([name, variantPanel]) => {
      const result = observedEvidenceForPanel(variantPanel);
      return [name, {
        years: result.shapes.map((shape) => ({
          year: shape.year,
          observedWeeks: shape.observedWeeks,
          missingWeeks: shape.missingWeeks,
        })),
        evidence: result.evidence,
        confidence: result.confidence,
      }];
    }));
    const productionRun = mmmBayesianRun(panel, MMM_METH_CONFIG, "RR", false, {
      skipTransformUncertainty: true,
      enableMediaPenaltySelection: false,
    });
    expect(panel.week).toHaveLength(104);
    expect(panel.channels.map((channel) => channel.kind)).toEqual(["brand", "brand", "perf", "perf"]);
    expect(Object.keys(panel.external)).toEqual(["dating_market_downloads_android", "dating_market_downloads_ios"]);
    expect(Object.keys(panel.dummy)).toEqual(["holiday", "product_launch"]);
    expect(Object.keys(results)).toEqual([
      "full",
      "no-external",
      "no-events",
      "no-external-no-events",
      "grouped-media",
    ]);
    for (const result of Object.values(results)) {
      expect(result.years).toEqual([
        { year: 2024, observedWeeks: 52, missingWeeks: 0 },
        { year: 2025, observedWeeks: 52, missingWeeks: 0 },
      ]);
      expect(result.evidence.available).toBe(true);
      expect(result.evidence.observedYearCorrelation).toBeGreaterThan(0.95);
      expect(result.evidence.signAgreement).toBeGreaterThan(0.75);
      expect(result.evidence.peakShiftWeeks).toBeLessThanOrEqual(6);
      expect(result.evidence.troughShiftWeeks).toBeLessThanOrEqual(6);
      expect(result.evidence.amplitudeRatio).toBeGreaterThan(0.5);
      expect(result.evidence.amplitudeRatio).toBeLessThan(2);
      expect(result.confidence.level).toBe("moderate");
    }
    expect(productionRun).not.toBeNull();
    expect(productionRun.weeks).toHaveLength(104);
    expect(productionRun.seasonalityPeriods).toEqual([52.18]);
    expect(productionRun.seasonalitySelection?.selected?.id).toBe("business-pattern-mandatory");
    expect(productionRun.seasonalitySelection?.selected?.seasonalityBasis).toEqual({ type: "cyclic-rbf", knots: 6 });
    expect(productionRun.seasonalitySelection?.evidence?.mandatory).toBe(true);
    expect(productionRun.seasonalitySelection?.evidence?.detectionMode).toBe("trend-direction-first-joint-allocation");
  }, 15000);
});
