/* ============================================================
 * outcomeType — 종속변수의 척도를 판별해 맞는 모형으로 보낸다
 *
 * 9-1은 성과변수가 0/1이면 R의 binomial GLM으로 보내고 **그 외에는 전부 OLS**로
 * 보냈다. 그래서 CTR·CVR·리텐션 같은 0~1 비율과 설치·전환 같은 카운트가 모두
 * OLS 버킷에 떨어졌다. 둘 다 OLS 가정이 깨지는 자료다.
 *
 *  - 비율(0~1 유계): OLS는 구간 밖을 예측하고, 분산이 평균에 묶인 걸 무시한다.
 *  - 카운트: 거의 항상 과산포(var ≫ mean)라 OLS·Poisson 모두 SE를 과소추정한다
 *    = 없는 유의를 만든다.
 *
 * 이 모듈은 **판별과 과산포 진단만** 한다(순수 함수·결정론). 적합은 각 엔진이
 * 맡는다. R 없이 검증 가능해야 라우팅 결정 자체를 골든으로 고정할 수 있다.
 * ============================================================ */

export const OUTCOME_CONFIG = Object.freeze({
  // 카운트로 보려면 정수 비율이 이 이상이어야 한다. 소수점이 섞이면 카운트가 아니다.
  countIntegerRatio: 1,
  // 카운트 판정에 필요한 최소 서로 다른 값 — 0/1/2뿐이면 카운트 모형이 과하다.
  countMinDistinct: 3,
  // Pearson χ²/df 가 이 값을 넘으면 Poisson 대신 음이항으로 간다.
  overdispersionRatio: 1.5,
  // 비율 판정: 경계(0·1)를 포함하면 betareg가 그대로는 못 받는다 — 축소변환 필요.
  proportionEpsilon: 1e-9,
});

const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);

/**
 * 종속변수 척도 판별.
 * @returns {{kind:"binary"|"proportion"|"count"|"continuous"|"degenerate", ...}}
 */
export function classifyOutcome(values = [], config = OUTCOME_CONFIG) {
  const clean = values.filter(isFiniteNumber);
  if (clean.length === 0) return { kind: "degenerate", reason: "no_finite_values", n: 0 };
  const distinct = new Set(clean);
  if (distinct.size < 2) return { kind: "degenerate", reason: "constant_outcome", n: clean.length };

  const min = Math.min(...clean);
  const max = Math.max(...clean);

  if (distinct.size === 2 && distinct.has(0) && distinct.has(1)) {
    return { kind: "binary", n: clean.length, min, max, distinct: distinct.size };
  }

  const allIntegers = clean.every((value) => Number.isInteger(value));
  const nonNegative = min >= 0;

  // 0~1 유계이고 정수만은 아니면 비율. 경계 포함 여부를 함께 돌려준다 —
  // betareg는 (0,1) 개구간만 받으므로 소비처가 축소변환을 결정해야 한다.
  if (min >= 0 && max <= 1 && !allIntegers) {
    const hasBoundary = clean.some((value) => value <= config.proportionEpsilon || value >= 1 - config.proportionEpsilon);
    return { kind: "proportion", n: clean.length, min, max, hasBoundary, distinct: distinct.size };
  }

  if (allIntegers && nonNegative && distinct.size >= config.countMinDistinct) {
    return { kind: "count", n: clean.length, min, max, distinct: distinct.size };
  }

  return { kind: "continuous", n: clean.length, min, max, distinct: distinct.size };
}

/**
 * 과산포 진단. Poisson 가정(분산 = 평균)이 깨졌는지 본다.
 * 적합 없이 주변분포로만 보는 근사라 "음이항으로 갈지"의 **1차 게이트**로만 쓴다 —
 * 최종 판단은 실제 Poisson 적합의 Pearson χ²/df로 한다(countRegression).
 */
export function marginalOverdispersion(values = [], config = OUTCOME_CONFIG) {
  const clean = values.filter(isFiniteNumber);
  const n = clean.length;
  if (n < 2) return { ok: false, reason: "insufficient_rows" };
  const mean = clean.reduce((sum, value) => sum + value, 0) / n;
  if (!(mean > 0)) return { ok: false, reason: "non_positive_mean" };
  const variance = clean.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (n - 1);
  const ratio = variance / mean;
  return {
    ok: true,
    mean,
    variance,
    ratio,
    isOverdispersed: ratio > config.overdispersionRatio,
  };
}

/**
 * 척도 → 사용할 모형. 표시층이 "왜 이 모형인가"를 그대로 쓸 수 있게 사유를 함께 낸다.
 * 라우팅을 문자열로 돌려주는 이유: R 없이 이 결정 자체를 테스트할 수 있어야 한다.
 */
export function chooseOutcomeModel(values = [], config = OUTCOME_CONFIG) {
  const classification = classifyOutcome(values, config);
  switch (classification.kind) {
    case "binary":
      return { model: "binomial", classification, reason: "binary_outcome" };
    case "proportion":
      return { model: "beta", classification, reason: "bounded_proportion" };
    case "count": {
      const dispersion = marginalOverdispersion(values, config);
      return {
        model: dispersion.ok && dispersion.isOverdispersed ? "negbin" : "poisson",
        classification,
        dispersion,
        reason: dispersion.ok && dispersion.isOverdispersed ? "overdispersed_count" : "count_outcome",
      };
    }
    case "degenerate":
      return { model: null, classification, reason: classification.reason };
    default:
      return { model: "gaussian", classification, reason: "continuous_outcome" };
  }
}
