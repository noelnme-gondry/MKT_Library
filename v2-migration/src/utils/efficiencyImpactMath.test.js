import { describe, expect, it } from "vitest";
import { efficiencyMoneyImpact } from "./efficiencyImpactMath";

describe("efficiencyMoneyImpact", () => {
  it("converts a worsening unit cost into the window and projected amounts", () => {
    // CPA 10,000 → 11,200 · 최근 7일 전환 350건.
    // 창 차액 = 1,200 × 350 = 420,000 · 일 60,000 · 30일 1,800,000
    const impact = efficiencyMoneyImpact({
      priorUnitCost: 10000,
      recentUnitCost: 11200,
      recentConversions: 350,
      windowDays: 7,
    });
    expect(impact.direction).toBe("worse");
    expect(impact.diffPerConversion).toBe(1200);
    expect(impact.windowImpact).toBe(420000);
    expect(impact.dailyImpact).toBe(60000);
    expect(impact.projectionDays).toBe(30);
    expect(impact.projectedImpact).toBe(1800000);
  });

  it("keeps the sign for an improvement", () => {
    const impact = efficiencyMoneyImpact({
      priorUnitCost: 5000,
      recentUnitCost: 4500,
      recentConversions: 200,
      windowDays: 14,
      projectionDays: 28,
    });
    expect(impact.direction).toBe("better");
    expect(impact.windowImpact).toBe(-100000);
    expect(impact.projectedImpact).toBe(-200000);
  });

  it("reports a flat efficiency as flat rather than as an improvement", () => {
    const impact = efficiencyMoneyImpact({
      priorUnitCost: 5000,
      recentUnitCost: 5000,
      recentConversions: 10,
      windowDays: 7,
    });
    expect(impact.direction).toBe("flat");
    expect(impact.projectedImpact).toBe(0);
  });

  it("returns null instead of a zero when an input is missing or degenerate", () => {
    // "계산 불가"를 0으로 접으면 화면에 "영향 없음"이라는 거짓 결론이 뜬다.
    for (const bad of [
      {},
      { priorUnitCost: 0, recentUnitCost: 1, recentConversions: 1, windowDays: 7 },
      { priorUnitCost: 1, recentUnitCost: Number.NaN, recentConversions: 1, windowDays: 7 },
      { priorUnitCost: 1, recentUnitCost: 2, recentConversions: 0, windowDays: 7 },
      { priorUnitCost: 1, recentUnitCost: 2, recentConversions: 5, windowDays: 0 },
      { priorUnitCost: 1, recentUnitCost: 2, recentConversions: 5, windowDays: 7, projectionDays: -1 },
      { priorUnitCost: -1, recentUnitCost: 2, recentConversions: 5, windowDays: 7 },
    ]) {
      expect(efficiencyMoneyImpact(bad)).toBeNull();
    }
  });

  it("is deterministic for the same input", () => {
    const input = { priorUnitCost: 3333, recentUnitCost: 3777, recentConversions: 91, windowDays: 7 };
    expect(efficiencyMoneyImpact(input)).toEqual(efficiencyMoneyImpact(input));
  });
});
