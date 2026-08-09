import { ROUTES, isRoutePublished } from "@/lib/routeMap";

const FORBIDDEN_KEYS = new Set(["raw", "rows", "csvData", "csvGroups", "canonicalData", "mappedRows", "fileName", "url"]);

// 공개 분석 도구는 모두 같은 `ResultActionCard` 계약(결론·근거·수치)을 쓰므로
// 보고서 블록 대상도 라우트에서 **파생**한다(도구 추가 시 목록 갱신을 잊는 구조 제거).
// CSV 서명이 없는 도구는 아래 inputSignature 게이트에서 자연히 걸러진다.
export const REPORT_SUPPORTED_TOOL_IDS = new Set(
  ROUTES.filter((route) => isRoutePublished(route) && (route.id.startsWith("5-") || route.id.startsWith("9-")))
    .map((route) => route.id),
);

function plain(value) {
  return typeof value === "string" || typeof value === "number" ? String(value) : null;
}

function plainPoint(item) {
  return [plain(item?.label), plain(item?.text), plain(item?.detail)].filter(Boolean).join(" · ") || null;
}

function containsForbidden(value, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return false;
  seen.add(value);
  return Object.entries(value).some(([key, child]) => FORBIDDEN_KEYS.has(key) || containsForbidden(child, seen));
}

export function reportBlockFromResultCard({ toolId, toolTitle, headline, points, stats, inputSignature, locale, scope = {} }) {
  const title = plain(headline);
  if (!REPORT_SUPPORTED_TOOL_IDS.has(toolId) || !title || !inputSignature) return null;
  const block = {
    schemaVersion: 1,
    id: `${toolId}:${inputSignature}:summary`,
    toolId,
    toolTitle: plain(toolTitle) || toolId,
    blockKind: "summary",
    headline: title.slice(0, 240),
    points: (points || []).map(plainPoint).filter(Boolean).slice(0, 8),
    stats: (stats || []).map((item) => ({
      label: plain(item.label) || "",
      displayValue: plain(item.value) || "",
    })).filter((item) => item.label && item.displayValue).slice(0, 8),
    scope,
    inputSignature,
    locale: locale === "en" ? "en" : "ko",
  };
  return containsForbidden(block) ? null : block;
}

export function serializeReportDraft(draft) {
  if (containsForbidden(draft)) throw new Error("REPORT_FORBIDDEN_DATA");
  return {
    schemaVersion: 1,
    title: String(draft?.title || "").slice(0, 160),
    period: draft?.period ? { start: String(draft.period.start || ""), end: String(draft.period.end || "") } : undefined,
    blocks: (draft?.blocks || []).filter((block) => block?.schemaVersion === 1),
    notes: (draft?.notes || []).map((note) => ({ id: String(note.id), text: String(note.text || "").slice(0, 2000) })),
  };
}
