// 분석별 핵심 그림의 사양(질문 문구·variant·옵션)을 한 곳에서 만든다. 결과 작업대 어댑터와
// 도구 화면이 같은 사양을 쓰므로 같은 분석이 두 화면에서 다른 질문·다른 모양으로 나오지 않는다.
// 값은 호출부가 엔진에서 받은 것만 넘긴다(여기서는 계산하지 않는다).

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
