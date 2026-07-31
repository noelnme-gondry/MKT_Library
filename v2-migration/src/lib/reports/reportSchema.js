const FORBIDDEN_KEYS = new Set(["raw", "rows", "csvData", "csvGroups", "canonicalData", "mappedRows", "fileName", "url"]);
export const REPORT_SUPPORTED_TOOL_IDS = new Set(["5-2", "5-21", "5-22", "5-3"]);

function plain(value) {
  return typeof value === "string" || typeof value === "number" ? String(value) : null;
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
    points: (points || []).map((item) => plain(item.text)).filter(Boolean).slice(0, 8),
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
