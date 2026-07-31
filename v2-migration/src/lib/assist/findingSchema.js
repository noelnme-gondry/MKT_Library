const FORBIDDEN_KEYS = new Set(["raw", "rows", "csvData", "csvGroups", "canonicalData", "mappedRows", "fileName", "url"]);
const KINDS = new Set(["anomaly", "saturation", "allocation", "quality", "opportunity"]);
const SEVERITIES = new Set(["info", "watch", "action"]);

function hasForbiddenKey(value, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return false;
  seen.add(value);
  return Object.entries(value).some(([key, child]) => FORBIDDEN_KEYS.has(key) || hasForbiddenKey(child, seen));
}

export function validateFinding(finding) {
  if (!finding || finding.schemaVersion !== 1 || hasForbiddenKey(finding)) return false;
  if (!finding.id || !finding.toolId || !finding.dataGroup || !finding.inputSignature) return false;
  if (!KINDS.has(finding.kind) || !SEVERITIES.has(finding.severity)) return false;
  if (!Number.isFinite(finding.score) || finding.score < 0 || finding.score > 100) return false;
  if (typeof finding.headline !== "string" || typeof finding.detail !== "string") return false;
  return true;
}

export function findingHasForbiddenData(finding) {
  return hasForbiddenKey(finding);
}

