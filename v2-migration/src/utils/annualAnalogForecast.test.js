import { describe, expect, it } from "vitest";
import {
  forecastBoundedSeriesAt,
  runAnnualAnalogRouter,
  shouldUseAnnualAnalogFallback,
  similarSeasonAt,
} from "./annualAnalogForecast";

function panel(values, stepAt = null) {
  return {
    week: values.map((_, index) => index + 1),
    weekLabel: values.map((_, index) => `w${index + 1}`),
    targets: { Regs: values },
    steps: stepAt == null ? {} : { regime: values.map((_, index) => index >= stepAt ? 1 : 0) },
  };
}

function paidPanel(organic, paid, costs, stepAt = null) {
  return {
    ...panel(organic.map((value, index) => value + paid[index]), stepAt),
    ch: { media: costs },
    targets: {
      Regs: organic.map((value, index) => value + paid[index]),
      PaidRegs: paid,
    },
  };
}

describe("annual analog regime router", () => {
  it("chooses the annual family when a repeating signal wins audited evidence", () => {
    const android = Array.from({ length: 170 }, (_, index) => 100 + 20 * Math.sin(index * 2 * Math.PI / 52));
    const ios = Array.from({ length: 170 }, (_, index) => 250 + 50 * Math.cos(index * 2 * Math.PI / 52));
    const total = android.map((value, index) => value + ios[index]);
    const result = runAnnualAnalogRouter({
      totalPanel: panel(total, 152),
      androidPanel: panel(android, 152),
      iosPanel: panel(ios, 152),
    });
    expect(result.currentBreak).toBe(true);
    expect(result.qualified).toBe(true);
    expect(result.model).toBe("bounded-regime-search-v5");
    expect(result.osGuardrailPassed).toBe(true);
    expect(result.osGuardrail.every((component) => component.passed)).toBe(true);
    expect(result.productionSelected.family).toBe("annual");
    expect(result.selected.latestWmape).toBeLessThan(1e-8);
    expect(result.selected.future.predicted).toHaveLength(12);
  });

  it("keeps audit and production route/spec unchanged when sealed outcomes are perturbed", () => {
    const android = Array.from({ length: 170 }, (_, index) => 100 + 20 * Math.sin(index * 2 * Math.PI / 52));
    const ios = Array.from({ length: 170 }, (_, index) => 250 + 50 * Math.cos(index * 2 * Math.PI / 52));
    const changedAndroid = android.map((value, index) => index >= 158 ? value * 3 : value);
    const changedIos = ios.map((value, index) => index >= 158 ? value * 3 : value);
    const run = (androidValues, iosValues) => runAnnualAnalogRouter({
      totalPanel: panel(androidValues.map((value, index) => value + iosValues[index]), 152),
      androidPanel: panel(androidValues, 152),
      iosPanel: panel(iosValues, 152),
    });
    const original = run(android, ios);
    const perturbed = run(changedAndroid, changedIos);
    expect(perturbed.selected.latest.route).toBe(original.selected.latest.route);
    expect(perturbed.selected.latest.spec.id).toBe(original.selected.latest.spec.id);
    expect(perturbed.selected.latest.predicted).toEqual(original.selected.latest.predicted);
    expect(perturbed.auditSelected).toEqual(original.auditSelected);
    expect(perturbed.productionSelected.route).toBe(original.productionSelected.route);
    expect(perturbed.productionSelected.specId).toBe(original.productionSelected.specId);
    expect(perturbed.productionSelected.window).toBe(original.productionSelected.window);
    expect(perturbed.selected.latestWmape).toBeGreaterThan(original.selected.latestWmape);
  });

  it("uses each flat candidate's declared window instead of one hidden four-week level", () => {
    const series = [...Array(22).fill(10), ...Array(4).fill(100)];
    const flat4 = forecastBoundedSeriesAt(series, series.length, 3, {
      id: "flat-4",
      kind: "flat",
      window: 4,
    });
    const flat26 = forecastBoundedSeriesAt(series, series.length, 3, {
      id: "flat-26",
      kind: "flat",
      window: 26,
    });
    expect(flat4).toEqual([100, 100, 100]);
    expect(flat26[0]).toBeCloseTo(620 / 26, 10);
    expect(flat26).not.toEqual(flat4);
  });

  it("keeps the longest same-family evidence window when annual candidates tie", () => {
    const total = Array(220).fill(500);
    const android = Array(220).fill(200);
    const ios = Array(220).fill(300);
    const result = runAnnualAnalogRouter({
      totalPanel: panel(total),
      androidPanel: panel(android),
      iosPanel: panel(ios),
    });
    expect(result.auditSelected.specId).toBe("flat-130");
    expect(result.productionSelected.specId).toBe("flat-130");
    expect(result.modelSearch).toMatchObject({
      observedWeeks: 220,
      configuredMaxTrainingWeeks: 208,
      feasibleMaxTrainingWeeks: 130,
    });
    expect(result.modelSearch.excludedTrainingWindows).toEqual([
      { window: 156, reason: "insufficient-independent-folds", minimumObservedWeeks: 240 },
      { window: 208, reason: "insufficient-independent-folds", minimumObservedWeeks: 292 },
    ]);

    const longResult = runAnnualAnalogRouter({
      totalPanel: panel(Array(292).fill(500)),
      androidPanel: panel(Array(292).fill(200)),
      iosPanel: panel(Array(292).fill(300)),
    });
    expect(longResult.modelSearch.feasibleMaxTrainingWeeks).toBe(208);
    expect(longResult.modelSearch.excludedTrainingWindows).toEqual([]);
    expect(longResult.productionSelected.specId).toBe("flat-208");
  });

  it.each([
    {
      name: "constant",
      values: Array(220).fill(100),
      expectedFamily: "flat",
    },
    {
      name: "linear",
      values: Array.from({ length: 220 }, (_, index) => 100 + index * 0.5),
      expectedFamily: "trend",
    },
  ])("does not bias a $name series toward annual and can certify it", ({ values, expectedFamily }) => {
    const zero = Array(values.length).fill(0);
    const result = runAnnualAnalogRouter({
      totalPanel: panel(values),
      androidPanel: panel(values),
      iosPanel: panel(zero),
      horizon: 12,
    });
    expect(result.qualified).toBe(true);
    expect(result.selected.developmentWorstWmape).toBeLessThan(10);
    expect(result.selected.developmentPersistenceWinRate).toBeGreaterThanOrEqual(0.5);
    expect(result.auditSelected.family).toBe(expectedFamily);
    expect(result.productionSelected.family).toBe(expectedFamily);
    expect(result.productionSelected.specId).toBe(result.auditSelected.specId);
    expect(result.interval).toEqual(expect.objectContaining({
      method: "rolling-oos-horizon-p90-absolute-error",
      percentile: 0.9,
      isCoverageGuarantee: false,
    }));
    expect(result.interval.labelKo).not.toContain("연간");
    expect(result.interval.labelEn.toLowerCase()).not.toContain("annual");
  });

  it("enforces disjoint origins and at least three selection folds", () => {
    const values = Array.from({ length: 220 }, (_, index) => 100 + index * 0.25);
    const zero = Array(values.length).fill(0);
    const result = runAnnualAnalogRouter({
      totalPanel: panel(values),
      androidPanel: panel(values),
      iosPanel: panel(zero),
      horizon: 13,
      foldStep: 4,
      selectionFolds: 2,
    });
    expect(result.foldStep).toBeGreaterThanOrEqual(13);
    expect(result.selectionFolds).toBeGreaterThanOrEqual(3);
    expect(result.requestedSelectionFolds).toBeGreaterThanOrEqual(3);
    expect(result.provenance.foldStride).toBe(result.foldStep);
    expect(result.provenance.selectionFolds).toBe(result.selectionFolds);
  });

  it("uses observed Paid regs without double-counting the residual Organic level", () => {
    const length = 170;
    const androidCost = Array.from({ length }, (_, index) => index === 0 || index === 158 ? 0 : 20 + 5 * Math.sin(index * 2 * Math.PI / 13));
    const iosCost = Array.from({ length }, (_, index) => index === 0 || index === 158 ? 0 : 30 + 4 * Math.cos(index * 2 * Math.PI / 13));
    const androidPaid = androidCost.map((value, index) => index === 0 || index === 158 ? 40 : value * 2);
    const iosPaid = iosCost.map((value, index) => index === 0 || index === 158 ? 45 : value * 1.5);
    const androidOrganic = Array.from({ length }, (_, index) => 100 + 15 * Math.sin(index * 2 * Math.PI / 52));
    const iosOrganic = Array.from({ length }, (_, index) => 220 + 30 * Math.cos(index * 2 * Math.PI / 52));
    const android = paidPanel(androidOrganic, androidPaid, androidCost, 152);
    const ios = paidPanel(iosOrganic, iosPaid, iosCost, 152);
    const total = panel(android.targets.Regs.map((value, index) => value + ios.targets.Regs[index]), 152);
    total.targets.PaidRegs = androidPaid.map((value, index) => value + iosPaid[index]);
    const result = runAnnualAnalogRouter({ totalPanel: total, androidPanel: android, iosPanel: ios });
    expect(["paid-organic-adaptive-search-v4", "bounded-regime-search-v5"]).toContain(result.model);
    expect(result.adaptiveModelSearch).toBe(true);
    expect(result.modelSearch.maxTrainingWeeks).toBe(208);
    expect(result.modelSearch.blendWeights).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(result.modelSearch.criteria).toEqual({
      overallBase: 1,
      recentDeterioration: 0.1,
      tailRiskDeterioration: 0.1,
      instability: 0.1,
    });
    expect(result.modelSearch.performanceGuardrails).toEqual({
      overallTolerancePoints: 0,
      recentTolerancePoints: 0,
      tailRiskToleranceRatio: 1.1,
      minimumFoldWinRate: 0.5,
    });
    if (result.modelSearch.routeDecision) {
      expect(result.modelSearch.routeDecision.winner.reasonCodes.length).toBeGreaterThan(0);
      expect(result.modelSearch.routeDecision.guardrail.enabled).toBe(true);
    }
    expect(result.modelSearch.android.auditDecision.winner.ranks.overall).toBeGreaterThan(0);
    expect(result.modelSearch.android.zeroedPaidWeeks).toBe(2);
    expect(result.modelSearch.ios.zeroedPaidWeeks).toBe(2);
    expect(Number.isFinite(result.selected.latestWmape)).toBe(true);
    if (result.paidOrganicHybrid) {
      expect(result.selected.latest.performancePredicted[0]).toBe(0);
      result.selected.latest.predicted.forEach((value, index) => {
        expect(value).toBeCloseTo(
          result.selected.latest.organicPredicted[index]
            + result.selected.latest.performancePredicted[index],
          10,
        );
      });
      expect(result.selected.future.organic).toHaveLength(12);
      expect(result.selected.future.performance).toHaveLength(12);
      expect(result.selected.future.predicted).toEqual(
        result.selected.future.organic.map((value, index) => value + result.selected.future.performance[index]),
      );
    } else {
      expect(result.modelSearch.selectedProductionRoute).toBe("bounded-total-router");
      expect(result.candidates.some((candidate) =>
        (candidate.route === "bounded-total-router"
          && candidate.comparisonScope === "common-outer-origins")
        || (candidate.route === "android-ios-sum"
          && candidate.comparisonScope === "shared-route-origins"),
      )).toBe(true);
    }
  });

  it("keeps the future Paid/Organic blend sealed from the latest audit outcomes", () => {
    const length = 170;
    const horizon = 12;
    const cost = Array.from({ length }, (_, index) => 40 + (index % 9) * 3);
    const makeOs = (phase, mutateLatest = false) => {
      const organic = Array.from({ length }, (_, index) => {
        const base = 180 + phase + 18 * Math.sin(index * 2 * Math.PI / 52);
        return mutateLatest && index >= length - horizon ? base * 2.7 : base;
      });
      const paid = cost.map((value, index) => {
        const base = value * (1.2 + phase / 200);
        return mutateLatest && index >= length - horizon ? base * 0.25 : base;
      });
      return paidPanel(organic, paid, cost);
    };
    const run = (mutateLatest) => {
      const android = makeOs(0, mutateLatest);
      const ios = makeOs(25, mutateLatest);
      const totalValues = android.targets.Regs.map((value, index) => value + ios.targets.Regs[index]);
      const total = panel(totalValues);
      total.targets.PaidRegs = android.targets.PaidRegs.map((value, index) => value + ios.targets.PaidRegs[index]);
      total.ch = { media: cost.map((value) => value * 2) };
      return runAnnualAnalogRouter({ totalPanel: total, androidPanel: android, iosPanel: ios, horizon });
    };
    const original = run(false);
    const perturbed = run(true);
    expect(perturbed.modelSearch.android.productionBlendWeight)
      .toBe(original.modelSearch.android.productionBlendWeight);
    expect(perturbed.modelSearch.ios.productionBlendWeight)
      .toBe(original.modelSearch.ios.productionBlendWeight);
    expect(perturbed.modelSearch.android.organicSpec).toBe(original.modelSearch.android.organicSpec);
    expect(perturbed.modelSearch.android.paidSpec).toBe(original.modelSearch.android.paidSpec);
    expect(perturbed.modelSearch.ios.organicSpec).toBe(original.modelSearch.ios.organicSpec);
    expect(perturbed.modelSearch.ios.paidSpec).toBe(original.modelSearch.ios.paidSpec);
  });

  it("never scores a Paid/Organic OS sum against a smaller OS-only target", () => {
    const length = 220;
    const cost = Array.from({ length }, (_, index) => 60 + (index % 8) * 4);
    const android = paidPanel(
      Array.from({ length }, (_, index) => 100 + index * 0.05),
      cost.map((value) => value * 0.7),
      cost,
    );
    const ios = paidPanel(
      Array.from({ length }, (_, index) => 150 + index * 0.04),
      cost.map((value) => value * 0.5),
      cost,
    );
    const osTotal = android.targets.Regs.map((value, index) => value + ios.targets.Regs[index]);
    const total = panel(osTotal.map((value, index) =>
      value + (index < 70 ? 0 : index < 145 ? 1000 : 600)));
    total.targets.PaidRegs = android.targets.PaidRegs.map(
      (value, index) => value + ios.targets.PaidRegs[index],
    );
    total.ch = { media: cost.map((value) => value * 2) };

    const result = runAnnualAnalogRouter({
      totalPanel: total,
      androidPanel: android,
      iosPanel: ios,
    });
    const hybrid = result.candidates.find((candidate) =>
      candidate.route === "paid-organic-hybrid");
    expect(hybrid).toBeTruthy();
    expect(hybrid.developmentWmape).toBeGreaterThan(10);
    expect(result.selected.future.predicted.at(-1)).toBeGreaterThan(
      android.targets.Regs.at(-1) + ios.targets.Regs.at(-1),
    );
  });

  it("keeps Android+iOS diagnostic-only when Total contains another platform", () => {
    const length = 220;
    const android = Array.from({ length }, (_, index) =>
      80 + (index * 37 % 113));
    const ios = Array.from({ length }, (_, index) =>
      120 + (index * 53 % 157));
    const total = Array(length).fill(1000);
    const result = runAnnualAnalogRouter({
      totalPanel: panel(total),
      androidPanel: panel(android),
      iosPanel: panel(ios),
      allowedProductionRoutes: ["direct-total"],
    });

    expect(result.allowedProductionRoutes).toEqual(["direct-total"]);
    expect(result.selectedRoute).toBe("direct-total");
    expect(result.auditSelected.route).toBe("direct-total");
    expect(result.productionSelected.route).toBe("direct-total");
    expect(result.componentGuardrailRequired).toBe(false);
    expect(result.candidates.some((candidate) =>
      candidate.route === "android-ios-sum")).toBe(true);
    expect(result.selected.latest.actual).toEqual(Array(12).fill(1000));
    expect(result.selected.future.predicted).toEqual(Array(12).fill(1000));
  });

  it("rejects deteriorating candidates before selection and retains a baseline fallback", () => {
    const length = 170;
    const android = Array.from({ length }, (_, index) =>
      100 + (index % 9 === 0 ? 180 : 0) + (index % 4 === 0 ? 35 : 0));
    const ios = Array.from({ length }, (_, index) =>
      220 + (index % 11 === 0 ? 260 : 0) - (index % 5 === 0 ? 45 : 0));
    const result = runAnnualAnalogRouter({
      totalPanel: panel(android.map((value, index) => value + ios[index]), 150),
      androidPanel: panel(android, 150),
      iosPanel: panel(ios, 150),
    });
    const decision = result.modelSearch.routeDecision;
    expect(decision.guardrail.enabled).toBe(true);
    expect(decision.guardrail.rejectedCount).toBeGreaterThan(0);
    expect(decision.candidatesEvaluated).toBeGreaterThan(decision.candidatesCompared);
    expect(decision.guardrail.baseline.specId).toBe("flat-8");
    expect(decision.guardrail.rejected.length).toBeLessThanOrEqual(12);
    expect(decision.guardrail.rejected.every((candidate) => candidate.reasons.length > 0)).toBe(true);
  });

  it("weights similar seasonal segments without reading the forecast outcome", () => {
    const trainEnd = 118;
    const horizon = 12;
    const series = Array(130).fill(100);
    const matchingShape = Array.from({ length: 13 }, (_, index) => 80 + index * 2);
    matchingShape.forEach((value, index) => {
      series[trainEnd - 13 + index] = value;
      series[trainEnd - 52 - 13 + index] = value;
    });
    Array.from({ length: horizon }, (_, index) => 180 + index * 3).forEach((value, index) => {
      series[trainEnd - 52 + index] = value;
    });
    const spec = { kind: "similar-season", matchWeeks: 13, temperature: 0.25, neighbors: 2 };
    const original = similarSeasonAt(series, trainEnd, horizon, spec);
    const changedFuture = series.map((value, index) => index >= trainEnd ? value * 10 : value);
    const perturbed = similarSeasonAt(changedFuture, trainEnd, horizon, spec);
    expect(original.analogs[0].lag).toBe(52);
    expect(original.analogs.reduce((sum, analog) => sum + analog.weight, 0)).toBeCloseTo(1, 10);
    expect(perturbed.predicted).toEqual(original.predicted);

    const longHorizon = similarSeasonAt([...series, ...Array(52).fill(999999)], 120, 52, spec);
    const changedLongHorizon = similarSeasonAt([...series, ...Array(52).fill(1)], 120, 52, spec);
    expect(longHorizon.predicted).toEqual(changedLongHorizon.predicted);
    expect(longHorizon.analogs.every((analog) => analog.lag >= 52)).toBe(true);
  });

  it("does not certify a low pooled error when one development fold breaches 10%", () => {
    const values = Array.from({ length: 220 }, (_, index) => {
      const baseline = 100 + index * 0.2;
      return index >= 90 && index < 93 ? baseline * 0.3 : baseline;
    });
    const android = values.map((value) => value * 0.4);
    const ios = values.map((value) => value * 0.6);
    const result = runAnnualAnalogRouter({
      totalPanel: panel(values),
      androidPanel: panel(android),
      iosPanel: panel(ios),
    });
    expect(result.selected.developmentWmape).toBeLessThan(10);
    expect(result.selected.developmentWorstWmape).toBeGreaterThan(10);
    expect(result.selected.latestWmape).toBeLessThan(10);
    expect(result.osGuardrailPassed).toBe(true);
    expect(result.qualified).toBe(false);
  });

  it("does not certify when fewer than half of development folds beat persistence", () => {
    const values = Array.from({ length: 220 }, (_, index) =>
      150 + index * 0.02 + Math.sin(index * 2 * Math.PI / 5));
    const android = values.map((value) => value * 0.4);
    const ios = values.map((value) => value * 0.6);
    const result = runAnnualAnalogRouter({
      totalPanel: panel(values),
      androidPanel: panel(android),
      iosPanel: panel(ios),
    });
    expect(result.selected.developmentWmape).toBeLessThan(10);
    expect(result.selected.developmentWorstWmape).toBeLessThan(10);
    expect(result.selected.developmentPersistenceWinRate).toBeLessThan(0.5);
    expect(result.selected.latestWmape).toBeLessThanOrEqual(result.selected.latestPersistenceWmape);
    expect(result.osGuardrailPassed).toBe(true);
    expect(result.qualified).toBe(false);
  });

  it("uses an uncertified annual analog only as a safer post-break fallback", () => {
    const annual = {
      currentBreak: true,
      qualified: false,
      selected: { latestWmape: 7, latestPersistenceWmape: 12 },
    };
    expect(shouldUseAnnualAnalogFallback(annual, { latestWmape: 30 })).toBe(true);
    expect(shouldUseAnnualAnalogFallback(annual, { latestWmape: 5 })).toBe(false);
    expect(shouldUseAnnualAnalogFallback({ ...annual, currentBreak: false }, { latestWmape: 30 })).toBe(false);
    expect(shouldUseAnnualAnalogFallback({
      ...annual,
      selected: { latestWmape: 13, latestPersistenceWmape: 12 },
    }, { latestWmape: 30 })).toBe(false);
  });
});
