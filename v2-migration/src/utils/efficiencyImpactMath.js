// 효율 변화의 금액 환산 — 순수 함수(골든).
//
// 결론이 "CPA가 12% 올랐습니다"에서 끝나면 그 숫자가 얼마짜리 문제인지 알 수 없다.
// 여기서 계산하는 값은 **예측이 아니라 산술 환산**이다: 관측된 기간의 전환량을
// 그대로 두고, 효율만 직전 기간 수준이었다면 비용이 얼마였을지 대비한 차액을
// 지정한 일수로 환산한다. 미래 성과 보장이 아니며(§8 L-04) 호출부는 이 사실을
// 화면 문구로 함께 말해야 한다.
//
//   diffPerConversion = recentUnitCost - priorUnitCost
//   windowImpact      = diffPerConversion × recentConversions        (관측 창의 차액)
//   projected         = windowImpact × (projectionDays / windowDays) (일수 환산)
//
// 통화 환산은 하지 않는다 — 입력과 출력의 통화가 같다(§7 고정 환율 함정).

const DEFAULT_PROJECTION_DAYS = 30;

function finitePositive(value) {
  return Number.isFinite(value) && value > 0;
}

/**
 * @param {object} input
 * @param {number} input.priorUnitCost   직전 기간의 전환당 비용(CPA·CPI 등)
 * @param {number} input.recentUnitCost  최근 기간의 전환당 비용
 * @param {number} input.recentConversions 최근 기간의 전환 수
 * @param {number} input.windowDays      최근 기간의 일수
 * @param {number} [input.projectionDays] 환산할 일수(기본 30)
 * @returns {null|{direction:"worse"|"better"|"flat", diffPerConversion:number,
 *   windowImpact:number, projectedImpact:number, projectionDays:number,
 *   windowDays:number, conversions:number, dailyImpact:number}}
 *   계산할 수 없으면 null — 0으로 떨어뜨리지 않는다("계산 불가"를 좋은 값으로
 *   접으면 그 자체가 거짓 숫자다, §7).
 */
export function efficiencyMoneyImpact({
  priorUnitCost,
  recentUnitCost,
  recentConversions,
  windowDays,
  projectionDays = DEFAULT_PROJECTION_DAYS,
} = {}) {
  if (!finitePositive(priorUnitCost) || !finitePositive(recentUnitCost)) return null;
  if (!finitePositive(recentConversions) || !finitePositive(windowDays)) return null;
  if (!finitePositive(projectionDays)) return null;

  const diffPerConversion = recentUnitCost - priorUnitCost;
  const windowImpact = diffPerConversion * recentConversions;
  const dailyImpact = windowImpact / windowDays;
  return {
    direction: diffPerConversion > 0 ? "worse" : diffPerConversion < 0 ? "better" : "flat",
    diffPerConversion,
    conversions: recentConversions,
    windowDays,
    windowImpact,
    dailyImpact,
    projectionDays,
    projectedImpact: dailyImpact * projectionDays,
  };
}
