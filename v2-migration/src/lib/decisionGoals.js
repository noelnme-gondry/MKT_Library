/**
 * decisionGoals — 도구별 "이 결과로 걸 수 있는 목표·가드레일" 레지스트리(SSOT).
 *
 * 왜 레지스트리인가:
 *
 * 결정 기록 폼의 목표는 오래 자유 텍스트 입력이었다(`ds/DecisionReview`의 `metric`).
 * 방향(높을수록 좋은가/낮을수록 좋은가)은 `decisionMetricDirection`의 고정 정규식이
 * 추측했는데, 그 어휘는 CPA·ROAS 계열뿐이라 도구들이 실제로 제안하던 목표 12개 중
 * 8개가 방향 미상으로 떨어졌다("강한 잠식 후보"·"최대 VIF"·"추정 증가분"…).
 * 도구는 자기 목표의 좋은 방향을 알고 있는데(VIF는 낮을수록 좋다) 자유 텍스트로
 * 넘기면서 그 지식이 버려지고 있었다.
 *
 * 그래서 방향은 추측하지 않고 **도구가 선언한다**. 여기 적힌 것만 목표가 된다.
 *
 * 자동 판정 경계:
 *
 * `weekly-review/decisionScore`는 효율 스냅샷에서 파생되는 지표만 계산할 수 있다
 * (`snapshot.deriveMetrics` — cpa·cpi·ctr·cvr·cpm·roas·conversions·spend).
 * 그 밖의 목표(잠식 후보 수·VIF·생존율…)는 스냅샷에 없으므로 자동 판정이 불가능하고,
 * 그 사실을 숨기지 않기 위해 `rerun:` 접두사로 **대놓고 구분**한다 — 검토 화면은
 * 이 목표를 "원본 도구에서 새 데이터로 다시 분석" 흐름으로 보낸다.
 * 접두사를 떼고 평범한 키처럼 적으면 스코어러가 조용히 `NO_DATA`를 내고, 사용자는
 * 판정이 왜 안 붙는지 알 수 없게 된다.
 */

/**
 * `scoreDecision`이 효율 스냅샷에서 실제로 계산할 수 있는 지표.
 * `weekly-review/snapshot.js`의 `deriveMetrics` 반환 키 + `metricValue`의 별칭에서 온다.
 * 여기 없는 키를 목표로 쓰면 판정이 `NO_DATA`로 죽으므로 아래 가드가 막는다.
 */
export const SCORABLE_GOAL_METRICS = Object.freeze([
  "cpa", "cpi", "ctr", "cvr", "cpm", "roas", "conversions", "spend",
]);

/** 자동 판정 불가 목표의 접두사. 이 목표는 원본 도구 재실행으로 검토한다. */
export const RERUN_GOAL_PREFIX = "rerun:";

export function isScorableGoalMetric(key) {
  return SCORABLE_GOAL_METRICS.includes(String(key ?? ""));
}

export function isRerunGoalMetric(key) {
  return String(key ?? "").startsWith(RERUN_GOAL_PREFIX);
}

/** 목표 방향(up/down) → `assessDecisionOutcome`이 읽는 어휘(higher/lower). */
export function goalTargetDirection(direction) {
  if (direction === "up") return "higher";
  if (direction === "down") return "lower";
  return "";
}

const g = (key, label, labelEn, direction) => ({ key, label, labelEn, direction });
const rail = (key, label, labelEn, op) => ({ key, label, labelEn, op });

// 자주 쓰는 가드레일 — 같은 문장을 도구마다 다시 적으면 표현이 갈린다.
const RAIL_CPA = rail("cpa", "CPA 유지", "Hold CPA", "lte");
const RAIL_CPI = rail("cpi", "CPI 유지", "Hold CPI", "lte");
const RAIL_SPEND = rail("spend", "비용 상한", "Spend cap", "lte");
const RAIL_VOLUME = rail("conversions", "전환수 유지", "Hold conversions", "gte");

/**
 * 도구 id → 목표·가드레일 후보.
 *
 * 순서가 곧 화면의 기본값이다(첫 항목이 선택된 채로 뜬다). 그래서 그 도구의 결정이
 * 가장 자주 노리는 것을 맨 앞에 둔다.
 *
 * 공개 도구는 전부 목표 1개+·가드레일 1개+를 가져야 한다 — `decisionGoals.test.js`가
 * `publishedToolIds()`에서 파생해 강제한다(손으로 쓴 목록을 돌면 가드가 아니다).
 */
export const TOOL_DECISION_GOALS = Object.freeze({
  "5-2": {
    goals: [
      g("cpa", "CPA", "CPA", "down"),
      // 전역 분모 기준 토글(§12.18)이 설치면 도구가 CPI로 말한다. 후보에 없으면
      // 프리필이 목표와 안 맞아 원장과 판정이 다른 지표를 가리킨다.
      g("cpi", "CPI", "CPI", "down"),
      g("roas", "ROAS", "ROAS", "up"),
      g("conversions", "전환수", "Conversions", "up"),
    ],
    guardrails: [RAIL_SPEND, RAIL_CPA, RAIL_VOLUME],
  },
  "5-3": {
    goals: [
      g("cpa", "CPA", "CPA", "down"),
      g("cpi", "CPI", "CPI", "down"),
      g("roas", "ROAS", "ROAS", "up"),
      g("conversions", "전환수", "Conversions", "up"),
    ],
    guardrails: [RAIL_SPEND, RAIL_CPA, RAIL_VOLUME],
  },
  "5-21": {
    goals: [
      g("conversions", "전환수", "Conversions", "up"),
      g("cpa", "CPA", "CPA", "down"),
      g("cpi", "CPI", "CPI", "down"),
    ],
    guardrails: [RAIL_SPEND, RAIL_CPA],
  },
  "5-22": {
    goals: [
      g("conversions", "전환수", "Conversions", "up"),
      g("roas", "ROAS", "ROAS", "up"),
      g("cpa", "CPA", "CPA", "down"),
      g("cpi", "CPI", "CPI", "down"),
    ],
    // 증액 여력 판단의 실패 모드는 "늘렸더니 효율이 무너짐"이라 CPA가 먼저다.
    guardrails: [RAIL_CPA, RAIL_SPEND],
  },
  "5-4": {
    goals: [
      g("cvr", "전환율 (CVR)", "Conversion rate (CVR)", "up"),
      g("ctr", "클릭률 (CTR)", "Click-through rate (CTR)", "up"),
      g("cpa", "CPA", "CPA", "down"),
    ],
    guardrails: [RAIL_CPA, RAIL_VOLUME],
  },
  "5-18-paid-organic": {
    goals: [
      g(`${RERUN_GOAL_PREFIX}organic_share`, "오가닉 비중", "Organic share", "up"),
      g("conversions", "전환수", "Conversions", "up"),
    ],
    // 오가닉 비중만 오르고 총량이 주는 건 성공이 아니다.
    guardrails: [RAIL_VOLUME, RAIL_CPA],
  },
  "5-18-trend": {
    goals: [
      g("conversions", "전환수", "Conversions", "up"),
      g(`${RERUN_GOAL_PREFIX}trend_slope`, "추세 기울기", "Trend slope", "up"),
    ],
    guardrails: [RAIL_CPA, RAIL_SPEND],
  },
  "5-18-cannibal": {
    goals: [
      g(`${RERUN_GOAL_PREFIX}organic_conversions`, "오가닉 전환수", "Organic conversions", "up"),
      g(`${RERUN_GOAL_PREFIX}cannib_candidates`, "강한 잠식 후보 수", "Strong cannibalization candidates", "down"),
    ],
    // 광고를 끄면 오가닉 귀속이 늘어나는 건 잠식이 줄어서가 아니라 어트리뷰션이
    // 옮겨간 것일 수 있다. 총 전환수 가드레일이 그 자기기만을 막는 자리다.
    guardrails: [RAIL_VOLUME, RAIL_CPA, RAIL_SPEND],
  },
  "5-18-mmm": {
    goals: [
      g("roas", "ROAS", "ROAS", "up"),
      g("cpa", "CPA", "CPA", "down"),
      g(`${RERUN_GOAL_PREFIX}oos_error`, "시간순 검증 오차", "Time-ordered validation error", "down"),
    ],
    guardrails: [RAIL_SPEND, RAIL_CPA],
  },
  "5-18-forecast": {
    goals: [
      g(`${RERUN_GOAL_PREFIX}forecast_error`, "예측 오차 (wMAPE)", "Forecast error (wMAPE)", "down"),
      g("conversions", "전환수", "Conversions", "up"),
    ],
    guardrails: [RAIL_CPA, RAIL_SPEND],
  },
  "5-20": {
    goals: [
      g(`${RERUN_GOAL_PREFIX}aha_reach`, "핵심 행동 도달 비중", "Aha-action reach", "up"),
      g("cvr", "전환율 (CVR)", "Conversion rate (CVR)", "up"),
    ],
    guardrails: [RAIL_CPA, RAIL_VOLUME],
  },
  "5-23": {
    goals: [
      g(`${RERUN_GOAL_PREFIX}incremental_lift`, "순증분 (incremental lift)", "Incremental lift", "up"),
      g("cpa", "CPA", "CPA", "down"),
    ],
    guardrails: [RAIL_SPEND, RAIL_VOLUME],
  },
  "5-24": {
    goals: [
      g(`${RERUN_GOAL_PREFIX}brand_lift`, "브랜드 증가분", "Brand lift", "up"),
      g("conversions", "전환수", "Conversions", "up"),
    ],
    guardrails: [RAIL_SPEND, RAIL_CPA],
  },
  "5-25": {
    goals: [
      g(`${RERUN_GOAL_PREFIX}max_vif`, "최대 VIF", "Maximum VIF", "down"),
    ],
    // 공선을 줄이려고 집행을 흔들면 볼륨이 먼저 깨진다.
    guardrails: [RAIL_VOLUME, RAIL_SPEND],
  },
  "5-26": {
    goals: [
      g("cpa", "CPA", "CPA", "down"),
      g("conversions", "전환수", "Conversions", "up"),
      g(`${RERUN_GOAL_PREFIX}exact_promotions`, "Exact 승격 건수", "Exact promotions", "up"),
    ],
    guardrails: [RAIL_CPA, RAIL_SPEND],
  },
  "5-27": {
    goals: [
      g(`${RERUN_GOAL_PREFIX}store_cvr`, "조회→설치 전환율", "View-to-install conversion", "up"),
      g("cvr", "전환율 (CVR)", "Conversion rate (CVR)", "up"),
    ],
    guardrails: [RAIL_CPI, RAIL_VOLUME],
  },
  "5-28": {
    goals: [
      g(`${RERUN_GOAL_PREFIX}survival_rate`, "생존율", "Survival rate", "up"),
      g(`${RERUN_GOAL_PREFIX}hazard_peak`, "최대 이탈 위험", "Peak dropout hazard", "down"),
    ],
    guardrails: [RAIL_VOLUME, RAIL_CPA],
  },
  "5-29": {
    goals: [
      g(`${RERUN_GOAL_PREFIX}segment_share`, "대상 세그먼트 비중", "Target segment share", "up"),
      g("conversions", "전환수", "Conversions", "up"),
    ],
    guardrails: [RAIL_CPA, RAIL_VOLUME],
  },
  "9-1": {
    goals: [
      g("ctr", "클릭률 (CTR)", "Click-through rate (CTR)", "up"),
      g("cvr", "전환율 (CVR)", "Conversion rate (CVR)", "up"),
      g(`${RERUN_GOAL_PREFIX}element_effect`, "요소 기여 효과", "Element effect", "up"),
    ],
    guardrails: [RAIL_CPA, RAIL_VOLUME],
  },
  "9-6": {
    goals: [
      g("ctr", "클릭률 (CTR)", "Click-through rate (CTR)", "up"),
      g("cpa", "CPA", "CPA", "down"),
      g(`${RERUN_GOAL_PREFIX}fatigued_share`, "피로 소재 비중", "Fatigued creative share", "down"),
    ],
    guardrails: [RAIL_CPA, rail("cpm", "CPM 유지", "Hold CPM", "lte")],
  },
});

function localized(entry, locale) {
  return locale === "en" ? (entry.labelEn || entry.label) : entry.label;
}

/** 도구가 제안하는 목표 후보. 등록되지 않은 도구는 빈 배열 — 폼은 직접 입력으로 남는다. */
export function toolDecisionGoals(toolId, locale = "ko") {
  const entry = TOOL_DECISION_GOALS[String(toolId ?? "")];
  if (!entry) return [];
  return entry.goals.map((goal) => ({
    key: goal.key,
    label: localized(goal, locale),
    direction: goal.direction,
    targetDirection: goalTargetDirection(goal.direction),
    scorable: isScorableGoalMetric(goal.key),
  }));
}

/** 도구가 제안하는 가드레일 후보. */
export function toolDecisionGuardrails(toolId, locale = "ko") {
  const entry = TOOL_DECISION_GOALS[String(toolId ?? "")];
  if (!entry) return [];
  return entry.guardrails.map((guardrail) => ({
    key: guardrail.key,
    label: localized(guardrail, locale),
    op: guardrail.op,
    scorable: isScorableGoalMetric(guardrail.key),
  }));
}

/** 목표 키로 후보를 찾는다. 없으면 null — 호출부가 직접 입력으로 폴백한다. */
export function findToolGoal(toolId, key, locale = "ko") {
  return toolDecisionGoals(toolId, locale).find((goal) => goal.key === String(key ?? "")) || null;
}

export function findToolGuardrail(toolId, key, locale = "ko") {
  return toolDecisionGuardrails(toolId, locale).find((rail) => rail.key === String(key ?? "")) || null;
}

/**
 * 결정 레코드의 목표 방향.
 *
 * 레지스트리를 먼저 본다 — 도구가 선언한 방향이 정규식 추측보다 정확하다.
 * 등록되지 않은 목표(옛 레코드의 자유 텍스트)는 `null`을 돌려주고, 호출부가
 * 기존 `decisionMetricDirection` 폴백을 쓴다.
 */
export function registryTargetDirection(toolId, goalMetric) {
  const goal = findToolGoal(toolId, goalMetric);
  return goal ? goal.targetDirection : null;
}
