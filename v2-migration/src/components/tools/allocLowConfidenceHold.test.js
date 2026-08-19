import { describe, expect, it } from "vitest";
import { allocConfidence, selectLowConfidenceHolds } from "./BudgetAllocation";
import { calculateAllocationModeC } from "@/utils/budgetAllocTool";

/**
 * 저신뢰 채널 예산 고정(product-ssot D-14).
 *
 * 신뢰도는 이미 R²와 데이터 점 수로 계산하고 있었지만 **표시만** 하고 배분에는
 * 쓰지 않았다 — 가장 불확실한 추정치로 예산을 옮기는 상태였다(§8.6 위반).
 */

// 적합 품질만 다르고 나머지는 같은 래퍼 두 개를 만든다.
const wrapper = (r2, keptCount) => ({
  model: { type: "Linear", predict: (x) => x / 10, r2 },
  kept: Array.from({ length: keptCount }, (_, index) => ({ x: index + 1, y: index + 1 })),
  xMin: 1,
  xMax: keptCount,
  r2,
});

describe("allocConfidence", () => {
  it("needs both fit quality and enough points for the top grade", () => {
    expect(allocConfidence(wrapper(0.9, 8)).level).toBe("high");
    // 적합은 좋지만 점이 적다 — 커버리지 축이 막는다.
    expect(allocConfidence(wrapper(0.9, 4)).level).toBe("med");
    // 점은 많지만 적합이 나쁘다.
    expect(allocConfidence(wrapper(0.1, 30)).level).toBe("low");
    expect(allocConfidence(wrapper(NaN, 30)).level).toBe("low");
    expect(allocConfidence(null)).toBeNull();
  });
});

describe("selectLowConfidenceHolds", () => {
  it("holds only low-confidence channels that have a current spend", () => {
    const modelsMap = new Map([
      ["good", wrapper(0.85, 10)],
      ["thin", wrapper(0.1, 10)],
      ["thin_no_spend", wrapper(0.1, 10)],
    ]);
    const holds = selectLowConfidenceHolds(modelsMap, {
      good: { latestCost: 5000 },
      thin: { latestCost: 3000 },
      thin_no_spend: { latestCost: 0 },
    });
    expect(holds).toEqual({ thin: 3000 });
  });

  // 0으로 고정하면 채널을 끄는 것이 된다. 판단 보류가 중단 지시가 되면 안 된다.
  it("never turns a channel off by holding it at zero", () => {
    const holds = selectLowConfidenceHolds(new Map([["thin", wrapper(0.05, 9)]]), { thin: { latestCost: 0 } });
    expect(Object.keys(holds)).toEqual([]);
  });

  it("returns nothing without a model map", () => {
    expect(selectLowConfidenceHolds(null)).toEqual({});
  });
});

describe("holds reach the allocation engine", () => {
  // 선택만 하고 엔진에 안 닿으면 아무것도 지키지 않는다.
  it("locks the held channel at its current spend instead of reallocating it", () => {
    const modelsMap = new Map([
      ["good", wrapper(0.85, 10)],
      ["thin", wrapper(0.1, 10)],
    ]);
    const holds = selectLowConfidenceHolds(modelsMap, { good: { latestCost: 4000 }, thin: { latestCost: 3000 } });
    const withHold = calculateAllocationModeC({
      modelsMap, totalBudget: 10000, overrides: holds, metric: "installs", historyByCh: {},
    });
    const held = withHold.items.find((item) => item.channel === "thin");
    expect(held.locked).toBe(true);
    expect(held.cost).toBe(3000);

    const without = calculateAllocationModeC({
      modelsMap, totalBudget: 10000, overrides: {}, metric: "installs", historyByCh: {},
    });
    const free = without.items.find((item) => item.channel === "thin");
    expect(free.locked).toBe(false);
  });
});
