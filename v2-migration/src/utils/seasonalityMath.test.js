import { describe, expect, it } from "vitest";
import { buildCalendarSeasonality, detectCalendarGrain, getIsoWeek, getIsoWeekYear } from "./seasonalityMath";

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
    expect(getIsoWeekYear(new Date("2024-12-30T12:00:00Z"))).toBe(2025);
  });

  it("일·주·월 입력 단위를 값으로 자동 판별한다", () => {
    expect(detectCalendarGrain([{ date: "2024-01-01" }, { date: "2024-01-02" }])).toBe("day");
    expect(detectCalendarGrain([{ date: "2024-W01" }, { date: "2024-W02" }])).toBe("week");
    expect(detectCalendarGrain([{ date: "2024-01" }, { date: "2024-02" }])).toBe("month");
  });

  it("존재하지 않는 일·월·ISO 주차를 달력 구간으로 rollover하지 않는다", () => {
    expect(detectCalendarGrain([
      { date: "2024-02-31" },
      { date: "2024-13" },
      { date: "2024-W99" },
    ])).toBe("unknown");
  });

  it("주별 원본에는 월별 집계를 허용하지 않는다", () => {
    const rows = [{ date: "2024-W01", installs: 100 }, { date: "2025-W01", installs: 110 }];
    expect(buildCalendarSeasonality(rows, { grain: "month" }).reason).toBe("grain_not_supported");
  });

  it("CPI·CPA·ROAS는 행별 비율 평균 대신 같은 기간 분자·분모 합계로 계산한다", () => {
    const rows = [
      { date: "2024-01-02", cost: 100, installs: 1, actions: 1, revenue_d7: 80 },
      { date: "2024-01-03", cost: 900, installs: 100, actions: 100, revenue_d7: 720 },
      { date: "2024-02-02", cost: 200, installs: 2, actions: 2, revenue_d7: 160 },
      { date: "2024-02-03", cost: 800, installs: 80, actions: 80, revenue_d7: 640 },
      { date: "2025-01-02", cost: 100, installs: 1, actions: 1, revenue_d7: 80 },
      { date: "2025-02-02", cost: 100, installs: 1, actions: 1, revenue_d7: 80 },
    ];
    const cpi = buildCalendarSeasonality(rows, { metric: { numerator: "cost", denominator: "installs" }, grain: "month" });
    const roas = buildCalendarSeasonality(rows, { metric: { numerator: "revenue_d7", denominator: "cost" }, grain: "month" });
    expect(cpi.points.find((point) => point.year === 2024 && point.bucket === 1).value).toBeCloseTo(1000 / 101, 8);
    expect(cpi.points.find((point) => point.year === 2024 && point.bucket === 1).value).not.toBeCloseTo(54.5, 1);
    expect(roas.points.find((point) => point.year === 2024 && point.bucket === 1).value).toBeCloseTo(0.8, 8);
  });
});
