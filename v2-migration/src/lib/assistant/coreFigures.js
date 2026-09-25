// 분석별 핵심 그림의 사양(질문 문구·variant·옵션)을 한 곳에서 만든다. 결과 작업대 어댑터와
// 도구 화면이 같은 사양을 쓰므로 같은 분석이 두 화면에서 다른 질문·다른 모양으로 나오지 않는다.
// 값은 호출부가 엔진에서 받은 것만 넘긴다 — 여기서는 엔진 계산을 하지 않고, 상태별 개수 세기만 한다.

const tr = (locale, ko, en) => (locale === "en" ? en : ko);
const safe = (value) => (typeof value === "number" && Number.isFinite(value) ? value : null);

/** 5-21 성과 변동: 직전 → 비중(mix) → 효율(rate) → 최근 다리 + 대상별 두 성분. rows: [{entity, mix, rate, contribution}] */
export function mixRateFigure({ rows, start, end, metric, locale }) {
  return {
    id: "pvm-channel-contributions",
    kind: "bar",
    question: tr(locale, `${metric} 변화는 비중 변화와 효율 변화 중 어디서 왔는가?`, `Did the ${metric} change come from mix or from rate?`),
    data: rows,
    options: { x: "entity", y: "contribution", variant: "mix-rate", start: safe(start), end: safe(end), metric, unit: "currency" },
  };
}

/** 5-3 예산 재배분: 대상별 지금 하루 예산 ↔ 바꾼 안. rows: [{entity, current, budget, ...}] */
export function budgetShiftFigure({ rows, locale }) {
  return {
    id: "budget-allocation-baseline",
    kind: "bar",
    question: tr(locale, "채널별 하루 예산을 지금에서 얼마나 옮기나?", "How much daily budget moves per channel?"),
    data: rows,
    options: { x: "entity", y: "budget", variant: "budget-shift", from: "current", to: "budget", unit: "currency" },
  };
}

/** 5-22 포화도: 평균 단가 ↔ 한계 단가. rows: [{entity, averageUnitCost, marginalUnitCost, verdict, ...}] */
export function unitCostGapFigure({ rows, metric, locale }) {
  return {
    id: "saturation-ranking",
    kind: "bar",
    question: tr(locale, "어디에 증액 위험 또는 여유 신호가 있는가?", "Where are the signals of scaling risk or headroom?"),
    data: rows,
    options: { x: "entity", y: "saturationIndex", variant: "unit-cost-gap", from: "averageUnitCost", to: "marginalUnitCost", metric, unit: "currency" },
  };
}

/** 5-25 채널 중복: 채널별 VIF와 엔진 기준선. rows: [{entity, vif, isComputable}] */
export function vifFigure({ rows, thresholds, locale }) {
  return {
    id: "vif-by-entity",
    kind: "bar",
    question: tr(locale, "채널별 지출 중복은 어느 수준인가?", "How much does spend overlap by channel?"),
    data: rows,
    options: { x: "entity", y: "vif", variant: "vif-threshold", thresholds },
  };
}

/**
 * 9-6 소재 상태: 소재 하나가 정확히 한 상태에만 들어가게 센다(띠의 합 = 소재 수).
 * 순서는 심각한 쪽부터 — 현재 알림 → 판정 불가 → 피로 감지(알림 없음) → 판정 가능·비피로(띠 표시는 알림·피로·비피로·불가 순).
 * `isReviewable`은 화면마다 판정 가능 기준이 달라 호출부가 넘긴다(도구는 노출 하한까지 본다).
 */
export function creativeStatusFigure({ fatigue, alerts, isReviewable, insufficientLabel, locale }) {
  const alerting = new Set((alerts || []).filter((item) => item.alert).map((item) => item.creative_id));
  const counts = [0, 0, 0, 0];
  for (const item of fatigue || []) {
    // 알림이 먼저다 — 결론 문장의 "현재 알림 N개"와 띠가 같은 수를 말해야 한다.
    if (alerting.has(item.creative_id)) counts[0] += 1;
    else if (!isReviewable(item)) counts[3] += 1;
    else if (item.fatigued) counts[1] += 1;
    else counts[2] += 1;
  }
  const labels = [
    tr(locale, "현재 알림", "Alerting now"),
    tr(locale, "피로 감지·알림 없음", "Fatigue detected, no alert"),
    tr(locale, "판정 가능·비피로", "Analyzable, not fatigued"),
    insufficientLabel || tr(locale, "기간 부족", "History too short"),
  ];
  return {
    id: "creative-fatigue-status",
    kind: "bar",
    question: tr(locale, "교체 검토가 필요한 소재는 몇 개인가?", "How many creatives need replacement review?"),
    // 소재 상태는 하나의 전체를 나눈 비율이라 막대 네 개가 아니라 띠 하나로 본다.
    data: labels.map((status, index) => ({ status, count: counts[index], tone: ["worse", "caution", "better", "muted"][index] })),
    options: { x: "status", y: "count", variant: "status-share" },
  };
}
