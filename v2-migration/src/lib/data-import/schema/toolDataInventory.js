import { ANALYSIS_CONTRACTS } from "@/lib/analysis-router/evaluateEligibility";
import { ROUTES } from "@/lib/routeMap";
import { TOOL_GROUP } from "@/lib/toolGroups";
import { STANDARD_FIELDS, TOOL_OPTIONAL_FIELDS, TOOL_REQUIRED_FIELDS } from "@/utils/csvConstants";

const timeKeys = new Set(["date", "week", "cohort_date", "snapshot_date", "subscription_start_date", "churn_date", "observation_end_date"]);

// 고정 V1 키로 투영할 수 없는 도구는 자유 역할을 명시적으로 가진다. 이 목록은
// 일반 CSV 계약으로 위장하지 않으며, automatic은 semantic mapper의 최대 판정이다.
// `manual`과 `user_declared`는 헤더·값만으로 의미를 확정할 수 없어 UNKNOWN으로
// 남기거나 화면에서 사용자가 선언해야 한다.
export const TOOL_OWNED_MAPPING_ROLES = Object.freeze({
  "5-20": Object.freeze([
    // 현재 실행 경로는 목표와 행동 열만 차단한다. ID가 없으면 중복 사용자 여부를
    // 검증할 수 없으므로, 필수라고 거짓 선언하지 않고 확인 경고 역할로 남긴다.
    { canonicalKey: "user_id", required: false, source: "column", automatic: "SUGGEST", validation: "confirm_one_row_per_user_without_id" },
    { canonicalKey: "outcome_binary", required: true, source: "column", automatic: "SUGGEST" },
    { canonicalKey: "numeric_feature", required: true, source: "column", automatic: "manual" },
  ]),
  "5-23": Object.freeze([
    { canonicalKey: "date", required: true, source: "column", automatic: "SUGGEST" },
    { canonicalKey: "holdout_group", required: false, source: "column", automatic: "SUGGEST", method: "suppression_holdout" },
    { canonicalKey: "experiment_numerator", required: false, source: "column", automatic: "SUGGEST", method: "suppression_holdout" },
    { canonicalKey: "experiment_denominator", required: false, source: "column", automatic: "SUGGEST", method: "suppression_holdout" },
    { canonicalKey: "outcome_numeric", required: false, source: "column", automatic: "manual", method: "new_launch_or_shutdown" },
    { canonicalKey: "intervention_group", required: false, source: "column", automatic: "manual", method: "new_launch_or_shutdown" },
    { canonicalKey: "intervention_cutoff", required: false, source: "user_declared", automatic: "manual", method: "new_launch_or_shutdown" },
  ]),
  "9-1": Object.freeze([
    { canonicalKey: "outcome_numeric", required: true, source: "column", automatic: "manual" },
    { canonicalKey: "numeric_feature", required: true, source: "column", automatic: "manual" },
    { canonicalKey: "content_id", required: false, source: "column", automatic: "SUGGEST" },
  ]),
});

function describeLegacyKey(key) {
  const field = STANDARD_FIELDS[key];
  return {
    legacyKey: key,
    valueType: field?.type || "undeclared",
    unitFamily: field?.type === "percent" ? "rate" : field?.type === "number" ? "undeclared_number" : "category",
  };
}

function describeRequirement(item) {
  const keys = typeof item === "string" ? [item] : item?.oneOf || [];
  return {
    kind: typeof item === "string" ? "all" : "one_of",
    min: 1,
    max: 1,
    fields: keys.map(describeLegacyKey),
  };
}

function inventoryForRoute(route) {
  const toolId = route.id;
  const required = TOOL_REQUIRED_FIELDS[toolId] || [];
  const optional = TOOL_OPTIONAL_FIELDS[toolId] || [];
  const analysis = ANALYSIS_CONTRACTS[toolId] || null;
  const requiredKeys = required.flatMap((item) => typeof item === "string" ? [item] : item?.oneOf || []);

  return {
    toolId,
    slug: route.slug,
    publication: route.publication || "published",
    isPublicAnalysisTool: !route.publication && toolId !== "start-gate",
    dataGroup: TOOL_GROUP[toolId],
    // contract는 공용 CsvUploader 경로, tool_owned는 도구별 역할 선택 경로다.
    mappingMode: required.length ? "contract" : "tool_owned",
    toolOwnedRoles: TOOL_OWNED_MAPPING_ROLES[toolId] || [],
    requirements: required.map(describeRequirement),
    optionalFields: optional.map(({ key }) => describeLegacyKey(key)),
    grain: {
      timeKeys: requiredKeys.filter((key) => timeKeys.has(key)),
      entityKeys: analysis?.entityFields || [],
    },
    // ANALYSIS_CONTRACTS가 실제 readiness 소비 키를 소유한다. 없으면 도구가 자체
    // 입력·역할 매핑을 소유한다는 뜻이며, 빈 배열을 일반 CSV 계약으로 오인하지 않는다.
    analysisConsumers: analysis
      ? { spendKeys: analysis.spendKeys || [], resultKeys: analysis.resultKeys || [] }
      : null,
  };
}

// 공개·preview·검색용 subtool 모두 routeMap과 TOOL_GROUP의 교집합에서 파생한다.
// legacy redirect와 TOOL_GROUP의 방어 alias(5-6)는 사용자 입력 도구 목록에 넣지 않는다.
export function buildCsvToolInventory() {
  return ROUTES
    .filter((route) => !route.legacy && Boolean(TOOL_GROUP[route.id]))
    .map(inventoryForRoute);
}
