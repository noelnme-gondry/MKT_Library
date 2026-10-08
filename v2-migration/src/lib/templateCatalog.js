import { getToolTemplateFields, hasToolTemplate, ROLE_MAPPING_TEMPLATE_FIELD_META, ROLE_MAPPING_TEMPLATE_REQUIRED, ROLE_MAPPING_TEMPLATE_ONE_OF, TEMPLATE_FAMILY } from "@/components/ds/csvTemplate";
import { idToSlug, isRoutePublished, ROUTES } from "@/lib/routeMap";
import { STANDARD_FIELDS, TOOL_REQUIRED_FIELDS } from "@/utils/csvConstants";

// 도구별 템플릿 상세 페이지(`/templates/<slug>`)의 SSOT.
// 컬럼 목록은 `csvTemplate`의 실제 템플릿 빌더에서 **파생**한다 — 페이지에 적힌 컬럼과
// 내려받는 CSV 헤더가 갈라지지 않게 하기 위해서다(표 하드코딩 금지, §12.19).
const CANON_HEADER = (key) => (key === "creative_id" ? "creative_name" : key);

function requiredKeySet(toolId) {
  const keys = new Set();
  for (const field of TOOL_REQUIRED_FIELDS[toolId] || []) {
    if (typeof field === "string") keys.add(field);
  }
  for (const key of ROLE_MAPPING_TEMPLATE_REQUIRED[toolId] || []) keys.add(key);
  return keys;
}

// 슬러그는 도구 라우트 경로의 마지막 조각을 재사용한다(`/dashboard` → `dashboard`).
function templateSlug(toolId) {
  const path = idToSlug[toolId] || "";
  const last = path.split("/").filter(Boolean).pop();
  return last || null;
}

export const TEMPLATE_PAGES = ROUTES
  .filter((route) => isRoutePublished(route))
  .filter((route) => route.id.startsWith("5-") || route.id.startsWith("9-"))
  .filter((route) => hasToolTemplate(route.id))
  .map((route) => ({ toolId: route.id, slug: templateSlug(route.id), toolPath: route.slug }))
  .filter((page) => page.slug);

export const TEMPLATE_PAGE_SLUGS = TEMPLATE_PAGES.map((page) => page.slug);

export function getTemplatePage(slug, locale = "ko") {
  const page = TEMPLATE_PAGES.find((item) => item.slug === slug);
  if (!page) return null;
  const required = requiredKeySet(page.toolId);
  const alternatives = [
    ...(TOOL_REQUIRED_FIELDS[page.toolId] || []).filter(field => field?.oneOf).map(field => field.oneOf),
    ...(ROLE_MAPPING_TEMPLATE_ONE_OF[page.toolId] || []),
  ];
  const fields = getToolTemplateFields(page.toolId).map((key) => {
    const field = ROLE_MAPPING_TEMPLATE_FIELD_META[key] || STANDARD_FIELDS[key] || {};
    return {
      key: CANON_HEADER(key),
      label: (locale === "en" ? field.labelEn : field.label) || field.label || "",
      type: field.type || "text",
      group: field.group || "",
      required: required.has(key),
      alternatives: alternatives.find(group => group.includes(key))?.map(CANON_HEADER) || null,
    };
  });
  return {
    ...page,
    fields,
    requiredCount: required.size + alternatives.length,
    alternatives: alternatives.map(group => group.map(CANON_HEADER)),
    roleMapping: ["5-20", "9-1"].includes(page.toolId),
    hasUnified: TEMPLATE_FAMILY.includes(page.toolId),
  };
}
