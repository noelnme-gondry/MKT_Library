import { CANONICAL_FIELDS } from "../schema/canonicalFields";

export const MAPPING_MEMORY_SCHEMA_VERSION = 1;
export const MAPPING_MEMORY_ENABLED_KEY = "gop_semantic_mapping_memory_enabled";
const UNSAFE_NAME = /^(?:__proto__|prototype|constructor)$/i;
export const USER_RULE_SOURCE = "user_rule";

const safeText = (value) => String(value || "").normalize("NFKC").trim().toLowerCase().replace(/[\s_-]+/g, "_");
const bucket = (value, boundaries) => boundaries.find((boundary) => value <= boundary) ?? boundaries.at(-1);

export function profileFingerprint(profile = {}) {
  return {
    inferredType: profile.inferredType || "unknown",
    numericRateBucket: bucket(Number(profile.rates?.numeric || 0), [0, 0.2, 0.8, 1]),
    missingRateBucket: bucket(Number(profile.missingRate || 0), [0, 0.1, 0.5, 1]),
    cardinality: profile.cardinality || "unknown",
    unitHint: profile.rates?.currencyLike >= 0.5 ? "currency" : profile.rates?.percentLike >= 0.5 ? "rate" : "unknown",
  };
}

export function buildMappingMemoryRecord({ normalizedColumnName, canonicalKey, profile, context = {}, confirmedAt = Date.now() } = {}) {
  if (!CANONICAL_FIELDS[canonicalKey]) throw new Error("MAPPING_MEMORY_UNKNOWN_CANONICAL_KEY");
  const name = safeText(normalizedColumnName);
  if (!name || UNSAFE_NAME.test(name)) throw new Error("MAPPING_MEMORY_UNSAFE_NAME");
  const safeContext = { representation: context.representation || "tabular", roleFamilies: [...new Set(context.roleFamilies || [])].filter((family) => /^[A-Z_]+$/.test(family)) };
  return {
    schemaVersion: MAPPING_MEMORY_SCHEMA_VERSION,
    normalizedColumnName: name,
    canonicalKey,
    profile: profileFingerprint(profile),
    context: safeContext,
    confirmationCount: 1,
    confirmedAt: Number(confirmedAt),
  };
}

/** 마이페이지에서 사용자가 직접 적은 규칙인가. 자동 확정 기억과 우선순위가 다르다. */
export function isUserRule(record) {
  return record?.source === USER_RULE_SOURCE;
}

export function isMemoryCompatible(record, { normalizedColumnName, profile, context = {} } = {}) {
  if (!record || record.schemaVersion !== MAPPING_MEMORY_SCHEMA_VERSION) return false;
  if (record.normalizedColumnName !== safeText(normalizedColumnName)) return false;
  // 사용자가 마이페이지에서 직접 적은 규칙은 **컬럼 이름으로만** 맞춘다.
  // 지문은 자동 추론이 맞는지 되짚는 신호인데, 여기서는 사용자가 이미 확정했다.
  // 지문까지 요구하면 "이 컬럼은 국가다"라고 적어 둔 규칙이 파일이 조금만 달라져도
  // 조용히 안 맞아 떨어진다 — 실제로 그래서 규칙이 한 번도 적용되지 않았다.
  if (isUserRule(record)) return true;
  const current = profileFingerprint(profile);
  const stored = record.profile || {};
  if (stored.inferredType !== current.inferredType || stored.unitHint !== current.unitHint || stored.cardinality !== current.cardinality) return false;
  return (record.context?.representation || "tabular") === (context.representation || "tabular");
}

export function findCompatibleMemory(records = [], input = {}) {
  return records
    .filter((record) => isMemoryCompatible(record, input))
    // 사용자가 직접 적은 규칙이 먼저다. 그다음은 자주·최근에 확정한 것.
    .sort((left, right) => (isUserRule(right) - isUserRule(left))
      || right.confirmationCount - left.confirmationCount
      || right.confirmedAt - left.confirmedAt)[0] || null;
}

export function applyCompatibleMemory(semanticMapping, records = []) {
  if (!semanticMapping?.profile?.columns || !semanticMapping.bindings) return semanticMapping;
  const profileByHeader = Object.fromEntries(semanticMapping.profile.columns.map((profile) => [profile.header, profile]));
  const context = { representation: semanticMapping.profile.representation };
  const bindings = semanticMapping.bindings.map((binding) => {
    const record = findCompatibleMemory(records, { normalizedColumnName: binding.sourceColumn, profile: profileByHeader[binding.sourceColumn], context });
    if (!record) return binding;
    // 우선순위: 사용자 규칙 → 전역 판정 → 자동 확정 기억.
    //
    // 사용자가 마이페이지에서 직접 적은 규칙은 판정을 덮는다(1순위). 자기 파일의
    // 컬럼이 무엇인지는 추론기보다 사용자가 잘 안다. 대신 덮었다는 사실을
    // `source`에 남겨 화면이 말할 수 있게 한다 — 조용히 덮으면 왜 그렇게 읽혔는지
    // 알 길이 없다.
    //
    // 자동 확정 기억은 예전처럼 판단 보류(UNKNOWN)만 메우는 보조 신호로 둔다.
    if (!isUserRule(record) && binding.decision !== "UNKNOWN") return binding;
    return {
      ...binding,
      canonicalKey: record.canonicalKey,
      role: CANONICAL_FIELDS[record.canonicalKey].family,
      // 새 decision 값을 만들지 않는다. 어휘는 UNKNOWN·SUGGEST 둘뿐이고,
      // 세 번째를 넣으면 그걸 모르는 게이트가 조용히 갈린다 — 실제로
      // `useDataStore`의 저장 필터와 `serializeProject`가 각각 걸러 낸다.
      // 우선순위는 `source`와 confidence가 말한다.
      decision: "SUGGEST",
      confidence: isUserRule(record) ? 1 : 0.7,
      evidence: [{ kind: "memory", code: isUserRule(record) ? "USER_RULE" : "COMPATIBLE_PERSONAL_CONFIRMATION" }],
      source: isUserRule(record) ? USER_RULE_SOURCE : "personal_memory",
    };
  });
  return { ...semanticMapping, bindings };
}

export function mappingMemoryEnabled() {
  return typeof localStorage !== "undefined" && localStorage.getItem(MAPPING_MEMORY_ENABLED_KEY) === "true";
}

export function setMappingMemoryEnabled(enabled) {
  if (typeof localStorage !== "undefined") localStorage.setItem(MAPPING_MEMORY_ENABLED_KEY, enabled ? "true" : "false");
}
