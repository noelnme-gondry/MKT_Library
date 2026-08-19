import { describe, expect, it } from "vitest";
import { FIT_THRESHOLDS, fitGrade, isFitInverted } from "./modelFitGrade";

describe("fitGrade", () => {
  it("names each band at its boundary", () => {
    expect(fitGrade(0).id).toBe("strong");
    expect(fitGrade(FIT_THRESHOLDS.strong).id).toBe("strong");
    expect(fitGrade(FIT_THRESHOLDS.strong + 0.1).id).toBe("fair");
    expect(fitGrade(FIT_THRESHOLDS.fair).id).toBe("fair");
    expect(fitGrade(FIT_THRESHOLDS.fair + 0.1).id).toBe("weak");
    expect(fitGrade(35.8).id).toBe("weak");
  });

  // 계산 실패를 좋은 등급으로 접으면 식별 불가가 "문제 없음"으로 뒤집힌다(§7).
  it("keeps unavailable separate from good", () => {
    for (const value of [null, undefined, NaN, Infinity, -1, "abc"]) {
      expect(fitGrade(value).id, String(value)).toBe("unknown");
    }
    expect(fitGrade(null).tone).toBe("neutral");
  });

  it("carries both locales and a tone for every band", () => {
    for (const value of [1, 8, 30, null]) {
      const grade = fitGrade(value);
      expect(grade.ko).toBeTruthy();
      expect(grade.en).toBeTruthy();
      expect(["good", "neutral", "bad"]).toContain(grade.tone);
    }
  });
});

describe("isFitInverted", () => {
  // 학습이 OOS보다 나쁘면 적합값 자체가 틀린 것이다(실측: 35.8% vs 9.5%).
  it("flags training error worse than out-of-sample", () => {
    expect(isFitInverted(35.8, 9.5)).toBe(true);
    expect(isFitInverted(5.6, 9.5)).toBe(false);
    expect(isFitInverted(9.5, 9.5)).toBe(false);
  });

  it("stays quiet when either side is missing", () => {
    expect(isFitInverted(null, 9.5)).toBe(false);
    expect(isFitInverted(35.8, undefined)).toBe(false);
  });
});
