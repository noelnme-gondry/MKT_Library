/**
 * 적합도 등급 — 렌더 전용 판정.
 *
 * 왜 필요한가: 화면이 WMAPE를 숫자로만 보여주면 "35.8%"가 좋은지 나쁜지 사용자가
 * 알 수 없다. 통계를 모르는 사람이 결론을 읽게 하는 것이 §12.17(쉬운말 우선)이다.
 *
 * 수학은 건드리지 않는다 — 이미 계산된 오차를 구간으로 나눠 이름을 붙일 뿐이다.
 * 임계값은 상수로 분리해 둔다(§8 — 판정 임계는 config로).
 */

// 주간 마케팅 패널에서 흔히 보는 범위 기준. 학습 오차와 OOS 오차 모두 같은 자로 잰다.
export const FIT_THRESHOLDS = { strong: 5, fair: 12 };

/**
 * @param {number} wmape 백분율(예: 9.5 = 9.5%)
 * @returns {{ id: "strong"|"fair"|"weak"|"unknown", ko: string, en: string, tone: "good"|"neutral"|"bad" }}
 */
export function fitGrade(wmape) {
  // 계산되지 않은 것을 좋은 등급으로 접지 않는다(§7 — 미상은 미상 버킷으로).
  // `Number(null)`과 `Number("")`은 0이라 그냥 Number()로 받으면 **계산 실패가
  // "잘 맞음"이 된다** — 골든이 실제로 이 구현을 잡았다.
  if (wmape === null || wmape === undefined || wmape === "" || typeof wmape === "boolean") {
    return { id: "unknown", ko: "판정 불가", en: "Not available", tone: "neutral" };
  }
  const value = Number(wmape);
  if (!Number.isFinite(value) || value < 0) {
    return { id: "unknown", ko: "판정 불가", en: "Not available", tone: "neutral" };
  }
  if (value <= FIT_THRESHOLDS.strong) return { id: "strong", ko: "잘 맞음", en: "Strong fit", tone: "good" };
  if (value <= FIT_THRESHOLDS.fair) return { id: "fair", ko: "쓸 만함", en: "Fair fit", tone: "neutral" };
  return { id: "weak", ko: "안 맞음", en: "Weak fit", tone: "bad" };
}

/**
 * 학습 오차가 OOS 오차보다 나쁘면 그 순간 적합값이 아니다 — 실제로 절단 사후분포의
 * 평균을 점예측으로 쓰다가 학습 35.8% vs OOS 9.5%가 나온 사고가 있었다(§7).
 * 등급만 보면 이 역전이 안 보이므로 따로 알린다.
 */
export function isFitInverted(trainWmape, oosWmape) {
  const train = Number(trainWmape);
  const oos = Number(oosWmape);
  if (!Number.isFinite(train) || !Number.isFinite(oos)) return false;
  return train > oos;
}
