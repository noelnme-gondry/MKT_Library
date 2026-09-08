import { normalizeNumericValue } from "@/lib/data-import/normalizeValues";
import { FILTER_KEYS } from "@/lib/decisionComparisonScope";

export function scopeFilters(filter = {}) {
  return Object.fromEntries(FILTER_KEYS.map((key) => [key, [...(filter[key] || [])].map(String).sort()]));
}

export function scopedInputQuality(rows, metricKeys) {
  const keys = [...new Set(metricKeys.filter(Boolean))];
  const checked = rows.length * keys.length;
  const missing = rows.reduce((count, row) => count + keys.filter((key) => normalizeNumericValue(row[key]) == null).length, 0);
  return checked ? { missing, checked, ratio: missing / checked } : null;
}

export function scopeEvidenceTable(scope) {
  return {
    name: "ANALYSIS_SCOPE",
    title: "Analysis scope and denominator",
    rows: [["period", "start", "end", "observations", "observation_unit", "denominator_key", "denominator", "cost", "currency", "missing_or_invalid_cells", "checked_cells", "filters"],
      ...scope.periods.map((period) => [period.id, period.start ?? "", period.end ?? "", period.observations ?? "", scope.observationUnit || "rows", scope.denominatorKey || "", period.denominator ?? "", period.cost ?? "", scope.currency || "", period.quality?.missing ?? "", period.quality?.checked ?? "", JSON.stringify(scope.filters || {})])],
  };
}
