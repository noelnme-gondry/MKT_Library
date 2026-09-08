import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  addDaysUtc,
  formatUtcDate,
  isoWeekStartUtc,
  parseUtcDate,
  resolveComparisonPeriods,
} from "./period";

/** 시작~끝 사이의 모든 날짜(포함). 픽스처를 손으로 나열하지 않기 위한 헬퍼. */
function range(start, end) {
  const out = [];
  let cursor = parseUtcDate(start);
  const last = parseUtcDate(end);
  while (cursor.getTime() <= last.getTime()) {
    out.push(formatUtcDate(cursor));
    cursor = addDaysUtc(cursor, 1);
  }
  return out;
}

describe("UTC 날짜 기본", () => {
  it("YYYY-MM-DD를 UTC 자정으로 읽는다", () => {
    expect(formatUtcDate(parseUtcDate("2026-08-31"))).toBe("2026-08-31");
    expect(parseUtcDate("2026-08-31").getUTCHours()).toBe(0);
  });

  it("존재하지 않는 날짜와 형식 위반은 null", () => {
    expect(parseUtcDate("2026-02-30")).toBeNull();
    expect(parseUtcDate("2026-13-01")).toBeNull();
    expect(parseUtcDate("2026/08/31")).toBeNull();
    expect(parseUtcDate("")).toBeNull();
    expect(parseUtcDate(null)).toBeNull();
  });

  it("윤년 2월 29일은 유효하고 평년은 아니다", () => {
    expect(formatUtcDate(parseUtcDate("2028-02-29"))).toBe("2028-02-29");
    expect(parseUtcDate("2026-02-29")).toBeNull();
  });

  it("주 시작은 월요일이고 요일 판정은 UTC 기준이다", () => {
    // 2026-08-31 월 · 09-02 수 · 09-06 일 — 모두 같은 ISO 주
    expect(formatUtcDate(isoWeekStartUtc(parseUtcDate("2026-08-31")))).toBe("2026-08-31");
    expect(formatUtcDate(isoWeekStartUtc(parseUtcDate("2026-09-02")))).toBe("2026-08-31");
    expect(formatUtcDate(isoWeekStartUtc(parseUtcDate("2026-09-06")))).toBe("2026-08-31");
    // 일요일이 주의 끝이라 다음 월요일로 넘어가면 안 된다.
    expect(formatUtcDate(isoWeekStartUtc(parseUtcDate("2026-09-07")))).toBe("2026-09-07");
  });
});

describe("자동 기간 판정", () => {
  it("7일이 다 차면 완료 주 vs 그 전주", () => {
    const result = resolveComparisonPeriods({ dates: range("2026-08-24", "2026-09-06") });
    expect(result.ok).toBe(true);
    expect(result.current).toEqual({ start: "2026-08-31", end: "2026-09-06", days: 7 });
    expect(result.previous).toEqual({ start: "2026-08-24", end: "2026-08-30", days: 7 });
    expect(result.partial).toBe(false);
    expect(result.smallSample).toBe(false);
    expect(result.volumeMultiplier).toBe(1);
  });

  it("수요일까지면 월–수 vs 전주 월–수", () => {
    const result = resolveComparisonPeriods({ dates: range("2026-08-24", "2026-09-02") });
    expect(result.current).toEqual({ start: "2026-08-31", end: "2026-09-02", days: 3 });
    expect(result.previous).toEqual({ start: "2026-08-24", end: "2026-08-26", days: 3 });
    expect(result.partial).toBe(true);
    expect(result.smallSample).toBe(false);
    expect(result.volumeMultiplier).toBe(1);
  });

  it("두 기간의 일수는 언제나 같다 — 부분 주와 전체 주를 견주지 않는다", () => {
    for (const end of range("2026-08-31", "2026-09-06")) {
      const result = resolveComparisonPeriods({ dates: range("2026-08-17", end) });
      expect(result.ok).toBe(true);
      expect(result.current.days).toBe(result.previous.days);
    }
  });

  it("이틀 이하는 볼륨 게이트를 두 배로 올린다", () => {
    const two = resolveComparisonPeriods({ dates: range("2026-08-24", "2026-09-01") });
    expect(two.current.days).toBe(2);
    expect(two.smallSample).toBe(true);
    expect(two.volumeMultiplier).toBe(2);

    const three = resolveComparisonPeriods({ dates: range("2026-08-24", "2026-09-02") });
    expect(three.smallSample).toBe(false);
    expect(three.volumeMultiplier).toBe(1);
  });

  it("월요일 하루치도 전주 월요일과 견준다", () => {
    const result = resolveComparisonPeriods({ dates: range("2026-08-24", "2026-08-31") });
    expect(result.current).toEqual({ start: "2026-08-31", end: "2026-08-31", days: 1 });
    expect(result.previous).toEqual({ start: "2026-08-24", end: "2026-08-24", days: 1 });
    expect(result.smallSample).toBe(true);
  });

  it("연말 주 경계를 넘어도 월요일 기준이 유지된다", () => {
    // 2026-12-28(월) ~ 2027-01-03(일)이 한 ISO 주다.
    const result = resolveComparisonPeriods({ dates: range("2026-12-21", "2027-01-03") });
    expect(result.current).toEqual({ start: "2026-12-28", end: "2027-01-03", days: 7 });
    expect(result.previous).toEqual({ start: "2026-12-21", end: "2026-12-27", days: 7 });
  });

  it("윤년 2월 말을 지나도 날짜가 밀리지 않는다", () => {
    // 2028-02-28(월) ~ 03-05(일) — 2028은 윤년이라 02-29가 있다.
    const result = resolveComparisonPeriods({ dates: range("2028-02-21", "2028-03-05") });
    expect(result.current).toEqual({ start: "2028-02-28", end: "2028-03-05", days: 7 });
    expect(result.previous).toEqual({ start: "2028-02-21", end: "2028-02-27", days: 7 });
  });

  it("날짜 순서가 뒤섞이거나 중복돼도 결과가 같다", () => {
    const ordered = range("2026-08-24", "2026-09-06");
    const shuffled = [...ordered].reverse().concat(ordered);
    expect(resolveComparisonPeriods({ dates: shuffled })).toEqual(
      resolveComparisonPeriods({ dates: ordered }),
    );
  });

  it("읽을 수 없는 값은 무시하되 남은 날짜로 판정한다", () => {
    const result = resolveComparisonPeriods({
      dates: [...range("2026-08-24", "2026-09-06"), "합계", "", null, "2026-02-30"],
    });
    expect(result.ok).toBe(true);
    expect(result.current.end).toBe("2026-09-06");
  });
});

describe("비교할 수 없으면 값을 지어내지 않는다", () => {
  it("날짜가 하나도 없으면 no_dates", () => {
    const result = resolveComparisonPeriods({ dates: ["합계", "", null] });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("no_dates");
    expect(result.current).toBeNull();
    expect(result.previous).toBeNull();
  });

  it("지난 기간에 데이터가 없으면 no_previous_data — 기간 자체는 돌려준다", () => {
    const result = resolveComparisonPeriods({ dates: range("2026-08-31", "2026-09-06") });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("no_previous_data");
    expect(result.current).toEqual({ start: "2026-08-31", end: "2026-09-06", days: 7 });
    expect(result.previous).toEqual({ start: "2026-08-24", end: "2026-08-30", days: 7 });
  });

  it("지난 기간이 하루라도 겹치면 진행한다", () => {
    const result = resolveComparisonPeriods({ dates: ["2026-08-30", ...range("2026-08-31", "2026-09-06")] });
    expect(result.ok).toBe(true);
  });
});

describe("사용자 날짜 필터", () => {
  const dates = range("2026-07-01", "2026-09-06");

  it("이번 기간만 지정하면 같은 길이로 바로 앞 구간을 잡는다", () => {
    const result = resolveComparisonPeriods({
      dates,
      custom: { currentStart: "2026-08-24", currentEnd: "2026-09-06" },
    });
    expect(result.ok).toBe(true);
    expect(result.current).toEqual({ start: "2026-08-24", end: "2026-09-06", days: 14 });
    expect(result.previous).toEqual({ start: "2026-08-10", end: "2026-08-23", days: 14 });
    expect(result.warnings).toEqual([]);
  });

  it("두 기간을 모두 지정하면 그대로 쓴다 (격주 비교)", () => {
    const result = resolveComparisonPeriods({
      dates,
      custom: {
        currentStart: "2026-08-31", currentEnd: "2026-09-06",
        previousStart: "2026-08-17", previousEnd: "2026-08-23",
      },
    });
    expect(result.previous).toEqual({ start: "2026-08-17", end: "2026-08-23", days: 7 });
    expect(result.warnings).toEqual([]);
  });

  it("길이가 다르면 막지 않고 경고만 남긴다", () => {
    const result = resolveComparisonPeriods({
      dates,
      custom: {
        currentStart: "2026-08-31", currentEnd: "2026-09-02",
        previousStart: "2026-08-17", previousEnd: "2026-08-23",
      },
    });
    expect(result.ok).toBe(true);
    expect(result.warnings).toEqual(["length_mismatch"]);
  });

  it("범위가 뒤집혔거나 읽을 수 없으면 invalid_custom_range", () => {
    expect(resolveComparisonPeriods({ dates, custom: { currentStart: "2026-09-06", currentEnd: "2026-08-31" } }).reason)
      .toBe("invalid_custom_range");
    expect(resolveComparisonPeriods({ dates, custom: { currentStart: "어제", currentEnd: "2026-08-31" } }).reason)
      .toBe("invalid_custom_range");
  });

  it("사용자 기간에도 부분 주·소표본 판정이 그대로 걸린다", () => {
    const result = resolveComparisonPeriods({
      dates,
      custom: { currentStart: "2026-09-05", currentEnd: "2026-09-06" },
    });
    expect(result.partial).toBe(true);
    expect(result.smallSample).toBe(true);
    expect(result.volumeMultiplier).toBe(2);
  });
});

describe("로컬 시간대 접근자를 쓰지 않는다", () => {
  // 앞서 이 자리에 `process.env.TZ`를 바꿔 보는 테스트가 있었는데, Node는 이미 초기화된
  // 시간대를 그대로 쓰므로 그 테스트는 무엇도 검사하지 않고 항상 통과했다. 실제 위험은
  // `getUTCDay()` 대신 `getDay()`를 쓰는 것 하나뿐이라, 그것을 직접 막는다.
  it("소스에 getDay/getMonth 같은 로컬 접근자가 없다", () => {
    const source = readFileSync(new URL("./period.js", import.meta.url), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")   // 주석이 가드를 속이지 못하도록 먼저 제거
      .replace(/\/\/.*$/gm, "");
    const local = source.match(/\.get(?!UTC)(FullYear|Month|Date|Day|Hours|Minutes)\b/g) || [];
    expect(local).toEqual([]);
    // 가드가 무엇도 안 보고 통과하지 않도록, UTC 접근자는 실제로 쓰이고 있어야 한다.
    expect((source.match(/\.getUTC[A-Za-z]+\(/g) || []).length).toBeGreaterThan(3);
  });

  it("파싱은 로컬 자정이 아니라 UTC 자정이다", () => {
    // 로컬 파싱이면 UTC+9에서 이 값의 UTC 날짜가 하루 앞으로 밀린다.
    expect(parseUtcDate("2026-08-31").toISOString()).toBe("2026-08-31T00:00:00.000Z");
  });
});


it("월 프리셋의 부분 월은 전월 전체와 길이가 다름을 알린다", () => {
  const result = resolveComparisonPeriods({ dates: range("2026-08-01", "2026-09-06"), custom: { preset: "month" } });
  expect(result.current).toEqual({ start: "2026-09-01", end: "2026-09-06", days: 6 });
  expect(result.previous.days).toBe(31);
  expect(result.warnings).toContain("length_mismatch");
});
