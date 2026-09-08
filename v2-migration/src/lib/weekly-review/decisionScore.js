/**
 * 지난 결정의 결과 판정.
 *
 * 일반 주간 보고는 "지난주 숫자 vs 이번주 숫자"에서 끝난다. 여기서는 **"지난 결정 vs 실제
 * 결과"**를 본다. 그게 이 제품의 진짜 차별점이고, 그러려면 결정이 저장될 때 목표와 가드레일이
 * 함께 기록돼 있어야 한다.
 *
 * 정직성 계약 셋:
 *
 * ① **`NO_EFFECT`를 "효과 없음"이라고 부르지 않는다.** 1주 표본으로 효과를 부정할 검정력이
 *    없다. 화면 문구는 "뚜렷한 변화를 확인하지 못했습니다"이고, 이 모듈은 그 뜻을 코드에
 *    남긴다(`meansNoEffect: false`).
 * ② **옛 레코드를 추측으로 채우지 않는다.** 목표·가드레일이 없는 결정(v8)은 `UNSCORED`다.
 *    "예산을 늘렸으니 전환이 목표였겠지"라고 짐작하면 그 순간 판정이 지어낸 값이 된다.
 * ③ **성공 판정에 유의미성을 요구한다.** 전환 +0.5%를 "목표 달성"이라고 부르면 결정 기록
 *    전체가 쓸모없어진다. 가드레일은 반대로 선언된 한계선이라 유의미성을 묻지 않는다 —
 *    "CPA ≤ $8"는 넘었으면 넘은 것이다.
 */

import { HIGHER_IS_BETTER, LOWER_IS_BETTER, assessChange } from "./significance";
import { deriveMetrics, sumRows } from "./snapshot";

export const DECISION_OUTCOME = Object.freeze({
  WORKED: "WORKED",
  MIXED: "MIXED",
  NO_EFFECT: "NO_EFFECT",
  BACKFIRED: "BACKFIRED",
  UNSCORED: "UNSCORED",
  NO_DATA: "NO_DATA",
  NOT_APPLIED: "NOT_APPLIED",
});

/** 실행 여부 판정 — 예정 변화의 이만큼도 안 움직였으면 실행되지 않은 것으로 본다. */
export const APPLIED_MIN_RATIO = 1 / 3;

const BUDGET_ACTIONS = new Set(["increase_budget", "decrease_budget"]);

function toFiniteNumber(value) {
  if (value === null || value === undefined || typeof value === "boolean") return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const num = Number(typeof value === "string" ? value.replace(/,/g, "") : value);
  return Number.isFinite(num) ? num : null;
}

/** "+15%" · "-10 %" · 15 → 0.15 / -0.10. 퍼센트가 아니면 null. */
export function parsePercentAmount(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value / 100 : null;
  const text = String(value ?? "").trim();
  if (!/%\s*$/.test(text)) return null;
  const num = toFiniteNumber(text.replace(/%\s*$/, ""));
  return num === null ? null : num / 100;
}

/**
 * 결정이 가리키는 캠페인·채널 행만 남긴다.
 *
 * `"채널 / 캠페인"` 합성 라벨도 받는다. 화면의 추천과 원인 표가 그 형태로 이름을 보여주므로,
 * 사용자가 그대로 복사해 결정을 저장한다. 캠페인명만 매칭하면 그 결정이 영영 `NO_DATA`가 되고,
 * 판정이 조용히 죽는다(테스트가 실제로 이 구멍을 잡았다).
 */
export function rowsForTarget(snapshot, target) {
  if (!snapshot || !snapshot.ok) return [];
  const needle = String(target ?? "").trim();
  if (!needle) return [];
  return snapshot.rows.filter((row) => {
    if (row.campaign === needle || row.channel === needle) return true;
    const composite = row.channel ? `${row.channel} / ${row.campaign}` : row.campaign;
    return composite === needle;
  });
}

function metricValue(metrics, name) {
  if (!metrics) return null;
  if (name === "spend" || name === "cost") return metrics.totals?.cost ?? null;
  if (name === "conversions" || name === "actions") return metrics.conversions ?? null;
  return metrics[name] ?? null;
}

function metricsFor(rows, basis) {
  const totals = sumRows(rows);
  return { totals, ...deriveMetrics(totals, { basis }) };
}

/** 목표 방향 → 유의미성 판정에 쓸 지표 방향. */
function directionFor(goalDirection, metric) {
  if (goalDirection === "up") return HIGHER_IS_BETTER;
  if (goalDirection === "down") return LOWER_IS_BETTER;
  // "hold"는 지표 자체의 성격을 따른다 — 비용류는 낮을수록, 결과류는 높을수록 좋다.
  return metric === "cpa" || metric === "cpi" || metric === "cost" || metric === "spend"
    ? LOWER_IS_BETTER
    : HIGHER_IS_BETTER;
}

function compare(value, op, threshold) {
  if (value === null || threshold === null) return null;
  if (op === "lte") return value <= threshold;
  if (op === "gte") return value >= threshold;
  return null;
}

/**
 * 결정 하나를 채점한다.
 *
 * @param {object} decision  v9 레코드 — `{ actionKind, actionTarget, actionAmount,
 *                           goalMetric, goalDirection, guardrailMetric, guardrailOp, guardrailValue }`
 * @param {object} current   이번 기간 스냅샷
 * @param {object} previous  지난 기간 스냅샷
 * @param {number[]} history 대상의 목표 지표 최근 주간값(있으면 평소 범위까지 본다)
 */
export function scoreDecision({
  decision = null,
  current = null,
  previous = null,
  history = [],
  basis = "actions",
  volumeMultiplier = 1,
} = {}) {
  const empty = { outcome: DECISION_OUTCOME.UNSCORED, reason: null, meansNoEffect: false, checks: null, target: null };

  if (!decision) return { ...empty, reason: "no_decision" };

  const hasGoal = Boolean(decision.goalMetric) && Boolean(decision.goalDirection);
  const hasGuardrail =
    Boolean(decision.guardrailMetric) &&
    Boolean(decision.guardrailOp) &&
    toFiniteNumber(decision.guardrailValue) !== null;

  if (!hasGoal || !hasGuardrail) {
    // v8 레코드에는 이 필드들이 아예 없다. 짐작해서 채우지 않는다.
    return {
      ...empty,
      reason: "no_terms_recorded",
      missing: [!hasGoal ? "goal" : null, !hasGuardrail ? "guardrail" : null].filter(Boolean),
    };
  }

  const currentRows = rowsForTarget(current, decision.actionTarget);
  const previousRows = rowsForTarget(previous, decision.actionTarget);
  if (currentRows.length === 0 || previousRows.length === 0) {
    return {
      ...empty,
      outcome: DECISION_OUTCOME.NO_DATA,
      reason: currentRows.length === 0 ? "target_missing_in_current" : "target_missing_in_previous",
      target: decision.actionTarget ?? null,
    };
  }

  const currentMetrics = metricsFor(currentRows, basis);
  const previousMetrics = metricsFor(previousRows, basis);

  // ── 실행 여부 ──────────────────────────────────────────────
  const plannedRatio = BUDGET_ACTIONS.has(decision.actionKind)
    ? parsePercentAmount(decision.actionAmount)
    : null;
  let applied = { skipped: true, reason: "not_verifiable" };
  if (plannedRatio !== null && plannedRatio !== 0) {
    const curSpend = metricValue(currentMetrics, "spend");
    const prevSpend = metricValue(previousMetrics, "spend");
    if (curSpend === null || prevSpend === null || prevSpend === 0) {
      applied = { skipped: true, reason: "no_spend" };
    } else {
      const actualRatio = (curSpend - prevSpend) / Math.abs(prevSpend);
      // 방향이 맞고 예정치의 1/3 이상 움직였으면 실행된 것으로 본다.
      const sameDirection = Math.sign(actualRatio) === Math.sign(plannedRatio);
      const enough = Math.abs(actualRatio) >= Math.abs(plannedRatio) * APPLIED_MIN_RATIO;
      applied = { skipped: false, pass: sameDirection && enough, planned: plannedRatio, actual: actualRatio };
    }
  }

  if (applied.skipped === false && !applied.pass) {
    return {
      outcome: DECISION_OUTCOME.NOT_APPLIED,
      reason: "spend_did_not_move",
      meansNoEffect: false,
      checks: { applied, goal: null, guardrail: null },
      target: decision.actionTarget ?? null,
    };
  }

  // ── 목표 ───────────────────────────────────────────────────
  const goalAssessment = assessChange({
    current: metricValue(currentMetrics, decision.goalMetric),
    previous: metricValue(previousMetrics, decision.goalMetric),
    history,
    volume: currentMetrics.conversions,
    direction: directionFor(decision.goalDirection, decision.goalMetric),
    volumeMultiplier,
  });

  // 관측 불가나 작은 표본은 유지의 증거가 아니다. 유지 목표는 별도 동등성
  // 범위가 기록되지 않으므로 자동 합격시키지 않는다.
  if (decision.goalDirection === "hold" || goalAssessment.deltaPct === null
    || !goalAssessment.checks?.volume?.pass) {
    return { ...empty, reason: decision.goalDirection === "hold" ? "hold_margin_not_recorded" : "goal_not_measurable", target: decision.actionTarget };
  }
  const goalMet = goalAssessment.significant && goalAssessment.outcome === "better";

  const goal = {
    metric: decision.goalMetric,
    direction: decision.goalDirection,
    pass: goalMet,
    assessment: goalAssessment,
  };

  // ── 가드레일 ───────────────────────────────────────────────
  // 선언된 한계선이므로 유의미성을 묻지 않는다. 넘었으면 넘은 것이다.
  const guardrailActual = metricValue(currentMetrics, decision.guardrailMetric);
  const guardrailPass = compare(guardrailActual, decision.guardrailOp, toFiniteNumber(decision.guardrailValue));
  const guardrail = {
    metric: decision.guardrailMetric,
    op: decision.guardrailOp,
    threshold: toFiniteNumber(decision.guardrailValue),
    actual: guardrailActual,
    pass: guardrailPass,
  };

  if (guardrailPass === null) {
    return {
      outcome: DECISION_OUTCOME.UNSCORED,
      reason: "guardrail_not_measurable",
      meansNoEffect: false,
      checks: { applied, goal, guardrail },
      target: decision.actionTarget ?? null,
    };
  }

  const outcome = goalMet
    ? (guardrailPass ? DECISION_OUTCOME.WORKED : DECISION_OUTCOME.MIXED)
    : (guardrailPass ? DECISION_OUTCOME.NO_EFFECT : DECISION_OUTCOME.BACKFIRED);

  return {
    outcome,
    reason: null,
    // 1주 표본으로 효과를 부정할 검정력이 없다. NO_EFFECT는 "변화를 확인하지 못했다"이지
    // "효과가 없다"가 아니다 — 화면 문구가 이 플래그를 따라야 한다.
    meansNoEffect: false,
    checks: { applied, goal, guardrail },
    target: decision.actionTarget ?? null,
  };
}
