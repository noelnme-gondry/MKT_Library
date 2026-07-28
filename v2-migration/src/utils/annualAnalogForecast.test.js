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
    const android = Array.from({ length: 130 }, (_, index) => 100 + 20 * Math.sin(index * 2 * Math.PI / 52));
    const ios = Array.from({ length: 130 }, (_, index) => 250 + 50 * Math.cos(index * 2 * Math.PI / 52));
    const total = android.map((value, index) => value + ios[index]);
    const result = runAnnualAnalogRouter({
      totalPanel: panel(total, 112),
      androidPanel: panel(android, 112),
      iosPanel: panel(ios, 112),
    });
    expect(result.currentBreak).toBe(true);
    expect(result.qualified).toBe(true);
    expect(result.osGuardrailPassed).toBe(true);
    expect(result.osGuardrail.every((component) => component.passed)).toBe(true);
    expect(result.selected.latestWmape).toBeLessThan(1e-8);
    expect(result.selected.future.predicted).toHaveLength(12);
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
