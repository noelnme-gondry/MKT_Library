import { STANDARD_FIELDS, TOOL_OPTIONAL_FIELDS, TOOL_REQUIRED_FIELDS } from "@/utils/csvConstants";
import { scoreMappingCandidates } from "./scoreMappingCandidates";

function fieldKeysForTool(toolId) {
  const keys = new Set();
  (TOOL_REQUIRED_FIELDS[toolId] || []).forEach((field) => {
    if (typeof field === "string") keys.add(field);
    field?.oneOf?.forEach((key) => keys.add(key));
  });
  (TOOL_OPTIONAL_FIELDS[toolId] || []).forEach(({ key }) => keys.add(key));
  return [...keys];
}

function missingRequiredFields(required = [], mapping = {}) {
  const mapped = new Set(Object.values(mapping).filter((field) => field && field !== "__ignore__"));
  return required.flatMap((field) => {
    if (typeof field === "string") return mapped.has(field) ? [] : [field];
    if (field?.oneOf) return field.oneOf.some((candidate) => mapped.has(candidate)) ? [] : [field.oneOf.join("/")];
    return [];
  });
}

function typeWarnings({ mapping = {}, profiles = [] } = {}) {
  const profileByHeader = Object.fromEntries(profiles.map((profile) => [profile.header, profile]));
  return Object.entries(mapping).flatMap(([header, fieldKey]) => {
    if (!fieldKey || fieldKey === "__ignore__") return [];
    const profile = profileByHeader[header];
    const field = STANDARD_FIELDS[fieldKey];
    if (!profile || !field) return [];
    const compatible = field.type === "date"
      ? profile.dateRate >= 0.5
      : field.type === "number" || field.type === "percent"
        ? profile.numericRate >= 0.5
        : true;
    return compatible ? [] : [{ header, field: fieldKey, inferredType: profile.inferredType, expectedType: field.type }];
  });
}

/**
 * Single input contract for CSV upload, handoff, and tool-specific mapping.
 * This is an additive wrapper around the existing scorer; it does not change
 * automatic selection thresholds or engine inputs.
 */
export function buildMappingContract({ toolId, headers = [], rows = [], source = "csv" } = {}) {
  const allowedKeys = fieldKeysForTool(toolId);
  const scored = scoreMappingCandidates({ headers, rows, allowedKeys, fields: STANDARD_FIELDS });
  const mapping = scored.selections;
  const requiredMissing = missingRequiredFields(TOOL_REQUIRED_FIELDS[toolId] || [], mapping);
  const typeWarningList = typeWarnings({ mapping, profiles: scored.profiles });
  const hasConflict = scored.conflicts.length > 0;
  const hasReview = scored.assessments.some((item) => item.state === "review" || item.state === "must_confirm" || item.state === "conflict");
  const confidence = requiredMissing.length || hasConflict ? "blocked" : hasReview || typeWarningList.length ? "review" : "confirmed";

  return {
    toolId,
    source,
    mapping,
    candidates: scored.candidates,
    conflicts: scored.conflicts,
    assessments: scored.assessments,
    profiles: scored.profiles,
    requiredMissing,
    typeWarnings: typeWarningList,
    unitWarnings: [],
    confidence,
    userConfirmed: false,
  };
}
