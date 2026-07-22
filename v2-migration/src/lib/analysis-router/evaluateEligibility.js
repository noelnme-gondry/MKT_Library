import { TOOL_REQUIRED_FIELDS } from "@/utils/csvConstants";
import { buildDataQualityReport } from "@/lib/data-import/buildDataQualityReport";

export const ANALYSIS_CONTRACTS = {
  "5-2": { minRows: 1, minPeriods: 1, priority: 1 },
  "5-21": { minRows: 8, minPeriods: 2, priority: 2 },
  "5-22": { minRows: 20, minPeriods: 8, priority: 3 },
  "5-3": { minRows: 8, minPeriods: 2, priority: 4 },
  "5-4": { minRows: 2, minPeriods: 0, priority: 5 },
  // MMM은 12~51주를 탐색용으로 열어 두되, 예산 의사결정에 쓸 만한 상태는 52주부터다.
  "5-18": { minRows: 12, minPeriods: 12, decisionMinPeriods: 52, minDecisionActivePeriods: 26, priority: 6 },
  "5-23": { minRows: 2, minPeriods: 0, priority: 7 },
};

function missingFields(required = [], mapped = new Set()) {
  return required.flatMap((item) => {
    if (typeof item === "string") return mapped.has(item) ? [] : [item];
    if (item?.oneOf) return item.oneOf.some((field) => mapped.has(field)) ? [] : [item.oneOf.join("/")];
    return [];
  });
}

function requiredMetricKeys(required = [], mapped = new Set(), records = []) {
  const presentMetrics = new Set(records.flatMap((record) => Object.keys(record.metrics || {})));
  return [...new Set(required.flatMap((item) => {
    if (typeof item === "string") return mapped.has(item) && presentMetrics.has(item) ? [item] : [];
    if (item?.oneOf) return item.oneOf.filter((field) => mapped.has(field) && presentMetrics.has(field)).slice(0, 1);
    return [];
  }))];
}

function pearson(valuesA, valuesB) {
  const pairs = valuesA.map((value, index) => [value, valuesB[index]])
    .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
  if (pairs.length < 6) return null;
  const meanA = pairs.reduce((sum, [a]) => sum + a, 0) / pairs.length;
  const meanB = pairs.reduce((sum, [, b]) => sum + b, 0) / pairs.length;
  let numerator = 0;
  let denA = 0;
  let denB = 0;
  pairs.forEach(([a, b]) => {
    numerator += (a - meanA) * (b - meanB);
    denA += (a - meanA) ** 2;
    denB += (b - meanB) ** 2;
  });
  return denA > 0 && denB > 0 ? numerator / Math.sqrt(denA * denB) : null;
}

function evaluateMmmConfidence(records, quality, contract) {
  const mediaKeys = Object.keys(quality.metricStats).filter((key) => key.startsWith("ch_"));
  const activeMedia = mediaKeys.filter((key) => quality.metricStats[key].nonZeroCount > 0);
  const sparseMedia = activeMedia.filter((key) => quality.metricStats[key].nonZeroCount < contract.minDecisionActivePeriods);
  const collinearPairs = [];
  for (let index = 0; index < activeMedia.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < activeMedia.length; otherIndex += 1) {
      const left = activeMedia[index];
      const right = activeMedia[otherIndex];
      const correlation = pearson(records.map((record) => record.metrics?.[left]), records.map((record) => record.metrics?.[right]));
      if (correlation != null && Math.abs(correlation) >= 0.9) collinearPairs.push({ left, right, correlation });
    }
  }

  const details = [];
  if (quality.periodCount < contract.decisionMinPeriods) details.push(`관측 기간 ${quality.periodCount}주: 52주 미만이라 탐색용 결과입니다.`);
  if (activeMedia.length < 2) details.push("활성 광고 변수 2개 미만: 채널별 기여를 비교하기 어렵습니다.");
  if (sparseMedia.length) details.push(`활성 주가 26주 미만인 광고 변수: ${sparseMedia.join(", ")}`);
  if (collinearPairs.length) details.push(`같이 움직이는 광고 변수: ${collinearPairs.map((pair) => `${pair.left}·${pair.right}`).join(", ")}`);
  const tier = details.length ? "exploratory" : "decision";
  return { tier, details, mediaKeys, activeMedia, sparseMedia, collinearPairs };
}

function qualityDetails(quality) {
  const messages = {
    missing_date: "날짜가 비어 있는 행이 있습니다.",
    duplicates: "날짜와 차원 조합이 중복된 행이 있습니다.",
    invalid_values: "숫자 또는 날짜 형식이 아닌 값이 있습니다.",
    period_gaps: "관측 간격보다 긴 날짜 공백이 있습니다.",
    high_missing_rate: "핵심 지표 중 결측 비율이 20%를 넘는 항목이 있습니다.",
    all_zero_metric: "핵심 지표가 전 기간 0입니다.",
    outliers: "일반적인 범위를 크게 벗어난 값이 있습니다.",
  };
  return quality.issues.map((issue) => messages[issue.code]).filter(Boolean);
}

export function evaluateEligibility({ mapping = {}, canonicalData, toolId }) {
  const contract = ANALYSIS_CONTRACTS[toolId] || { minRows: 1, minPeriods: 0, priority: 99 };
  const records = canonicalData?.records || [];
  const mapped = new Set(Object.values(mapping).filter((field) => field && field !== "__ignore__"));
  const required = TOOL_REQUIRED_FIELDS[toolId] || [];
  const missing = missingFields(required, mapped);
  const metricKeys = requiredMetricKeys(required, mapped, records);
  const quality = buildDataQualityReport(canonicalData, { metricKeys });
  const reasons = [];
  const details = [];
  if (missing.length) reasons.push(`필수 항목 누락: ${missing.join(", ")}`);
  if (records.length < contract.minRows) reasons.push(`최소 ${contract.minRows}행 필요 (현재 ${records.length}행)`);
  if (contract.minPeriods && quality.periodCount < contract.minPeriods) reasons.push(`최소 ${contract.minPeriods}개 기간 필요 (현재 ${quality.periodCount}개 기간)`);

  const unusableMetrics = metricKeys.filter((key) => {
    const stats = quality.metricStats[key];
    return stats && (stats.validCount === 0 || stats.zeroRate === 1);
  });
  if (unusableMetrics.length) reasons.push(`유효한 핵심 지표 필요: ${unusableMetrics.join(", ")}`);

  const isBlocked = missing.length || records.length < contract.minRows || (contract.minPeriods && quality.periodCount < contract.minPeriods) || unusableMetrics.length;
  let confidenceTier = "standard";
  if (!isBlocked && toolId === "5-18") {
    const mmm = evaluateMmmConfidence(records, quality, contract);
    confidenceTier = mmm.tier;
    details.push(...mmm.details);
  }
  if (!isBlocked) details.push(...qualityDetails(quality));
  const hasCaution = details.length > 0;
  const status = isBlocked ? "blocked" : hasCaution ? "caution" : "ready";
  return {
    toolId,
    status,
    reasons,
    reasonDetails: details,
    rowCount: records.length,
    periodCount: quality.periodCount,
    priority: contract.priority,
    confidenceTier,
    quality,
  };
}

export function rankRecommendedAnalyses(results = []) {
  return [...results].filter((result) => result.status !== "blocked").sort((a, b) => {
    const statusOrder = { ready: 0, caution: 1 };
    return statusOrder[a.status] - statusOrder[b.status] || a.priority - b.priority;
  });
}
