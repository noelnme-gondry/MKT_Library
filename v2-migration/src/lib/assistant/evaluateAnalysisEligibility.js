import { analysisCatalogEntry } from "./analysisCatalog";

const CONFIRMATION_STATES = new Set(["must_confirm", "SUGGEST", "UNKNOWN"]);

function mappedFields(mapping = {}) {
  if (Array.isArray(mapping)) {
    return new Set(mapping
      .map((item) => typeof item === "string" ? item : item?.canonicalKey || item?.field)
      .filter((value) => value && value !== "__ignore__"));
  }
  return new Set(Object.values(mapping).filter((value) => value && value !== "__ignore__"));
}

function missingRequiredGroups(groups = [], fields) {
  return groups.flatMap((group) => {
    if (typeof group === "string") return fields.has(group) ? [] : [[group]];
    const candidates = group?.oneOf || [];
    return candidates.some((field) => fields.has(field)) ? [] : [candidates];
  });
}

function requiredOwnedRoles(roles = []) {
  return roles.filter((role) => role.required).map((role) => role.canonicalKey);
}

function mappingNeedsConfirmation(mappingContract, requiredFields) {
  const required = new Set(requiredFields);
  return (mappingContract?.assessments || []).some((assessment) => (
    required.has(assessment.field || assessment.canonicalKey)
      && CONFIRMATION_STATES.has(assessment.state || assessment.decision)
  )) || Boolean(mappingContract?.conflicts?.length);
}

function profileProblems(entry, profile = {}) {
  const problems = [];
  const rowCount = Number(profile.rowCount ?? profile.rows ?? 0);
  const periodCount = Number(profile.periodCount ?? profile.periods ?? 0);
  const grain = profile.grain || null;
  if (profile.rowCount != null && rowCount < 1) problems.push({ code: "no_rows" });
  if (grain && !entry.supportedGrains.includes(grain)) {
    problems.push({ code: "grain_mismatch", expected: entry.supportedGrains, current: grain });
  }

  // 무거운 주간 모델은 데이터가 있어도 짧은 기간을 의사결정 용도로 포장하지 않는다.
  if (["5-18-mmm", "5-18-forecast"].includes(entry.toolId) && periodCount > 0 && periodCount < 12) {
    problems.push({ code: "min_periods", required: 12, current: periodCount });
  }
  if (["5-21", "5-22", "5-3", "9-6"].includes(entry.toolId) && periodCount > 0 && periodCount < 2) {
    problems.push({ code: "insufficient_time_variation", current: periodCount });
  }
  if (entry.toolId === "5-28" && profile.validEpisodeCount != null && profile.validEpisodeCount < 2) {
    problems.push({ code: "min_valid_episodes", required: 2, current: profile.validEpisodeCount });
  }
  return problems;
}

function copyMode(entry, hasMappingConfirmation, confirmedDesign) {
  if (hasMappingConfirmation) return "confirm_design";
  if (entry.runMode === "confirm_design" && !confirmedDesign) return "confirm_design";
  return entry.runMode === "baseline" ? "ready" : entry.runMode;
}

// UI/스토어와 분리된 단일 도구 판정. empty profile은 "데이터 없음"을 날조하지
// 않기 위해 blocked이며, profile을 생략하면 구조 계약만 검사한다.
export function evaluateAnalysisEligibility({ toolId, mapping = {}, mappingContract = null, profile = {}, confirmedDesign = false } = {}) {
  const entry = analysisCatalogEntry(toolId);
  if (!entry) return { toolId, status: "blocked", blockers: [{ code: "not_declared" }], missing: [], requiresConfirmation: [] };

  const fields = mappedFields(mapping);
  const missing = missingRequiredGroups(entry.requiredFieldGroups, fields);
  const ownedRequired = requiredOwnedRoles(entry.toolOwnedRoles);
  const missingOwned = ownedRequired.filter((field) => !fields.has(field));
  const problems = profileProblems(entry, profile);
  const requiredFields = [...new Set([...entry.requiredFields, ...ownedRequired])];
  const requiresMappingConfirmation = mappingNeedsConfirmation(mappingContract, requiredFields);
  const blockers = [
    ...missing.map((alternatives) => ({ code: "missing_fields", alternatives })),
    ...missingOwned.map((field) => ({ code: "missing_tool_owned_role", field })),
    ...problems,
  ];

  if (blockers.length) {
    return {
      toolId,
      status: "blocked",
      runMode: entry.runMode,
      executionCost: entry.executionCost,
      blockers,
      missing: [...missing.flat(), ...missingOwned],
      requiresConfirmation: entry.confirmationRequirements,
      recommendationReason: null,
    };
  }

  const status = copyMode(entry, requiresMappingConfirmation, confirmedDesign);
  return {
    toolId,
    status,
    runMode: entry.runMode,
    executionCost: entry.executionCost,
    blockers: [],
    missing: [],
    requiresConfirmation: [
      ...(requiresMappingConfirmation ? ["mapping"] : []),
      ...(status === "confirm_design" ? entry.confirmationRequirements : []),
      ...(status === "confirm_model" ? entry.confirmationRequirements : []),
    ],
    recommendationReason: entry.decisionQuestion,
  };
}

export function evaluateCatalogEligibility(input = {}) {
  const catalog = input.catalog || [];
  return catalog.map((entry) => evaluateAnalysisEligibility({ ...input, toolId: entry.toolId }));
}

const STATUS_ORDER = Object.freeze({ ready: 0, confirm_model: 1, confirm_design: 2, manual: 3, blocked: 4 });

// 동일 입력은 언제나 같은 순서를 돌려야 한다. 점수는 결과의 우열이 아니라
// 현재 데이터와 질문에 맞는 실행 순서이며, toolId는 마지막 tie-breaker다.
export function rankRecommendedAnalyses(results = [], { catalog = null, preferredQuestion = null } = {}) {
  return [...results]
    .map((result) => {
      const entry = catalog?.find((item) => item.toolId === result.toolId) || analysisCatalogEntry(result.toolId);
      const questionBoost = preferredQuestion && entry?.decisionQuestion === preferredQuestion ? 1_000 : 0;
      return { ...result, recommendationScore: (entry ? 1_000 - entry.priority : 0) + questionBoost };
    })
    .sort((left, right) => (
      (STATUS_ORDER[left.status] ?? 99) - (STATUS_ORDER[right.status] ?? 99)
      || right.recommendationScore - left.recommendationScore
      || left.toolId.localeCompare(right.toolId)
    ));
}
