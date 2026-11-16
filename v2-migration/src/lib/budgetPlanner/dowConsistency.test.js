// 요일 계산은 세 곳에 있다: 5-2 이상 감지(ANOMALY_MATH)·5-2 페이싱(PACING_MATH)·예산 플래너(dowOf).
// 계수 산식은 일부러 다르다 — 5-2 둘은 요일 평균, 플래너는 추세를 걷어낸 중앙값 + 수축(spec §3).
// 5-2 산식을 플래너로 바꾸면 5-2 화면 숫자가 바뀌므로(엔진 수학 동결, AGENTS §11) 합치지 않는다.
// 대신 "그 날짜가 무슨 요일인가"는 세 곳이 반드시 같아야 한다 — 하나라도 로컬 시간대로 읽으면
// UTC 서쪽에서 하루 밀린다(§7). 그 계약을 여기서 고정한다.
import { describe, expect, it } from "vitest";
import { ANOMALY_MATH } from "@/utils/anomalyMath";
import { PACING_MATH } from "@/utils/pacingMath";
import { dowOf, addDays } from "./plannerStats";

const dates = Array.from({ length: 14 }, (_, i) => addDays("2026-02-27", i)); // 윤년 아님·월말 경계 포함

describe("요일 인덱스 계약 — 세 계산이 같은 날을 같은 요일로 센다", () => {
  it.each(dates)("%s", (date) => {
    const expected = dowOf(date);
    const anomaly = ANOMALY_MATH.computeDowEffects([1], [date]);
    expect(anomaly.cnt.findIndex((count) => count > 0)).toBe(expected);
    const pacing = PACING_MATH.weekdayProfile([{ date, value: 1 }], 1);
    expect(pacing.counts.findIndex((count) => count > 0)).toBe(expected);
  });

  it("0=일요일 기준이다(2026-03-01은 일요일)", () => {
    expect(dowOf("2026-03-01")).toBe(0);
  });
});
