import { describe, expect, it } from "vitest";
import { abHeadline } from "./abHeadline";

describe("abHeadline — one-sentence A/B conclusion", () => {
  it("states both rates, the relative gap and whether it is beyond chance", () => {
    expect(abHeadline({ significant: true, liftRel: 0.2518, controlRate: 4.4, testRate: 5.5 }))
      .toBe("Test 전환율(5.50%)이 Control(4.40%)보다 25.2% 높고, 우연으로 보기 어려운 차이입니다.");
    expect(abHeadline({ significant: true, liftRel: -0.1, controlRate: 5, testRate: 4.5 }))
      .toBe("Test 전환율(4.50%)이 Control(5.00%)보다 10.0% 낮고, 우연으로 보기 어려운 차이입니다.");
  });

  it("does not call a non-significant gap 'no effect'", () => {
    const ko = abHeadline({ significant: false, liftRel: 0.03, controlRate: 4.4, testRate: 4.53 });
    expect(ko).toBe("Test 전환율(4.53%)과 Control(4.40%)의 차이는 지금 표본으로는 우연과 구분되지 않습니다.");
    for (const locale of ["ko", "en"]) expect(abHeadline({ significant: false, locale })).not.toMatch(/효과 없|no effect/i);
  });

  it("says the number is a combination when several variants were merged", () => {
    expect(abHeadline({ significant: true, liftRel: 0.2518, controlRate: 4.4, testRate: 5.5, testArmCount: 3 }))
      .toBe("Test 3개를 합친 전환율(5.50%)이 Control(4.40%)보다 25.2% 높고, 우연으로 보기 어려운 차이입니다.");
  });

  it("withholds the effect when the split is off, and writes English without Korean", () => {
    expect(abHeadline({ srmMismatch: true, significant: true, liftRel: 0.5 })).toBe("판단 보류: 그룹 배정 비율이 계획과 달라 차이를 믿을 수 없습니다.");
    const cases = [{ srmMismatch: true }, { significant: true, liftRel: 0.2, controlRate: 4, testRate: 4.8 }, { significant: true, liftRel: 0.2, controlRate: 4, testRate: 4.8, testArmCount: 2 }, { significant: false, controlRate: 4, testRate: 4.1 }];
    for (const args of cases) {
      const text = abHeadline({ ...args, locale: "en" });
      expect(/[가-힣]/.test(text)).toBe(false);
      expect(text.split(/(?<=[.!?])\s+/).filter(Boolean)).toHaveLength(1);
    }
    expect(abHeadline({ significant: true, liftRel: 0.2518, controlRate: 4.4, testRate: 5.5, locale: "en" }))
      .toBe("Test converts at 5.50%, 25.2% above Control (4.40%); unlikely to be chance.");
  });
});
