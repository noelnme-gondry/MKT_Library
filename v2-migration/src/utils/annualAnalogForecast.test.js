import { describe, expect, it } from "vitest";
import { runAnnualAnalogRouter, shouldUseAnnualAnalogFallback } from "./annualAnalogForecast";

function panel(values, stepAt = null) {
  return {
    week: values.map((_, index) => index + 1),
    weekLabel: values.map((_, index) => `w${index + 1}`),
    targets: { Regs: values },
    steps: stepAt == null ? {} : { regime: values.map((_, index) => index >= stepAt ? 1 : 0) },
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
    expect(result.model).toBe("annual-analog-regime-v2-nested-tournament");
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
