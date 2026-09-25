import { describe, expect, it } from "vitest";
import { creativeStatusFigure } from "./coreFigures";

describe("소재 상태 띠는 소재 하나를 한 상태에만 센다", () => {
  const fatigue = [
    { creative_id: "a", fatigued: true, reason: null },   // 알림 + 피로
    { creative_id: "b", fatigued: false, reason: null },  // 알림만(피로 판정은 아님)
    { creative_id: "c", fatigued: true, reason: null },   // 피로, 알림 없음
    { creative_id: "d", fatigued: false, reason: null },  // 비피로
    { creative_id: "e", fatigued: false, reason: "too_short" }, // 판정 불가
    { creative_id: "f", fatigued: false, reason: "too_short" }, // 판정 불가인데 알림 → 알림이 먼저
  ];
  const alerts = ["a", "b", "f"].map((creative_id) => ({ creative_id, alert: true })).concat([{ creative_id: "d", alert: false }]);

  it("합이 소재 수와 같고, 알림은 결론 문장의 알림 수와 같다", () => {
    const figure = creativeStatusFigure({ fatigue, alerts, isReviewable: (item) => item.reason == null, locale: "ko" });
    expect(figure.data.map((row) => [row.status, row.count])).toEqual([
      ["현재 알림", 3], ["피로 감지·알림 없음", 1], ["판정 가능·비피로", 1], ["기간 부족", 1],
    ]);
    expect(figure.data.reduce((sum, row) => sum + row.count, 0)).toBe(fatigue.length);
    expect(figure.options.variant).toBe("status-share");
  });

  it("판정 가능 기준과 불가 라벨은 화면이 정한다", () => {
    const figure = creativeStatusFigure({ fatigue, alerts: [], isReviewable: () => false, insufficientLabel: "기간·노출 부족", locale: "ko" });
    expect(figure.data.at(-1)).toMatchObject({ status: "기간·노출 부족", count: 6 });
  });
});
