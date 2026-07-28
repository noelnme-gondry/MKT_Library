import { describe, expect, it } from "vitest";
import { runAnnualAnalogRouter } from "./annualAnalogForecast";

function values(length, base, cycle = 13) {
  return Array.from({ length }, (_, index) =>
    Math.max(0, base + Math.sin(index * 2 * Math.PI / cycle) * base * 0.2 + (index % 17 === 0 ? base * 0.3 : 0)));
}

function panel(target, { paid = null, cost = null, steps = null } = {}) {
  return {
    week: target.map((_, index) => index),
    weekLabel: target.map((_, index) => `w${index}`),
    targets: { Regs: target, ...(paid ? { PaidRegs: paid } : {}) },
    ch: cost ? { media: cost } : {},
    steps: steps ? { event: steps } : {},
  };
}

function assertFiniteResult(result) {
  if (!result) return;
  const check = (value, path = "root") => {
    if (typeof value === "number") expect(Number.isFinite(value), path).toBe(true);
    else if (Array.isArray(value)) value.forEach((item, index) => check(item, `${path}.${index}`));
    else if (value && typeof value === "object") Object.entries(value).forEach(([key, item]) => check(item, `${path}.${key}`));
  };
  check(result);
}

describe("annual analog production stress", () => {
  it.each([
    { length: 80, horizon: 1, paid: false },
    { length: 104, horizon: 12, paid: false },
    { length: 120, horizon: 26, paid: false },
    { length: 170, horizon: 52, paid: false },
    { length: 170, horizon: 12, paid: true, zeroCost: true },
    { length: 238, horizon: 12, paid: true, zeroCost: false },
  ])("does not throw or emit non-finite numbers: $length/$horizon/$paid/$zeroCost", (config) => {
    const android = values(config.length, 100, 13);
    const ios = values(config.length, 240, 52);
    const costAndroid = config.zeroCost ? Array(config.length).fill(0) : values(config.length, 20, 7);
    const costIos = config.zeroCost ? Array(config.length).fill(0) : values(config.length, 30, 9);
    const paidAndroid = costAndroid.map((cost) => Math.min(80, cost * 2));
    const paidIos = costIos.map((cost) => Math.min(120, cost * 1.5));
    const step = Array.from({ length: config.length }, (_, index) => index >= config.length - 20 ? 1 : 0);
    const result = runAnnualAnalogRouter({
      totalPanel: panel(android.map((value, index) => value + ios[index]), {
        paid: config.paid ? paidAndroid.map((value, index) => value + paidIos[index]) : null,
        steps: step,
      }),
      androidPanel: panel(android, { paid: config.paid ? paidAndroid : null, cost: config.paid ? costAndroid : null, steps: step }),
      iosPanel: panel(ios, { paid: config.paid ? paidIos : null, cost: config.paid ? costIos : null, steps: step }),
      horizon: config.horizon,
    });
    assertFiniteResult(result);
    if (config.length >= 170 && config.horizon <= 26) {
      expect(result).not.toBeNull();
      expect(result.selected.future.predicted).toHaveLength(config.horizon);
    }
  });

  it("is deterministic and does not mutate caller-owned panels", () => {
    const length = 170;
    const android = panel(values(length, 100, 13));
    const ios = panel(values(length, 240, 52));
    const total = panel(android.targets.Regs.map((value, index) => value + ios.targets.Regs[index]));
    const input = { totalPanel: total, androidPanel: android, iosPanel: ios, horizon: 12 };
    const before = JSON.stringify(input);
    const first = runAnnualAnalogRouter(input);
    const second = runAnnualAnalogRouter(input);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(JSON.stringify(input)).toBe(before);
  });

  it("fails safely for mismatched or non-finite target series", () => {
    const androidValues = values(170, 100, 13);
    const iosValues = values(169, 240, 52);
    expect(runAnnualAnalogRouter({
      totalPanel: panel(androidValues),
      androidPanel: panel(androidValues),
      iosPanel: panel(iosValues),
    })).toBeNull();
    const invalid = androidValues.map((value, index) => index === 150 ? Number.NaN : value);
    expect(() => runAnnualAnalogRouter({
      totalPanel: panel(invalid),
      androidPanel: panel(invalid),
      iosPanel: panel(androidValues),
    })).not.toThrow();
  });
});
