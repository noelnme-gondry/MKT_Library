import { describe, expect, it } from "vitest";
import {
  KR_LUNAR_HOLIDAY_DATES,
  isLunarCalendarCovered,
  lunarAlignedAnalogIndex,
  lunarFutureDummies,
  lunarHolidayKindOfWeek,
  lunarKindAtFromPanel,
  matchLunarHolidayDummy,
} from "./krLunarHolidays";
import { MMM_METH_CONFIG, mmmBayesianForecast, mmmBayesianRun, mmmForecastNaiveBaselines } from "./mmmMath";
import { forecastBoundedSeriesAt } from "./annualAnalogForecast";

const WEEK = 7 * 86400000;
const mondays = (startIso, count) => Array.from({ length: count }, (_, i) => new Date(Date.parse(`${startIso}T00:00:00Z`) + i * WEEK));
const iso = (date) => date.toISOString().slice(0, 10);

describe("krLunarHolidays calendar", () => {
  it("lists one Seollal and one Chuseok per year with the holiday on the stated weekday", () => {
    expect(KR_LUNAR_HOLIDAY_DATES.seollal).toHaveLength(12);
    expect(KR_LUNAR_HOLIDAY_DATES.chuseok).toHaveLength(12);
    // 공개 달력으로 확인 가능한 요일 표본(설·추석 당일)
    expect(new Date("2025-10-06T00:00:00Z").getUTCDay()).toBe(1); // 2025 추석 월요일
    expect(new Date("2024-09-17T00:00:00Z").getUTCDay()).toBe(2); // 2024 추석 화요일
    expect(new Date("2026-02-17T00:00:00Z").getUTCDay()).toBe(2); // 2026 설날 화요일
    expect(new Set(KR_LUNAR_HOLIDAY_DATES.seollal.map((d) => d.slice(0, 4))).size).toBe(12);
    expect(new Set(KR_LUNAR_HOLIDAY_DATES.chuseok.map((d) => d.slice(0, 4))).size).toBe(12);
  });

  it("flags the week that contains the three-day holiday", () => {
    expect(lunarHolidayKindOfWeek("2025-10-06")).toBe("chuseok");
    expect(lunarHolidayKindOfWeek("2025-09-29")).toBe("chuseok"); // 10/5(전날)이 이 주의 일요일
    expect(lunarHolidayKindOfWeek("2025-10-13")).toBe(null);
    expect(lunarHolidayKindOfWeek("2026-02-16")).toBe("seollal");
    expect(isLunarCalendarCovered("2028-01-03")).toBe(false);
  });

  it("matches a mapped holiday dummy only when it follows the calendar", () => {
    const weeks = mondays("2023-01-02", 140);
    const holiday = weeks.map((week) => (lunarHolidayKindOfWeek(week) ? 1 : 0));
    expect(matchLunarHolidayDummy(holiday, weeks)).toMatchObject({ kind: "both" });
    const chuseokOnly = weeks.map((week) => (lunarHolidayKindOfWeek(week) === "chuseok" ? 1 : 0));
    expect(matchLunarHolidayDummy(chuseokOnly, weeks)).toMatchObject({ kind: "chuseok" });
    // 프로모션처럼 명절과 무관한 이벤트는 미래를 알 수 없다 — 달력으로 채우지 않는다.
    const promo = weeks.map((_, index) => (index % 13 === 5 ? 1 : 0));
    expect(matchLunarHolidayDummy(promo, weeks)).toBe(null);
  });

  it("fills future holiday weeks from the calendar and stops at the calendar range", () => {
    const weeks = mondays("2023-01-02", 140); // 2025-09-01까지
    const panel = {
      week: weeks.map((_, i) => i + 1),
      dates: weeks,
      dummy: { holiday: weeks.map((week) => (lunarHolidayKindOfWeek(week) === "chuseok" ? 1 : 0)) },
    };
    const { futureDummy, matches } = lunarFutureDummies(panel, 13);
    expect(matches).toEqual([expect.objectContaining({ key: "holiday", kind: "chuseok" })]);
    const futureWeeks = mondays(iso(new Date(weeks.at(-1).getTime() + WEEK)), 13).map(iso);
    const active = futureWeeks.filter((_, index) => futureDummy.holiday[index] === 1);
    expect(active).toEqual(["2025-09-29", "2025-10-06"]);
    // 이력은 달력 안, 예측 기간이 2028년으로 넘어가면 그 주는 채우지 않고 개수를 알린다.
    const lateWeeks = mondays("2025-03-03", 140);
    const late = {
      week: panel.week,
      dates: lateWeeks,
      dummy: { holiday: lateWeeks.map((week) => (lunarHolidayKindOfWeek(week) === "chuseok" ? 1 : 0)) },
    };
    const lateResult = lunarFutureDummies(late, 20);
    expect(lateResult.matches).toHaveLength(1);
    expect(lateResult.uncoveredFutureWeeks).toBeGreaterThan(0);
  });

  it("uses the calendar-filled dummy in the regression forecast", () => {
    const weeks = mondays("2023-01-02", 140);
    const holiday = weeks.map((week) => (lunarHolidayKindOfWeek(week) === "chuseok" ? 1 : 0));
    const spend = weeks.map((_, i) => 20000 + 6000 * Math.sin(i / 3.1) + 2000 * Math.cos(i / 7.3));
    const target = weeks.map((_, i) => 5000 + 0.05 * spend[i] - 1500 * holiday[i] + 40 * Math.sin(i * 1.7));
    const panel = {
      week: weeks.map((_, i) => i + 1), dates: weeks, weekLabel: weeks.map(iso),
      ch: { meta: spend }, channels: [{ key: "meta", label: "Meta", kind: "perf" }],
      targets: { Regs: target }, dummy: { holiday }, useDummies: true, steps: {}, external: {},
    };
    const cfg = { ...MMM_METH_CONFIG, absorbed: new Set(), trendDirectionFirst: false, seasonalityPeriods: [] };
    const run = mmmBayesianRun(panel, cfg, "Regs", false, { skipTransformUncertainty: true, enableSeasonalitySelection: false, enableBaselineSelection: false, enableJointStructureSelection: false, enableMediaPenaltySelection: false });
    expect(run.names).toContain("d_holiday");
    const forecast = mmmBayesianForecast(run, panel, null, 13);
    expect(forecast.calendarDummies).toEqual([expect.objectContaining({ key: "holiday" })]);
    const futureWeeks = mondays(iso(new Date(weeks.at(-1).getTime() + WEEK)), 13).map(iso);
    const chuseokIndex = futureWeeks.indexOf("2025-10-06");
    const normalIndex = futureWeeks.indexOf("2025-10-20");
    expect(forecast.predFut[normalIndex] - forecast.predFut[chuseokIndex]).toBeGreaterThan(1000);
  }, 30_000);
});

describe("annual analogs follow the moving lunar holidays", () => {
  it("re-aligns the 52-weeks-ago analog index to the same holiday state", () => {
    const weeks = mondays("2023-01-02", 160);
    const panel = { week: weeks.map((_, i) => i + 1), dates: weeks };
    const kindAt = lunarKindAtFromPanel(panel);
    const target = weeks.findIndex((week) => iso(week) === "2025-10-06"); // 2025 추석 주
    const analog = target - 52; // 2024-10-07 — 2024 추석(9/17)은 3주 앞
    expect(kindAt(target)).toBe("chuseok");
    expect(kindAt(analog)).toBe(null);
    const aligned = lunarAlignedAnalogIndex(target, analog, kindAt, target);
    expect(kindAt(aligned)).toBe("chuseok");
    expect(Math.abs(aligned - analog)).toBeLessThanOrEqual(3);
  });

  it("moves last year's holiday dip onto this year's holiday week in the annual analog forecast", () => {
    const weeks = mondays("2023-01-02", 145);
    const panel = { week: weeks.map((_, i) => i + 1), dates: weeks };
    const kindAt = lunarKindAtFromPanel(panel);
    const series = weeks.map((week) => (lunarHolidayKindOfWeek(week) === "chuseok" ? 600 : 1000));
    const trainEnd = 140; // 2025-09-08 이후 예측
    const spec = { id: "annual", kind: "annual", anchorWeeks: 4, seasonWeight: 1, ratioPower: 1 };
    const plain = forecastBoundedSeriesAt(series, trainEnd, 5, spec);
    const aligned = forecastBoundedSeriesAt(series, trainEnd, 5, spec, kindAt);
    const futureIso = mondays("2025-09-08", 5).map(iso);
    const chuseokPositions = futureIso.map((week, index) => (lunarHolidayKindOfWeek(week) === "chuseok" ? index : -1)).filter((i) => i >= 0);
    expect(chuseokPositions.length).toBeGreaterThan(0);
    chuseokPositions.forEach((index) => expect(aligned[index]).toBeLessThan(plain[index]));
  });

  it("does the same for the seasonal-naive baseline of the MMM forecast", () => {
    const weeks = mondays("2023-01-02", 140);
    const values = weeks.map((week) => (lunarHolidayKindOfWeek(week) === "chuseok" ? 600 : 1000));
    const train = { week: weeks.map((_, i) => i + 1), dates: weeks, targets: { Regs: values } };
    const futureWeeks = Array.from({ length: 13 }, (_, i) => 141 + i);
    const baselines = mmmForecastNaiveBaselines(train, "Regs", futureWeeks);
    const futureIso = mondays(iso(new Date(weeks.at(-1).getTime() + WEEK)), 13).map(iso);
    futureIso.forEach((week, index) => {
      const expected = lunarHolidayKindOfWeek(week) === "chuseok" ? 600 : 1000;
      expect(baselines["seasonal-naive-52"][index]).toBe(expected);
    });
  });
});
