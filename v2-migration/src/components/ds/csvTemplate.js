// 효율패밀리 CSV 템플릿 빌더 — 구 DataFeatureMatrix에서 이관(A안: DFM 제거,
// CsvGuide로 통일). TOOL_REQUIRED/OPTIONAL_FIELDS + canonical 컬럼 순서로 헤더만
// 생성(자동매핑 안 깨지게, BOM+CRLF §7). 수학 아님 — 표시/입출력 헬퍼라 utils 아닌
// component 층에 둠.
import { TOOL_GROUP } from "@/store/useDataStore";
import { TOOL_REQUIRED_FIELDS, TOOL_OPTIONAL_FIELDS } from "@/utils/csvConstants";

// 통합 캔버니컬 컬럼 순서 — 차원 먼저, 지표는 퍼널·가치 순.
const CANON_FIELDS = [
  "date", "week",
  "country", "platform", "channel", "campaign_name", "adgroup_name", "creative_id", "creative_url",
  "cost",
  "impressions", "clicks", "installs", "actions",
  "pu_d0", "pu_d7", "pu_d14", "pu_d30", "pu_d60", "pu_d90", "pu_d180", "pu_d360",
  "revenue_d0", "revenue_d7", "revenue_d14", "revenue_d30", "revenue_d60", "revenue_d90", "revenue_d180", "revenue_d360",
  "ret_d7", "ret_d14", "ret_d30", "ret_d60", "ret_d90", "ret_d180", "ret_d360",
];

// 자유 역할 매핑 도구는 STANDARD_FIELDS 계약이 아니라 업로드 화면에서 직접
// outcome/feature를 고른다. 분석 가능한 최소 형태를 예시 헤더로 명시한다.
const ROLE_MAPPING_TEMPLATE_FIELDS = {
  "start-gate": ["date", "channel", "cost", "installs"],
  "5-20": ["user_id", "target", "invite_d1", "invite_d7", "share_d7"],
  "5-23": ["date", "holdout_group", "numerator", "denominator", "spend", "revenue_d7"],
  "5-24": ["date", "brand_search", "campaign_on"],
  "5-18-mmm": ["date", "revenue", "google_spend", "meta_spend", "market_index", "event_dummy", "regime_step"],
  "9-1": ["content_id", "outcome", "has_hook", "text_overlay", "video_length"],
};

// 자유 역할 매핑 템플릿은 STANDARD_FIELDS의 고정 필드 계약 밖에 있으므로,
// 공개 템플릿 페이지가 실제 최소 계약과 라벨을 잃지 않게 같은 SSOT에서 제공한다.
export const ROLE_MAPPING_TEMPLATE_REQUIRED = {
  "5-18-mmm": ["date", "revenue", "google_spend"],
};

export const ROLE_MAPPING_TEMPLATE_FIELD_META = {
  google_spend: { label: "Google spend", type: "number", group: "media" },
  meta_spend: { label: "Meta spend", type: "number", group: "media" },
  market_index: { label: "Market index", type: "number", group: "control" },
  event_dummy: { label: "Event dummy (0/1)", type: "number", group: "control" },
  regime_step: { label: "Regime step (0/1)", type: "number", group: "control" },
};

// 효율&예산 4총사 — 같은 grain(TOOL_GROUP === "efficiency") 공유 도구. 자체 예시
// 템플릿을 가진 라우트(/start 등)는 "통합 템플릿" 버튼 대상이 아니므로 제외한다.
// ROLE_MAPPING_TEMPLATE_FIELDS 뒤에 선언해야 TDZ를 피한다(§7 자기참조 함정).
export const TEMPLATE_FAMILY = Object.keys(TOOL_GROUP)
  .filter((id) => /^([59])-/.test(id) && TOOL_GROUP[id] === "efficiency" && !ROLE_MAPPING_TEMPLATE_FIELDS[id]);

const canonHeader = (key) => (key === "creative_id" ? "creative_name" : key);

export function getToolTemplateFields(toolId) {
  // 시작 화면은 넓은 자동매핑 스코프와 별개로, 첫 업로드용 최소 효율 예시를 유지한다.
  if (ROLE_MAPPING_TEMPLATE_FIELDS[toolId]) return [...ROLE_MAPPING_TEMPLATE_FIELDS[toolId]];
  const required = [];
  for (const field of TOOL_REQUIRED_FIELDS[toolId] || []) {
    if (typeof field === "string") required.push(field);
    else if (field?.oneOf) required.push(...field.oneOf);
  }
  const optional = (TOOL_OPTIONAL_FIELDS[toolId] || []).map((field) => field.key);
  const used = [...new Set([
    ...required,
    ...optional,
  ])];
  return [
    ...CANON_FIELDS.filter((field) => used.includes(field)),
    ...used.filter((field) => !CANON_FIELDS.includes(field)),
  ];
}

// scope: "tool"(이 도구가 쓰는 컬럼만) | "unified"(효율패밀리 전체 컬럼)
export function buildToolTemplateCsv(toolId, scope = "tool") {
  const fields = scope === "unified" ? CANON_FIELDS : getToolTemplateFields(toolId);
  const headers = [...new Set(fields.map(canonHeader))];
  return "﻿" + headers.join(",") + "\r\n";
}

export function hasToolTemplate(toolId) {
  return getToolTemplateFields(toolId).length > 0;
}

export function downloadTemplateCsv(toolId, scope = "tool") {
  const csv = buildToolTemplateCsv(toolId, scope);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = scope === "unified" ? "template_efficiency_unified.csv" : `template_${toolId}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
