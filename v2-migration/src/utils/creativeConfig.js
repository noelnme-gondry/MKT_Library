// 소재 분석과 통합 결과 허브가 같은 판단 기준을 쓰도록 설정을 한 곳에 둔다.
// 통계 엔진은 변경하지 않고, 렌더·요약 경로만 이 설정을 공유한다.
export const CREATIVE_CONFIG = {
  version: "1.0.0", seed: 42, decimalPlaces: 4, minImpressions: 1000, minNCell: 5,
  decompose: { metrics: ["ctr", "cvr", "cpa", "roas"], controls: ["channel", "iso_week"], method: "wls", vifThreshold: 5.0, vifDropPriority: ["duration_bucket", "has_text_overlay"], alpha: 0.05, multipleTesting: "bh" },
  fatigue: { decayWindow: 7, dropPct: 0.2 },
  fatigueAlert: { minDays: 7, trendWindow: 14, ctrWeight: 0.45, freqWeight: 0.35, cpmWeight: 0.2, alertScore: 0.5, horizonDays: 30 },
  autoPlanner: { defaultWeeklyVelocity: 3, urgentDays: 7, soonDays: 21 },
  matrix: { rows: "message_angle", cols: "format" },
  bayes: { priorA: 1, priorB: 1, gridN: 2000, promoteProb: 0.95, killProb: 0.05 },
  test: { exploreRatio: 0.3, batchSize: 6, power: 0.8, alpha: 0.05 },
};
