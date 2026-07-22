import { describe, expect, it } from "vitest";
import { buildMmmWeeklyPerformance } from "./mmmWeeklyPerformance";

describe("buildMmmWeeklyPerformance", () => {
  it("기간 전체의 주 평균 지출·예측 성과·CPR을 채널별로 집계한다", () => {
    const rows = buildMmmWeeklyPerformance(
      { week: [1, 2, 3, 4], ch: { meta: [100, 0, 200, 100], unused: [0, 0, 0, 0] } },
      {
        meta: { key: "meta", label: "Meta", posteriorPositive: 0.9, responseAt: (spend) => spend / 10 },
        unused: { key: "unused", label: "Unused", responseAt: () => 1 },
      },
    );

    expect(rows).toEqual([{
      key: "meta", label: "Meta", activeWeeks: 3, avgWeeklySpend: 100,
      avgWeeklyPredicted: 10, predictedCpr: 10, posteriorPositive: 0.9,
    }]);
  });

  it("예측 성과가 0이면 CPR을 억지로 표시하지 않는다", () => {
    const rows = buildMmmWeeklyPerformance(
      { week: [1, 2], ch: { google: [100, 100] } },
      { google: { key: "google", responseAt: () => 0 } },
    );
    expect(rows[0].predictedCpr).toBeNull();
  });
});
