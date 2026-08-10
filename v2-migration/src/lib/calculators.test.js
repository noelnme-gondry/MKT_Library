import { describe, expect, it } from "vitest";
import { CALCULATOR_ORDER, calculateMarketingMetric, getAllCalculators } from "./calculators";

describe("marketing calculators", () => {
  it("keeps every calculator indexable in both locales", () => {
    expect(CALCULATOR_ORDER).toHaveLength(8);
    expect(getAllCalculators("ko")).toHaveLength(8);
    expect(getAllCalculators("en")).toHaveLength(8);
  });

  it("converts between CPA and ROAS in both directions", () => {
    expect(calculateMarketingMetric("cpa-roas-converter", {
      aov: 60000,
      cpa: 20000,
      targetRoasPct: 400,
    })).toMatchObject({ primary: 3, secondary: 15000 });
    expect(calculateMarketingMetric("cpa-roas-converter", { aov: 0, cpa: 100, targetRoasPct: 300 })).toBeNull();
  });

  it("derives the conversion rate a target requires", () => {
    // 예산 10,000,000 ÷ CPM 5,000 × 1,000 = 노출 2,000,000 · CTR 1% → 클릭 20,000
    const result = calculateMarketingMetric("required-cvr", {
      budget: 10000000,
      cpm: 5000,
      targetConversions: 1000,
      ctrPct: 1,
    });
    expect(result).toMatchObject({ primary: 0.05, secondary: 20000 });
    // 달성 불가능한 목표도 숨기지 않고 100%를 넘는 값으로 정직하게 드러낸다.
    expect(calculateMarketingMetric("required-cvr", {
      budget: 10000000, cpm: 5000, targetConversions: 30000, ctrPct: 1,
    }).primary).toBeGreaterThan(1);
    expect(calculateMarketingMetric("required-cvr", {
      budget: 10000000, cpm: 5000, targetConversions: 1000, ctrPct: 0,
    })).toBeNull();
  });

  it("projects pacing and the remaining daily budget", () => {
    expect(calculateMarketingMetric("budget-pacing", {
      periodBudget: 30000000,
      spentSoFar: 12000000,
      elapsedDays: 12,
      totalDays: 30,
    })).toMatchObject({ primary: 30000000, secondary: 1000000 });
    // 이미 초과 소진했으면 음수 일예산 대신 0으로 고정한다.
    expect(calculateMarketingMetric("budget-pacing", {
      periodBudget: 10000000, spentSoFar: 12000000, elapsedDays: 12, totalDays: 30,
    }).secondary).toBe(0);
    expect(calculateMarketingMetric("budget-pacing", {
      periodBudget: 30000000, spentSoFar: 1000, elapsedDays: 30, totalDays: 30,
    })).toBeNull();
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
