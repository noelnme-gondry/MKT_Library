// Uploaded files explicitly declare their source. The filename fallback supports
// older in-memory demo fixtures only; a real upload named demo_*.csv stays real.
export function isDemoData(csv) {
  if (csv?.importSource) return csv.importSource === "demo";
  return Boolean(csv?.fileName?.startsWith("demo_"));
}
export function decisionDataOrigin(csv) {
  return isDemoData(csv) ? "demo" : csv?.raw?.length ? "real" : "unknown";
}

export function canTrackDecisionReview(record, csv, usesCsv = false) {
  return record?.dataOrigin === "real" && (!usesCsv || decisionDataOrigin(csv) === "real");
}
