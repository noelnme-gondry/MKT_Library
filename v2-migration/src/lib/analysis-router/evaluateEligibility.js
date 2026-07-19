import { TOOL_REQUIRED_FIELDS } from "@/utils/csvConstants";

export const ANALYSIS_CONTRACTS = {
  "5-2": { minRows: 1, minPeriods: 1, priority: 1 },
  "5-21": { minRows: 8, minPeriods: 2, priority: 2 },
  "5-22": { minRows: 20, minPeriods: 8, priority: 3 },
  "5-3": { minRows: 8, minPeriods: 2, priority: 4 },
  "5-4": { minRows: 2, minPeriods: 0, priority: 5 },
  "5-18": { minRows: 20, minPeriods: 12, priority: 6 },
  "5-23": { minRows: 2, minPeriods: 0, priority: 7 },
};

function missingFields(required = [], mapped = new Set()) {
  return required.flatMap((item) => {
    if (typeof item === "string") return mapped.has(item) ? [] : [item];
    if (item?.oneOf) return item.oneOf.some((field) => mapped.has(field)) ? [] : [item.oneOf.join("/")];
    return [];
  });
}

export function evaluateEligibility({ mapping = {}, canonicalData, toolId }) {
  const contract = ANALYSIS_CONTRACTS[toolId] || { minRows: 1, minPeriods: 0, priority: 99 };
  const records = canonicalData?.records || [];
  const mapped = new Set(Object.values(mapping).filter((field) => field && field !== "__ignore__"));
  const missing = missingFields(TOOL_REQUIRED_FIELDS[toolId] || [], mapped);
  const periods = new Set(records.map((record) => record.date).filter(Boolean)).size;
  const reasons = [];
  if (missing.length) reasons.push(`필수 항목 누락: ${missing.join(", ")}`);
  if (records.length < contract.minRows) reasons.push(`최소 ${contract.minRows}행 필요 (현재 ${records.length}행)`);
  if (contract.minPeriods && periods < contract.minPeriods) reasons.push(`최소 ${contract.minPeriods}개 기간 필요 (현재 ${periods}개)`);
  const status = missing.length || records.length < contract.minRows ? "blocked" : periods < contract.minPeriods ? "caution" : "ready";
  return { toolId, status, reasons, rowCount: records.length, periodCount: periods, priority: contract.priority };
}

export function rankRecommendedAnalyses(results = []) {
  return [...results].filter((result) => result.status !== "blocked").sort((a, b) => {
    const statusOrder = { ready: 0, caution: 1 };
    return statusOrder[a.status] - statusOrder[b.status] || a.priority - b.priority;
  });
}
