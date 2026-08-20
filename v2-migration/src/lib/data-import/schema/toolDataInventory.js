import { ANALYSIS_CONTRACTS } from "@/lib/analysis-router/evaluateEligibility";
import { ROUTES } from "@/lib/routeMap";
import { TOOL_GROUP } from "@/lib/toolGroups";
import { STANDARD_FIELDS, TOOL_OPTIONAL_FIELDS, TOOL_REQUIRED_FIELDS } from "@/utils/csvConstants";

const timeKeys = new Set(["date", "week", "cohort_date", "snapshot_date"]);

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
    dataGroup: TOOL_GROUP[toolId],
    // contract는 공용 CsvUploader 경로, tool_owned는 도구별 역할 선택 경로다.
    mappingMode: required.length ? "contract" : "tool_owned",
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
