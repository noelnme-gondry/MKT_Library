import { describe, expect, it } from "vitest";
import { CALCULATOR_ORDER, calculateMarketingMetric, getAllCalculators } from "./calculators";

describe("marketing calculators", () => {
  it("keeps five indexable calculators in both locales", () => {
    expect(CALCULATOR_ORDER).toHaveLength(5);
    expect(getAllCalculators("ko")).toHaveLength(5);
    expect(getAllCalculators("en")).toHaveLength(5);
  });

  it("calculates LTV:CAC and payback", () => {
    expect(calculateMarketingMetric("ltv-cac", {
      ltv: 150000,
      cac: 50000,
      monthlyArpu: 10000,
      grossMarginPct: 50,
    })).toMatchObject({ primary: 3, secondary: 10 });
  });

  it("calculates break-even ROAS and target CPA", () => {
    expect(calculateMarketingMetric("break-even-roas", {
      grossMarginPct: 60,
      variableFeePct: 10,
    }).primary).toBe(2);
    expect(calculateMarketingMetric("target-cpa", {
      aov: 50000,
      grossMarginPct: 60,
      targetProfitPct: 20,
    })).toMatchObject({ primary: 20000, secondary: 30000 });
  });

  it("reuses the experiment sample-size engine", () => {
    const result = calculateMarketingMetric("ab-test-sample-size", {
      baselinePct: 5,
      mdeRelativePct: 10,
      alphaPct: 5,
      powerPct: 80,
      dailyTraffic: 1000,
    });
    expect(result.primary).toBeGreaterThan(1000);
    expect(result.secondary).toBe(Math.ceil((result.primary * 2) / 1000));
  });

  it("returns an honest planning range for installs", () => {
    const result = calculateMarketingMetric("expected-installs", {
      budget: 1000000,
      expectedCpi: 5000,
      uncertaintyPct: 20,
    });
    expect(result.primary).toBe(200);
    expect(result.secondary[0]).toBeCloseTo(166.6666667);
    expect(result.secondary[1]).toBe(250);
  });

  it("rejects impossible inputs", () => {
    expect(calculateMarketingMetric("target-cpa", {
      aov: 50000,
      grossMarginPct: 20,
      targetProfitPct: 30,
    })).toBeNull();
    expect(calculateMarketingMetric("break-even-roas", {
      grossMarginPct: 5,
      variableFeePct: 10,
    })).toBeNull();
  });
});
