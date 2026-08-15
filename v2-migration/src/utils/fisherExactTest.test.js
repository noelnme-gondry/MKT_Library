import { describe, expect, it } from "vitest";
import { STATS } from "./abTestMath";

// 골든값은 BigInt 고정소수점(10^30 스케일) 초기하 합산으로 독립 산출했다 —
// logGamma를 전혀 쓰지 않는 경로라 구현 오류가 골든에 그대로 복사되지 않는다.
// 첫 케이스는 Fisher 차 시음 실험의 알려진 값 34/70과 정확히 일치한다.
// 구현은 전 케이스에서 상대오차 2e-14 이하로 이 값들과 맞는다.
describe("Fisher 정확검정 (2×2)", () => {
  it.each([
    // [nA, xA, nB, xB, 정확값]
    [4, 3, 4, 1, 0.485714285714285714],
    [10, 2, 9, 7, 0.023014137565221157],
    [200, 3, 200, 12, 0.031867041512461341],
    [50, 0, 50, 5, 0.056284494428824326],
    [40, 5, 60, 21, 0.018879480031622821],
  ])("nA=%i xA=%i nB=%i xB=%i → p=%f", (nA, xA, nB, xB, expected) => {
    const result = STATS.fisherExact2x2(nA, xA, nB, xB);
    expect(result.pValue).toBeCloseTo(expected, 13);
  });

  it("전환이 전무하거나 전부면 검정할 여지가 없다(p=1)", () => {
    expect(STATS.fisherExact2x2(12, 0, 12, 0).pValue).toBe(1);
    expect(STATS.fisherExact2x2(12, 12, 12, 12).pValue).toBe(1);
  });

  it("완전히 같은 두 그룹은 p=1", () => {
    expect(STATS.fisherExact2x2(30, 15, 30, 15).pValue).toBeCloseTo(1, 12);
  });

  it("그룹을 바꿔 넣어도 같은 p (양측검정 대칭)", () => {
    const forward = STATS.fisherExact2x2(40, 5, 60, 21);
    const swapped = STATS.fisherExact2x2(60, 21, 40, 5);
    expect(forward.pValue).toBeCloseTo(swapped.pValue, 12);
  });

  it("퇴화·비정수 입력은 null (가비지 p를 만들지 않는다)", () => {
    expect(STATS.fisherExact2x2(0, 0, 10, 1)).toBeNull();
    expect(STATS.fisherExact2x2(10, 11, 10, 1)).toBeNull();
    expect(STATS.fisherExact2x2(10, -1, 10, 1)).toBeNull();
    expect(STATS.fisherExact2x2(10.5, 1, 10, 1)).toBeNull();
    expect(STATS.fisherExact2x2(NaN, 1, 10, 1)).toBeNull();
  });

  it("정규근사가 낙관적인 구간에서 z보다 보수적이다", () => {
    // 이게 이 검정을 넣는 이유다 — z는 유의, 정확검정은 유의하지 않다고 말한다.
    const z = STATS.twoPropZTest(50, 0, 50, 5);
    const exact = STATS.fisherExact2x2(50, 0, 50, 5);
    expect(z.pValue).toBeLessThan(0.05);
    expect(exact.pValue).toBeGreaterThan(0.05);
  });

  it("결정론 — 같은 입력은 byte-identical", () => {
    const first = STATS.fisherExact2x2(200, 3, 200, 12);
    const second = STATS.fisherExact2x2(200, 3, 200, 12);
    expect(first).toEqual(second);
  });
});

describe("근사 신뢰 가능 여부 판정", () => {
  it("기대빈도가 작으면 정확검정을 권고한다", () => {
    expect(STATS.shouldPreferExactTest(4, 3, 4, 1)).toBe(true);
    expect(STATS.shouldPreferExactTest(10, 2, 9, 7)).toBe(true);
  });

  it("기대빈도가 충분해도 전환 건수가 적으면 권고한다", () => {
    // 기대빈도는 전부 7.5라 Cochran 기준은 통과하지만 z가 2배 낙관적인 구간.
    expect(STATS.shouldPreferExactTest(200, 3, 200, 12)).toBe(true);
  });

  it("표본과 전환이 모두 충분하면 근사를 그대로 쓴다", () => {
    expect(STATS.shouldPreferExactTest(30, 15, 30, 15)).toBe(false);
    expect(STATS.shouldPreferExactTest(1000, 120, 1000, 150)).toBe(false);
  });

  it("임계값은 config로 분리돼 있다", () => {
    expect(STATS.EXACT_TEST_CONFIG).toEqual({ minExpectedCell: 5, minSuccessCount: 10 });
    const loose = { minExpectedCell: 0, minSuccessCount: 0 };
    expect(STATS.shouldPreferExactTest(200, 3, 200, 12, loose)).toBe(false);
  });
});

describe("Holm 보정 (공용 추출)", () => {
  it("원래 순서를 유지하고 단조 비감소를 강제한다", () => {
    const adjusted = STATS.holmAdjust([0.01, 0.04, 0.03]);
    expect(adjusted).toEqual([0.03, 0.06, 0.06]);
  });

  it("1을 넘지 않는다", () => {
    expect(STATS.holmAdjust([0.5, 0.6]).every((value) => value <= 1)).toBe(true);
  });

  it("비유한 p는 1로 취급한다(가비지가 유의로 새지 않게)", () => {
    expect(STATS.holmAdjust([NaN])).toEqual([1]);
  });
});
