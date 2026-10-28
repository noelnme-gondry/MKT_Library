// 효율 파일에서 "무엇끼리 비교하나"(분해·포화·배분의 단위)를 고르는 한 벌.
// 채널 열이 없는 단일 매체 내보내기(Meta 광고 관리자 캠페인 보고서 등)는 캠페인이 비교 단위다.
// 도구 계약(csvConstants의 TOOL_REQUIRED_FIELDS oneOf)은 이미 캠페인을 받는데, 결과 작업대 어댑터와
// 5-3 화면이 채널을 고정으로 써서 같은 파일이 한쪽에서는 되고 한쪽에서는 막혔다(2026-10-28).
// 두 경로가 이 파일 하나에서 단위를 고른다. 의존성 없는 파일로 둔다(순환 import 방지, AGENTS §7).

/** 비교 단위 우선순위: 채널 → 캠페인. 5-3은 국가도 단위로 쓸 수 있다. */
export const EFFICIENCY_UNIT_ORDER = Object.freeze(["channel", "campaign_name"]);
export const ALLOCATION_UNIT_ORDER = Object.freeze(["channel", "campaign_name", "country"]);

const has = (fields, key) => Boolean(fields && typeof fields.has === "function" && fields.has(key));

/** 매핑된 필드 중 첫 비교 단위. 캠페인 ID만 있어도 캠페인으로 본다. 없으면 null. */
export function efficiencyUnitField(fields) {
  if (has(fields, "channel")) return "channel";
  if (has(fields, "campaign_name") || has(fields, "campaign_id")) return "campaign_name";
  return null;
}

/**
 * 요청한 배분 단위가 파일에 없으면 있는 단위로 내린다(채널 → 캠페인 → 국가).
 * 요청 단위가 매핑돼 있으면 그대로 둔다 — 사람이 고른 것을 덮지 않는다.
 */
export function resolveAllocationUnit(requested, fields) {
  if (requested && has(fields, requested)) return requested;
  return ALLOCATION_UNIT_ORDER.find((key) => has(fields, key)) || requested || "channel";
}

/** 화면 문구용 단위 이름. */
export function efficiencyUnitLabel(unitField, locale = "ko") {
  const en = locale === "en";
  if (unitField === "campaign_name" || unitField === "campaign") return en ? "campaign" : "캠페인";
  if (unitField === "country") return en ? "country" : "국가";
  return en ? "channel" : "채널";
}
