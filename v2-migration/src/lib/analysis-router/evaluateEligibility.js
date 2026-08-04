import { TOOL_REQUIRED_FIELDS } from "@/utils/csvConstants";
import { buildDataQualityReport } from "@/lib/data-import/buildDataQualityReport";
import { deriveStatisticalStatus } from "./statisticalStatus";

export const ANALYSIS_CONTRACTS = {
  "5-2": { minRows: 1, minPeriods: 1, priority: 1 },
  // PVM은 비교할 두 기간이 필요하다. 2주는 차단 기준, 각 채널의 8일 미만 관측은
  // 원인 순위가 흔들릴 수 있어 주의로만 낮춘다.
  "5-21": { minRows: 8, minPeriods: 14, minEntityActivePeriods: 8, entityFields: ["channel"], spendKeys: ["spend"], resultKeys: ["installs", "actions"], priority: 2 },
  // 응답곡선은 채널/캠페인별 지출 수준이 달라져야 한다. 수가 적거나 지출 변동이
  // 거의 없으면 절대 CPR 결과는 열되 한계효율 결론에는 주의 표시를 한다.
  "5-22": { minRows: 20, minPeriods: 8, minEntityActivePeriods: 6, minEntitySpendCv: 0.05, entityFields: ["channel", "campaign_name"], spendKeys: ["cost"], resultKeys: ["installs", "actions"], priority: 3 },
  // 예산 배분은 단일 채널이면 배분 비교 자체가 불가능하다. 다만 현재 성과 읽기는
  // 유효하므로 차단 대신 주의로 남긴다.
  "5-3": { minRows: 8, minPeriods: 7, minEntities: 2, minEntityActivePeriods: 4, minEntitySpendCv: 0.03, entityFields: ["channel", "campaign_name"], spendKeys: ["cost"], resultKeys: ["installs", "actions"], priority: 4 },
  "5-4": { minRows: 2, minPeriods: 0, priority: 5 },
  // MMM은 12~51주를 탐색용으로 열어 두되, 예산 의사결정에 쓸 만한 상태는 52주부터다.
  "5-18": { minRows: 12, minPeriods: 12, decisionMinPeriods: 52, minDecisionActivePeriods: 26, priority: 6 },
  "5-23": { minRows: 2, minPeriods: 0, priority: 7 },
  "5-24": { minRows: 28, minPeriods: 28, priority: 8 },
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

function firstFiniteMetric(record, keys = []) {
  return keys.map((key) => record.metrics?.[key]).find(Number.isFinite) ?? 0;
}

function coefficientOfVariation(values = []) {
  if (!values.length) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (!mean) return null;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / Math.abs(mean);
}

// 어떤 분석이든 "행이 N개"보다 "각 비교 단위가 며칠 실제 운영됐는가"가 더 중요하다.
// 같은 날짜의 세부 행은 먼저 합쳐, creative가 많은 채널이 과대표집계되지 않게 한다.
function evaluateEntityCoverage(records, contract) {
  if (!contract.entityFields?.length) return { entities: [], details: [] };
  const entityField = contract.entityFields.find((field) => records.some((record) => record.dimensions?.[field]));
  if (!entityField) return { entities: [], details: [] };
  const byEntity = new Map();
  records.forEach((record) => {
    const entity = record.dimensions?.[entityField];
    if (!entity || !record.date) return;
    if (!byEntity.has(entity)) byEntity.set(entity, new Map());
    const byPeriod = byEntity.get(entity);
    const current = byPeriod.get(record.date) || { spend: 0, results: 0 };
    current.spend += firstFiniteMetric(record, contract.spendKeys);
    current.results += firstFiniteMetric(record, contract.resultKeys);
    byPeriod.set(record.date, current);
  });
  const entities = [...byEntity.entries()].map(([entity, periods]) => {
    const values = [...periods.values()];
    return {
      entity,
      periodCount: periods.size,
      activePeriodCount: values.filter((value) => value.spend > 0 && value.results > 0).length,
      spendCv: coefficientOfVariation(values.map((value) => value.spend).filter((value) => value > 0)),
    };
  });
  const details = [];
  if (contract.minEntities && entities.length < contract.minEntities) details.push(`비교 가능한 ${entityField}이 ${contract.minEntities}개 미만입니다.`);
  const sparse = entities.filter((item) => item.activePeriodCount < contract.minEntityActivePeriods);
  if (sparse.length) details.push(`운영 관측이 ${contract.minEntityActivePeriods}기간 미만인 ${entityField}: ${sparse.map((item) => item.entity).join(", ")}`);
  const lowVariation = entities.filter((item) => item.spendCv != null && item.spendCv < contract.minEntitySpendCv);
  if (lowVariation.length) details.push(`지출 변동이 너무 작은 ${entityField}: ${lowVariation.map((item) => item.entity).join(", ")}`);
  return { entityField, entities, details };
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

export function evaluateEligibility({ mapping = {}, canonicalData, toolId, diagnosis }) {
  const contract = ANALYSIS_CONTRACTS[toolId] || { minRows: 1, minPeriods: 0, priority: 99 };
  const records = canonicalData?.records || [];
  const mapped = new Set(Object.values(mapping).filter((field) => field && field !== "__ignore__"));
  const required = TOOL_REQUIRED_FIELDS[toolId] || [];
  const missing = missingFields(required, mapped);
  const metricKeys = requiredMetricKeys(required, mapped, records);
  const quality = buildDataQualityReport(canonicalData, { metricKeys });
  const reasons = [];
  const blockers = [];
  const details = [];
  if (missing.length) {
    reasons.push(`필수 항목 누락: ${missing.join(", ")}`);
    blockers.push({ code: "missing_fields", fields: missing });
  }
  if (records.length < contract.minRows) {
    reasons.push(`최소 ${contract.minRows}행 필요 (현재 ${records.length}행)`);
    blockers.push({ code: "min_rows", required: contract.minRows, current: records.length });
  }
  if (contract.minPeriods && quality.periodCount < contract.minPeriods) {
    reasons.push(`최소 ${contract.minPeriods}개 기간 필요 (현재 ${quality.periodCount}개 기간)`);
    blockers.push({ code: "min_periods", required: contract.minPeriods, current: quality.periodCount });
  }

  const unusableMetrics = metricKeys.filter((key) => {
    const stats = quality.metricStats[key];
    return stats && (stats.validCount === 0 || stats.zeroRate === 1);
  });
  if (unusableMetrics.length) {
    reasons.push(`유효한 핵심 지표 필요: ${unusableMetrics.join(", ")}`);
    blockers.push({ code: "unusable_metrics", fields: unusableMetrics });
  }

  const isBlocked = missing.length || records.length < contract.minRows || (contract.minPeriods && quality.periodCount < contract.minPeriods) || unusableMetrics.length;
  let confidenceTier = "standard";
  if (!isBlocked && toolId === "5-18") {
    const mmm = evaluateMmmConfidence(records, quality, contract);
    confidenceTier = mmm.tier;
    details.push(...mmm.details);
  }
  const entityCoverage = !isBlocked ? evaluateEntityCoverage(records, contract) : { entities: [], details: [] };
  if (!isBlocked) details.push(...entityCoverage.details);
  if (!isBlocked) details.push(...qualityDetails(quality));
  const hasCaution = details.length > 0;
  const status = isBlocked ? "blocked" : hasCaution ? "caution" : "ready";
  const statisticalStatus = deriveStatisticalStatus({
    hasEstimate: !isBlocked,
    rowCount: records.length,
    requiredMissing: missing,
    qualityGrade: quality.grade,
    warnings: details,
  });
  const recommendation = diagnosis?.byTool?.[toolId] || null;
  return {
    toolId,
    status,
    reasons,
    blockers,
    reasonDetails: details,
    rowCount: records.length,
    periodCount: quality.periodCount,
    priority: contract.priority,
    confidenceTier,
    statisticalStatus,
    quality,
    entityCoverage,
    recommendationScore: recommendation?.score || 0,
    recommendationReason: recommendation?.reason || null,
  };
}

export function formatEligibilityBlocker(result, locale = "ko") {
  const blocker = result?.blockers?.[0];
  if (!blocker) return result?.reasons?.[0] || null;
  const isEn = locale === "en";
  if (blocker.code === "missing_fields") {
    return isEn
      ? `Map these required fields, then run the analysis again: ${blocker.fields.join(", ")}.`
      : `CSV 매핑에서 다음 필수 항목을 연결한 뒤 다시 분석하세요: ${blocker.fields.join(", ")}.`;
  }
  if (blocker.code === "min_rows") {
    return isEn
      ? `Add more rows: at least ${blocker.required.toLocaleString()} are required (${blocker.current.toLocaleString()} now).`
      : `행을 더 추가하세요. 최소 ${blocker.required.toLocaleString()}행이 필요하며 현재 ${blocker.current.toLocaleString()}행입니다.`;
  }
  if (blocker.code === "min_periods") {
    return isEn
      ? `Extend the date range to at least ${blocker.required} periods (${blocker.current} now).`
      : `날짜 범위를 최소 ${blocker.required}개 기간까지 늘리세요. 현재 ${blocker.current}개 기간입니다.`;
  }
  if (blocker.code === "unusable_metrics") {
    return isEn
      ? `Provide non-empty, non-zero values for: ${blocker.fields.join(", ")}.`
      : `다음 핵심 지표에 비어 있지 않은 0 초과 값을 넣으세요: ${blocker.fields.join(", ")}.`;
  }
  return result?.reasons?.[0] || null;
}

export function rankRecommendedAnalyses(results = []) {
  return [...results].filter((result) => result.status !== "blocked").sort((a, b) => {
    const statusOrder = { ready: 0, caution: 1 };
    return statusOrder[a.status] - statusOrder[b.status] || b.recommendationScore - a.recommendationScore || a.priority - b.priority;
  });
}
