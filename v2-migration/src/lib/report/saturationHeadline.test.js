import { describe, expect, it } from "vitest";
import { saturationHeadline } from "./saturationHeadline";

describe("saturationHeadline — conclusion sentence for spend headroom", () => {
  it("says what to do with each group, not only how many there are", () => {
    expect(saturationHeadline({ total: 6, saturated: ["A", "B", "C", "D"], headroom: ["E", "F"], grain: "채널" }))
      .toBe("6개 채널 중 4곳은 증액을 멈추고, 2곳(E, F)은 소폭 증액을 시험해 볼 만합니다.");
    expect(saturationHeadline({ total: 3, saturated: ["A"], headroom: [], grain: "캠페인" }))
      .toBe("3개 캠페인 중 1곳(A)은 더 쓰면 효율이 지금 평균보다 나빠집니다. 증액을 멈추세요.");
    expect(saturationHeadline({ total: 4, saturated: [], headroom: ["A", "B", "C"], grain: "채널" }))
      .toBe("4개 채널 중 3곳(A, B 등)은 더 써도 효율이 지금 평균보다 좋습니다. 소폭 증액을 시험해 볼 만합니다.");
    // 전부가 같은 판정이면 "4개 중 4곳" 대신 "모두"라고 말하고 이름을 늘어놓지 않는다.
    expect(saturationHeadline({ total: 4, saturated: ["A", "B", "C", "D"], headroom: [], grain: "채널" }))
      .toBe("4개 채널 모두 더 쓰면 효율이 지금 평균보다 나빠집니다. 증액을 멈추세요.");
    expect(saturationHeadline({ total: 2, saturated: [], headroom: ["A", "B"], grain: "채널" }))
      .toBe("2개 채널 모두 더 써도 효율이 지금 평균보다 좋습니다. 소폭 증액을 시험해 볼 만합니다.");
    expect(saturationHeadline({ total: 2, saturated: [], headroom: [], grain: "채널" }))
      .toBe("2개 채널 모두 효율이 유지되는 구간입니다. 배분을 크게 바꿀 근거는 약합니다.");
  });

  it("abstains honestly when nothing can be judged", () => {
    expect(saturationHeadline({ total: 0, grain: "채널" })).toBe("판단 보류: 판단할 만큼 일별 데이터가 쌓인 채널이 없습니다.");
    expect(saturationHeadline({ total: 0, grain: "캠페인" })).toBe("판단 보류: 판단할 만큼 일별 데이터가 쌓인 캠페인이 없습니다.");
    expect(saturationHeadline({ total: 0, grain: "Channel", locale: "en" })).toContain("On hold");
  });

  it("writes English without Korean and never promises improvement", () => {
    const text = saturationHeadline({ total: 6, saturated: ["A"], headroom: ["E"], grain: "Channel", locale: "en" });
    expect(text).toBe("Of 6 channels, hold increases on 1 and test a small increase on 1 (E).");
    for (const locale of ["ko", "en"]) {
      for (const args of [{ total: 3, saturated: ["A"], headroom: ["B"] }, { total: 3, saturated: ["A"], headroom: [] }, { total: 3, saturated: [], headroom: ["B"] }]) {
        const sentence = saturationHeadline({ ...args, locale });
        expect(sentence).not.toMatch(/보장|guarantee|will improve|개선됩니다/);
        if (locale === "en") expect(/[가-힣]/.test(sentence)).toBe(false);
      }
    }
  });
});
