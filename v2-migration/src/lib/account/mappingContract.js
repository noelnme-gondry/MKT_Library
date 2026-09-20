import { CANONICAL_FIELDS } from "@/lib/data-import/schema/canonicalFields";
import { projectSemanticBindingsToLegacyMapping } from "@/lib/data-import/canonical-v2/legacyProjection";

export const MAX_ACCOUNT_MAPPING_RULES = 200;
export const normalizeMappingName = value => String(value || "").normalize("NFKC").trim().toLowerCase().replace(/[\s_-]+/g, "_");
export function accountMappingRule(input) {
  if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some(key => !["normalizedColumnName", "canonicalKey"].includes(key))) throw new Error("INVALID_MAPPING");
  const { canonicalKey } = input;
  const name = normalizeMappingName(input.normalizedColumnName);
  if (typeof input.normalizedColumnName !== "string" || !name || name.length > 200 || /[\u0000-\u001f\u007f]/.test(name) || /^(?:__proto__|_proto_|prototype|constructor)$/.test(name) || typeof canonicalKey !== "string" || !Object.hasOwn(CANONICAL_FIELDS, canonicalKey)) throw new Error("INVALID_MAPPING");
  return { normalizedColumnName: name, canonicalKey };
}

// Apply only unambiguous rules consumed by this tool. Conflicts remain visible
// for review instead of summing two columns into one metric silently.
export function applyAccountMappings({ headers, mapping, semanticMapping, rules, toolId }) {
  const next = { ...mapping };
  const accepted = new Map();
  const displaced = new Set();
  const skipped = [];
  const candidates = [];
  for (const header of headers) {
    const matches = rules.filter(rule => rule.normalizedColumnName === normalizeMappingName(header));
    if (!matches.length) continue;
    const rule = matches[0];
    const binding = { source: "user", sourceColumn: header, canonicalKey: rule.canonicalKey, decision: "SUGGEST" };
    const projected = projectSemanticBindingsToLegacyMapping({ toolId, legacyMapping: {}, bindings: [binding] })[header];
    if (matches.length !== 1 || !projected || projected === "__ignore__") { skipped.push(header); continue; }
    candidates.push({ header, rule, projected });
  }
  for (const candidate of candidates) {
    const { header, rule, projected } = candidate;
    if (candidates.filter(item => item.projected === projected).length > 1) { skipped.push(header); continue; }
    for (const key of Object.keys(next)) if (key !== header && next[key] === projected) {
      next[key] = "__ignore__";
      displaced.add(key);
    }
    next[header] = projected;
    accepted.set(header, rule);
  }
  const bindings = (semanticMapping?.bindings || []).map(binding => {
    const rule = accepted.get(binding.sourceColumn);
    if (!rule && displaced.has(binding.sourceColumn)) return { ...binding, canonicalKey: null, role: null, decision: "UNKNOWN", confidence: 0, evidence: [] };
    return rule ? { ...binding, canonicalKey: rule.canonicalKey, role: CANONICAL_FIELDS[rule.canonicalKey].family, source: "user_rule", decision: "SUGGEST", confidence: 1, evidence: [{ kind: "memory", code: "ACCOUNT_USER_RULE" }] } : binding;
  });
  return { mapping: next, semanticMapping: semanticMapping ? { ...semanticMapping, bindings } : semanticMapping, applied: accepted.size, skipped };
}
