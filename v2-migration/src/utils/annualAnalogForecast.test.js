import { describe, expect, it } from "vitest";
import { runAnnualAnalogRouter, shouldUseAnnualAnalogFallback, similarSeasonAt } from "./annualAnalogForecast";

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
  it("chooses a direct annual analog only when a recent step has audited evidence", () => {
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
    expect(result.model).toBe("bounded-regime-search-v4");
    expect(result.osGuardrailPassed).toBe(true);
    expect(result.osGuardrail.every((component) => component.passed)).toBe(true);
    expect(result.selected.latestWmape).toBeLessThan(1e-8);
    expect(result.selected.future.predicted).toHaveLength(12);
  });

  it("keeps the latest sealed audit selection unchanged when its outcomes are perturbed", () => {
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
    expect(perturbed.selected.latestWmape).toBeGreaterThan(original.selected.latestWmape);
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
    expect(result.model).toBe("paid-organic-adaptive-search-v3");
    expect(result.paidOrganicHybrid).toBe(true);
    expect(result.adaptiveModelSearch).toBe(true);
    expect(result.modelSearch.maxTrainingWeeks).toBe(104);
    expect(result.modelSearch.blendWeights).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(result.modelSearch.criteria).toEqual({
      overallBase: 1,
      recentDeterioration: 0.1,
      tailRiskDeterioration: 0.1,
      instability: 0.1,
    });
    expect(result.modelSearch.routeDecision.winner.reasonCodes.length).toBeGreaterThan(0);
    expect(result.modelSearch.android.auditDecision.winner.ranks.overall).toBeGreaterThan(0);
    expect(result.modelSearch.android.zeroedPaidWeeks).toBe(2);
    expect(result.modelSearch.ios.zeroedPaidWeeks).toBe(2);
    expect(Number.isFinite(result.selected.latestWmape)).toBe(true);
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
