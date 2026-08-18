import { describe, expect, it } from "vitest";
import { comparePeriodLengths, describePeriod, formatCountDelta, formatPeriod, formatRateDelta } from "@/utils/periodCompare";

describe("describePeriod", () => {
  it("정렬·중복 제거 후 시작·끝·일수를 낸다", () => {
    expect(describePeriod(["2025-03-03", "2025-03-01", "2025-03-01", "2025-03-02"]))
      .toEqual({ start: "2025-03-01", end: "2025-03-03", days: 3 });
  });

  it("빈 입력은 null — 없는 기간을 만들지 않는다", () => {
    expect(describePeriod([])).toBeNull();
    expect(describePeriod(null)).toBeNull();
    expect(describePeriod(["", "  "])).toBeNull();
  });
});

describe("formatPeriod", () => {
  it("날짜와 일수를 함께 적어 검증 가능하게 한다", () => {
    const period = { start: "2025-03-01", end: "2025-04-11", days: 42 };
    expect(formatPeriod(period)).toBe("2025-03-01 ~ 2025-04-11 (42일)");
    expect(formatPeriod(period, "en")).toBe("2025-03-01 ~ 2025-04-11 (42 days)");
  });

  it("EN 단수/복수를 가른다", () => {
    expect(formatPeriod({ start: "a", end: "a", days: 1 }, "en")).toContain("(1 day)");
  });

  it("없는 기간은 그렇다고 말한다", () => {
    expect(formatPeriod(null)).toBe("데이터 없음");
    expect(formatPeriod(null, "en")).toBe("no data");
  });
});

describe("comparePeriodLengths", () => {
  it("길이가 같으면 balanced", () => {
    expect(comparePeriodLengths({ days: 42 }, { days: 42 }).balanced).toBe(true);
  });

  it("길이가 다르면 사실을 돌려준다 — 조용히 넘기지 않는다", () => {
    const result = comparePeriodLengths({ days: 42 }, { days: 43 });
    expect(result).toEqual({ balanced: false, reason: "unequal", beforeDays: 42, afterDays: 43 });
  });

  it("한쪽이 없으면 missing", () => {
    expect(comparePeriodLengths(null, { days: 1 }).reason).toBe("missing");
  });
});

describe("formatRateDelta", () => {
  it("비율 변화는 %p와 % 를 함께 — 접미사로 단위를 가른다", () => {
    const delta = formatRateDelta(0.3210, 0.2100);
    expect(delta.text).toBe("−11.10%p (−34.6%)");
    expect(delta.tone).toBe("down");
  });

  it("상승은 + 부호", () => {
    expect(formatRateDelta(0.30, 0.40).text).toBe("+10.00%p (+33.3%)");
  });

  it("기준이 0이면 상대 변화를 만들지 않는다", () => {
    expect(formatRateDelta(0, 0.1).text).toBe("+10.00%p");
  });

  it("변화 없음은 부호 없이", () => {
    expect(formatRateDelta(0.25, 0.25).tone).toBe("flat");
  });

  it("계산 불가는 null", () => {
    expect(formatRateDelta(null, 0.2)).toBeNull();
    expect(formatRateDelta(0.2, Infinity)).toBeNull();
  });
});

describe("formatCountDelta", () => {
  it("수량은 상대 %만 — %p는 의미가 없다", () => {
    expect(formatCountDelta(3000, 4000).text).toBe("+33.3%");
    expect(formatCountDelta(4000, 3000).text).toBe("−25.0%");
  });

  it("기준이 0이면 비율을 만들지 않는다", () => {
    expect(formatCountDelta(0, 100).text).toBe("—");
  });
});
