/* ============================================================
 * segmentCausalMath — 구성 변화(5-29) 인과 확인
 *
 * 관측 분해(§6.1~6.4)와 운영 지문(§6.5)을 넘어서는 유일한 자리다. 그래서
 * **자격 심사를 먼저 통과해야만 열린다**(설계 §6.6). 자격이 없으면 계수를
 * 만들지 않고 무엇이 없어서 못 하는지만 답한다.
 *
 * 핵심 제약: 개입 시점만 있고 대조군이 없으면 "전후 차이"는 계산되지만 그것은
 * 인과가 아니다 — 같은 시점의 계절성·시장 변화와 구분할 방법이 없기 때문이다.
 * 그래서 대조 범위가 없으면 여기서 열지 않고 5-23(증분)·5-24(브랜드 ITS)로 넘긴다.
 *
 * 방법: 단위·기간 고정효과 + 처리×상대기간 더미(이벤트 스터디), 단위 군집 견고
 * 표준오차. 사전 추세 검사와 위약 검정을 함께 돌려 식별 가정을 사용자가 반증할
 * 수 있게 한다. 비유의는 "효과 없음"이 아니라 "확인되지 않음"이다.
 * ============================================================ */

import { REG_STATS } from "@/utils/regMath";
import { foldCells } from "@/utils/segmentCompositionMath";

export const CAUSAL_THRESHOLDS = {
  minPrePeriods: 3,
  minPostPeriods: 2,
  minTreatedUnits: 2,
  minControlUnits: 2,
  minClusters: 6,      // 이보다 적으면 군집 견고 SE 자체를 믿을 수 없다
  cautionClusters: 12, // 이보다 적으면 계산은 하되 구간을 넓게 읽으라고 말한다
};

export const CAUSAL_REASON = {
  NO_CUTOFF: "NO_CUTOFF",
  CUTOFF_OUT_OF_RANGE: "CUTOFF_OUT_OF_RANGE",
  NOT_ENOUGH_PRE: "NOT_ENOUGH_PRE",
  NOT_ENOUGH_POST: "NOT_ENOUGH_POST",
  NO_CONTROL: "NO_CONTROL",
  NO_TREATED: "NO_TREATED",
  TOO_FEW_CLUSTERS: "TOO_FEW_CLUSTERS",
  FEW_CLUSTERS: "FEW_CLUSTERS",
  UNBALANCED_PANEL: "UNBALANCED_PANEL",
  NO_OUTCOME_VARIANCE: "NO_OUTCOME_VARIANCE",
  NOT_ESTIMABLE: "NOT_ESTIMABLE",
  PRE_TREND_VIOLATED: "PRE_TREND_VIOLATED",
  PLACEBO_FAILED: "PLACEBO_FAILED",
  MEDIATION_NOT_IDENTIFIED: "MEDIATION_NOT_IDENTIFIED",
};

export const CAUSAL_STATUS = { READY: "READY", CAUTION: "CAUTION", BLOCKED: "BLOCKED" };

/**
 * 단위(분석 단위 × 범위) × 기간 패널. 결과변수는 그 칸에서 선택 멤버가 차지하는 비율.
 * 처리 여부는 사용자가 선언한 범위 값으로만 정해진다 — 데이터로 추측하지 않는다.
 */
export function buildUnitPanel({
  panel, dimensionId, memberId, scopeColumn, treatedValues = [], controlValues = [],
} = {}) {
  const records = (panel?.records || []).filter((record) => record.dimensionId === dimensionId);
  const cells = foldCells(records);
  const treated = new Set(treatedValues.map(String));
  const control = new Set(controlValues.map(String));
  const rows = [];

  cells.forEach((cell) => {
    if (cell.denominator == null || cell.denominator <= 0) return;
    const scopeValue = String(cell.scope?.[scopeColumn] ?? "");
    // 처리·대조는 사용자가 선언한 범위 값으로만 정한다. 선언 밖의 값은 분석에 넣지
    // 않는다 — "나머지 전부가 대조군"이라고 가정하면 조용히 다른 시장이 섞인다.
    if (!treated.has(scopeValue) && !control.has(scopeValue)) return;
    rows.push({
      unitKey: `${cell.entityKey}│${scopeValue}`,
      period: cell.time,
      share: (cell.members.get(memberId) || 0) / cell.denominator,
      population: cell.denominator,
      treated: treated.has(scopeValue) ? 1 : 0,
      scopeValue,
    });
  });

  return rows.sort((a, b) => a.period.localeCompare(b.period) || a.unitKey.localeCompare(b.unitKey));
}

/** 자격 심사. 통과하지 못하면 계수를 만들지 않는다. */
export function evaluateCausalEligibility({
  panel, dimensionId, memberId, scopeColumn, treatedValues = [], controlValues = [],
  cutoff, thresholds = CAUSAL_THRESHOLDS,
} = {}) {
  const checks = [];
  const reasons = new Set();
  const add = (id, ok, reason) => {
    checks.push({ id, ok, reason: ok ? null : reason });
    if (!ok && reason) reasons.add(reason);
  };

  const rows = buildUnitPanel({ panel, dimensionId, memberId, scopeColumn, treatedValues, controlValues });
  const periods = [...new Set(rows.map((row) => row.period))].sort();
  const treatedUnits = new Set(rows.filter((row) => row.treated === 1).map((row) => row.unitKey));
  const controlUnits = new Set(rows.filter((row) => row.treated === 0).map((row) => row.unitKey));

  add("cutoff_declared", Boolean(cutoff), CAUSAL_REASON.NO_CUTOFF);
  add("cutoff_in_range", Boolean(cutoff) && periods.includes(cutoff), CAUSAL_REASON.CUTOFF_OUT_OF_RANGE);

  const cutoffIndex = cutoff ? periods.indexOf(cutoff) : -1;
  const prePeriods = cutoffIndex > 0 ? cutoffIndex : 0;
  const postPeriods = cutoffIndex >= 0 ? periods.length - cutoffIndex : 0;
  add("enough_pre", prePeriods >= thresholds.minPrePeriods, CAUSAL_REASON.NOT_ENOUGH_PRE);
  add("enough_post", postPeriods >= thresholds.minPostPeriods, CAUSAL_REASON.NOT_ENOUGH_POST);

  // 대조군이 없으면 전후 차이는 계산돼도 그것을 개입 효과라고 부를 수 없다.
  add("has_treated", treatedUnits.size >= thresholds.minTreatedUnits, CAUSAL_REASON.NO_TREATED);
  add("has_control", controlUnits.size >= thresholds.minControlUnits, CAUSAL_REASON.NO_CONTROL);

  const clusters = treatedUnits.size + controlUnits.size;
  add("enough_clusters", clusters >= thresholds.minClusters, CAUSAL_REASON.TOO_FEW_CLUSTERS);
  if (clusters >= thresholds.minClusters && clusters < thresholds.cautionClusters) {
    reasons.add(CAUSAL_REASON.FEW_CLUSTERS);
  }

  const shares = rows.map((row) => row.share);
  const mean = shares.length ? shares.reduce((sum, value) => sum + value, 0) / shares.length : 0;
  const variance = shares.length ? shares.reduce((sum, value) => sum + (value - mean) ** 2, 0) / shares.length : 0;
  add("outcome_varies", variance > 0, CAUSAL_REASON.NO_OUTCOME_VARIANCE);

  // 불균형 패널은 막지 않되(현실에서 흔하다) 사실로 남긴다.
  const expected = (treatedUnits.size + controlUnits.size) * periods.length;
  if (expected > 0 && rows.length < expected) reasons.add(CAUSAL_REASON.UNBALANCED_PANEL);

  const blocked = checks.some((check) => !check.ok);
  const cautionOnly = !blocked && reasons.size > 0;
  return {
    status: blocked ? CAUSAL_STATUS.BLOCKED : cautionOnly ? CAUSAL_STATUS.CAUTION : CAUSAL_STATUS.READY,
    checks,
    reasons: [...reasons].sort(),
    rows,
    periods,
    clusters,
    prePeriods,
    postPeriods,
  };
}

/* 단위 군집 견고 공분산.
 *   V = (X'X)⁻¹ (Σ_g X_g'u_g u_g'X_g) (X'X)⁻¹ · c,   c = G/(G−1) · (n−1)/(n−k)
 * 같은 단위의 잔차가 시간에 걸쳐 상관되는 것이 기본값이라, 고전 SE는 거의 항상
 * 과소추정된다 — 없는 유의가 생기는 가장 흔한 경로다. */
export function clusterRobustSe({ X, resid, XtXi, clusterIds }) {
  const n = X.length;
  const k = X[0].length;
  const groups = new Map();
  clusterIds.forEach((id, index) => {
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(index);
  });
  const G = groups.size;
  if (G < 2 || n <= k) return null;

  const meat = Array.from({ length: k }, () => Array(k).fill(0));
  groups.forEach((indexes) => {
    const scores = Array(k).fill(0);
    indexes.forEach((i) => {
      for (let j = 0; j < k; j += 1) scores[j] += X[i][j] * resid[i];
    });
    for (let row = 0; row < k; row += 1) {
      for (let col = 0; col < k; col += 1) meat[row][col] += scores[row] * scores[col];
    }
  });

  const correction = (G / (G - 1)) * ((n - 1) / (n - k));
  const se = [];
  for (let j = 0; j < k; j += 1) {
    let variance = 0;
    for (let a = 0; a < k; a += 1) {
      for (let b = 0; b < k; b += 1) variance += XtXi[j][a] * meat[a][b] * XtXi[b][j];
    }
    se.push(Math.sqrt(Math.max(0, variance * correction)));
  }
  return { se, clusters: G };
}

// 정규 근사(양측). 군집 수가 적을 때는 구간을 넓게 읽으라고 화면이 함께 말한다.
const twoSidedP = (t) => {
  const z = Math.abs(t);
  const p = Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
  const b = 1 / (1 + 0.2316419 * z);
  const poly = b * (0.319381530 + b * (-0.356563782 + b * (1.781477937 + b * (-1.821255978 + b * 1.330274429))));
  return Math.min(1, Math.max(0, 2 * p * poly));
};

/**
 * 이벤트 스터디. Y_it = α_i + τ_t + Σ_{k≠−1} β_k·(처리_i × 1[상대기간=k]) + ε_it
 * 단위 고정효과가 단위별 수준 차이를, 기간 고정효과가 모두에게 공통인 시점 충격을
 * 흡수한다. 남는 β_k가 "처리군이 대조군과 다르게 움직인 몫"이다.
 */
export function eventStudy({
  panel, dimensionId, memberId, scopeColumn, treatedValues, controlValues, cutoff,
  thresholds = CAUSAL_THRESHOLDS, eligibility = null,
} = {}) {
  const gate = eligibility || evaluateCausalEligibility({
    panel, dimensionId, memberId, scopeColumn, treatedValues, controlValues, cutoff, thresholds,
  });
  if (gate.status === CAUSAL_STATUS.BLOCKED) {
    return { available: false, reasons: gate.reasons, status: gate.status, coefficients: [] };
  }
  return estimateEventStudy({ rows: gate.rows, periods: gate.periods, cutoff, reasons: gate.reasons, status: gate.status });
}

function estimateEventStudy({ rows, periods, cutoff, reasons = [], status = CAUSAL_STATUS.READY }) {
  const cutoffIndex = periods.indexOf(cutoff);
  const units = [...new Set(rows.map((row) => row.unitKey))].sort();
  const relOf = (period) => periods.indexOf(period) - cutoffIndex;
  const relativeLevels = [...new Set(rows.map((row) => relOf(row.period)))].sort((a, b) => a - b).filter((rel) => rel !== -1);

  // 설계행렬: 절편 + 단위 더미(첫 단위 제외) + 기간 더미(첫 기간 제외) + 처리×상대기간
  const X = [];
  const y = [];
  const clusterIds = [];
  rows.forEach((row) => {
    const design = [1];
    units.slice(1).forEach((unit) => design.push(row.unitKey === unit ? 1 : 0));
    periods.slice(1).forEach((period) => design.push(row.period === period ? 1 : 0));
    relativeLevels.forEach((rel) => design.push(row.treated === 1 && relOf(row.period) === rel ? 1 : 0));
    X.push(design);
    y.push(row.share);
    clusterIds.push(row.unitKey);
  });

  if (!X.length || X[0].length >= X.length) {
    return { available: false, reasons: [...new Set([...reasons, CAUSAL_REASON.NOT_ESTIMABLE])].sort(), status: CAUSAL_STATUS.BLOCKED, coefficients: [] };
  }

  const fit = REG_STATS.ols(X, y);
  if (!fit || !fit.estimable) {
    return { available: false, reasons: [...new Set([...reasons, CAUSAL_REASON.NOT_ESTIMABLE])].sort(), status: CAUSAL_STATUS.BLOCKED, coefficients: [] };
  }

  const robust = clusterRobustSe({ X, resid: fit.resid, XtXi: fit.XtXi, clusterIds });
  if (!robust) {
    return { available: false, reasons: [...new Set([...reasons, CAUSAL_REASON.TOO_FEW_CLUSTERS])].sort(), status: CAUSAL_STATUS.BLOCKED, coefficients: [] };
  }

  const offset = 1 + (units.length - 1) + (periods.length - 1);
  const coefficients = relativeLevels.map((rel, index) => {
    const position = offset + index;
    const estimate = fit.beta[position];
    const se = robust.se[position];
    const t = se > 0 ? estimate / se : 0;
    return {
      relative: rel,
      isPre: rel < 0,
      estimate,
      se,
      tValue: t,
      pValue: se > 0 ? twoSidedP(t) : null,
      ciLow: estimate - 1.96 * se,
      ciHigh: estimate + 1.96 * se,
    };
  });

  // 사전 추세: 개입 전 계수가 이미 유의하면 평행 추세 가정이 깨진 것이다.
  const preCoefficients = coefficients.filter((coefficient) => coefficient.isPre);
  const preTrendViolated = preCoefficients.some((coefficient) => coefficient.pValue != null && coefficient.pValue < 0.05);
  const allReasons = new Set(reasons);
  if (preTrendViolated) allReasons.add(CAUSAL_REASON.PRE_TREND_VIOLATED);

  const postCoefficients = coefficients.filter((coefficient) => !coefficient.isPre);
  const averagePost = postCoefficients.length
    ? postCoefficients.reduce((sum, coefficient) => sum + coefficient.estimate, 0) / postCoefficients.length
    : null;

  return {
    available: true,
    status: preTrendViolated ? CAUSAL_STATUS.BLOCKED : status,
    reasons: [...allReasons].sort(),
    coefficients,
    preTrend: { violated: preTrendViolated, coefficients: preCoefficients },
    averagePostEffect: averagePost,
    clusters: robust.clusters,
    observations: X.length,
    parameters: X[0].length,
  };
}

/**
 * 위약 검정. 개입 **이전** 구간만 잘라 가짜 개입 시점을 넣고 같은 모형을 돌린다.
 * 여기서 효과가 나오면 그 설계는 개입이 아니라 다른 것을 잡고 있다는 뜻이다.
 */
export function placeboTest({ eligibility, thresholds = CAUSAL_THRESHOLDS } = {}) {
  if (!eligibility || eligibility.status === CAUSAL_STATUS.BLOCKED) {
    return { available: false, reasons: eligibility?.reasons || [CAUSAL_REASON.NOT_ESTIMABLE] };
  }
  const { rows, periods, prePeriods } = eligibility;
  // 가짜 시점 앞뒤로 최소 기간이 남아야 검정이 성립한다.
  if (prePeriods < thresholds.minPrePeriods + thresholds.minPostPeriods) {
    return { available: false, reasons: [CAUSAL_REASON.NOT_ENOUGH_PRE] };
  }
  const prePeriodList = periods.slice(0, prePeriods);
  const fakeIndex = Math.floor(prePeriodList.length / 2);
  const fakeCutoff = prePeriodList[fakeIndex];
  const preRows = rows.filter((row) => prePeriodList.includes(row.period));
  const result = estimateEventStudy({ rows: preRows, periods: prePeriodList, cutoff: fakeCutoff, status: CAUSAL_STATUS.READY });
  if (!result.available) return { available: false, reasons: result.reasons, fakeCutoff };

  const significant = result.coefficients.filter((coefficient) => !coefficient.isPre && coefficient.pValue != null && coefficient.pValue < 0.05);
  return {
    available: true,
    fakeCutoff,
    passed: significant.length === 0,
    reasons: significant.length ? [CAUSAL_REASON.PLACEBO_FAILED] : [],
    coefficients: result.coefficients,
  };
}

/* 매개 경로(무엇을 거쳐 영향을 줬나)는 이 도구에서 열지 않는다.
 * 매개 분석은 처리→매개, 매개→결과 두 경로 모두에 교란이 없어야 식별되는데,
 * 임의의 세그먼트 CSV로는 그 가정을 확인할 방법이 없다. 숫자를 내면 그 순간
 * 검증 불가능한 인과 주장이 된다 — 못 한다고 말하는 것이 정확한 답이다. */
export function mediationAvailability() {
  return { available: false, reasons: [CAUSAL_REASON.MEDIATION_NOT_IDENTIFIED] };
}

export const SEGMENT_CAUSAL_MATH = {
  buildUnitPanel,
  evaluateCausalEligibility,
  eventStudy,
  placeboTest,
  clusterRobustSe,
  mediationAvailability,
};
