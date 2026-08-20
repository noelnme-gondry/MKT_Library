import { CANONICAL_FIELDS } from "../schema/canonicalFields";
const SUGGEST_THRESHOLD = 0.6;
export function resolveSemanticBindings({ headers = [], candidatesByHeader = {} } = {}) {
  const selected = new Set();
  return headers.map((sourceColumn) => {
    const candidates = candidatesByHeader[sourceColumn] || [];
    const candidate = candidates.find((item) => {
      const field = CANONICAL_FIELDS[item.canonicalKey];
      return item.confidence >= SUGGEST_THRESHOLD && (field?.repeatable || !selected.has(item.canonicalKey));
    });
    if (!candidate) return { sourceColumn, canonicalKey: null, role: "UNKNOWN", confidence: 0, decision: "UNKNOWN", evidence: [] };
    const field = CANONICAL_FIELDS[candidate.canonicalKey];
    if (!field.repeatable) selected.add(candidate.canonicalKey);
    return { sourceColumn, canonicalKey: candidate.canonicalKey, role: candidate.role, confidence: candidate.confidence, decision: "SUGGEST", evidence: candidate.evidence.map((code) => ({ kind: code.startsWith("NAME") || code.startsWith("EXACT") ? "name" : code.includes("CONTEXT") || code.includes("NEAR") ? "context" : "value", code })) };
  });
}
