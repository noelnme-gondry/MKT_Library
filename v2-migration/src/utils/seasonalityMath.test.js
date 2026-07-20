import { describe, expect, it } from "vitest";
import { buildCalendarSeasonality, getIsoWeek } from "./seasonalityMath";

describe("calendar seasonality", () => {
  it("같은 월을 연도별로 묶고 연간 평균 대비 인덱스를 계산한다", () => {
    const rows = [
      { date: "2024-01-02", installs: 100 }, { date: "2024-02-02", installs: 200 },
      { date: "2025-01-02", installs: 200 }, { date: "2025-02-02", installs: 400 },
    ];
    const result = buildCalendarSeasonality(rows, { metric: "installs", grain: "month" });
    expect(result.sufficient).toBe(true);
    expect(result.years).toEqual([2024, 2025]);
    expect(result.seasonal[0].index).toBeCloseTo(66.6667, 3);
    expect(result.seasonal[1].index).toBeCloseTo(133.3333, 3);
  });

  it("추세 제외는 중앙 이동평균 기준의 지수로 반환한다", () => {
    const rows = [];
    for (const year of [2024, 2025]) {
      for (let month = 1; month <= 6; month++) rows.push({ date: `${year}-${String(month).padStart(2, "0")}-02`, installs: month === 3 ? 300 : 100 });
    }
    const result = buildCalendarSeasonality(rows, { metric: "installs", grain: "month", detrend: true });
    expect(result.sufficient).toBe(true);
    expect(result.points.every((point) => Number.isFinite(point.display))).toBe(true);
  });

  it("한 해만 있으면 시즈널리티 판정을 보류한다", () => {
    const result = buildCalendarSeasonality([{ date: "2024-01-02", installs: 100 }, { date: "2024-02-02", installs: 200 }]);
    expect(result.sufficient).toBe(false);
  });

  it("ISO 주차를 반환한다", () => {
    expect(getIsoWeek(new Date("2024-01-04T12:00:00Z"))).toBe(1);
  });
});
