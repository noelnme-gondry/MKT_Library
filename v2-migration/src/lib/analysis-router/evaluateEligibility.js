import { TOOL_REQUIRED_FIELDS } from "@/utils/csvConstants";
import { getToolGuide } from "@/utils/toolGuide";
import { buildDataQualityReport } from "@/lib/data-import/buildDataQualityReport";
import { buildVifSpendPanel } from "./vifReadiness";
import { deriveStatisticalStatus } from "./statisticalStatus";

// 5-18 서브도구는 같은 주간 패널 매핑 계약을 공유한다. 화면별 계산 가능 수준은
// 각 엔진이 더 엄격하게 판정하지만, 공용 업로더의 최소 컬럼·기간 게이트 자체가
// 빠지면 /start와 직접 진입이 서로 다른 파일을 "가능"이라고 말하게 된다.
const RESPONSE_PANEL_BASE_CONTRACT = Object.freeze({ minRows: 1, minPeriods: 1 });

export const ANALYSIS_CONTRACTS = {
  "5-2": { minRows: 1, minPeriods: 1, priority: 1 },
  // PVM은 비교할 두 기간이 필요하다. 2주는 차단 기준, 각 채널의 8일 미만 관측은
  // 원인 순위가 흔들릴 수 있어 주의로만 낮춘다.
  "5-21": { minRows: 8, minPeriods: 14, minEntityActivePeriods: 8, entityFields: ["channel"], spendKeys: ["spend", "cost"], resultKeys: ["installs", "actions"], priority: 2 },
  // 응답곡선은 채널/캠페인별 지출 수준이 달라져야 한다. 수가 적거나 지출 변동이
  // 거의 없으면 절대 CPR 결과는 열되 한계효율 결론에는 주의 표시를 한다.
  "5-22": { minRows: 20, minPeriods: 8, minEntityActivePeriods: 6, minEntitySpendCv: 0.05, entityFields: ["channel", "campaign_name"], spendKeys: ["cost"], resultKeys: ["installs", "actions"], priority: 3 },
  // 예산 배분은 단일 채널이면 배분 비교 자체가 불가능하다. 다만 현재 성과 읽기는
  // 유효하므로 차단 대신 주의로 남긴다.
  "5-3": { minRows: 8, minPeriods: 7, minEntities: 2, minEntityActivePeriods: 4, minEntitySpendCv: 0.03, entityFields: ["channel", "campaign_name"], spendKeys: ["cost"], resultKeys: ["installs", "actions"], priority: 4 },
  "5-4": { minRows: 2, minPeriods: 0, priority: 5 },
  // MMM은 12~51주를 탐색용으로 열어 두되, 예산 의사결정에 쓸 만한 상태는 52주부터다.
  // 추천은 매핑 허브가 아니라 실제 분석(기여 분해)을 가리킨다 — 허브는 목록에 없다.
  "5-18-trend": { ...RESPONSE_PANEL_BASE_CONTRACT, priority: 4 },
  // 변화맵은 최소 두 관측 기간이 있어야 WoW 방향을 만들 수 있다.
  "5-18-paid-organic": { ...RESPONSE_PANEL_BASE_CONTRACT, minRows: 2, minPeriods: 2, priority: 5 },
  "5-18-cannibal": { ...RESPONSE_PANEL_BASE_CONTRACT, priority: 6 },
  "5-18-mmm": { minRows: 12, minPeriods: 12, decisionMinPeriods: 52, minDecisionActivePeriods: 26, priority: 6 },
  "5-18-forecast": { minRows: 12, minPeriods: 12, priority: 7 },
  "5-23": { minRows: 2, minPeriods: 0, priority: 7 },
  "5-24": { minRows: 28, minPeriods: 28, priority: 8 },
  // VIF는 최소 2개 채널과 채널 수보다 3개 이상 많은 날짜가 있어야 역행렬을
  // 안정적으로 계산할 수 있다. 결과 지표 없이 날짜·비용·채널만으로 판정한다.
  "5-25": { minRows: 10, minPeriods: 5, minEntities: 2, blockBelowMinEntities: true, minPeriodsOverEntities: 3, entityFields: ["channel", "campaign_name"], spendKeys: ["cost"], priority: 5 },
  // 앞뒤 기간을 갈라 비교하므로 날짜 4일 + 소스 2개가 최소 조건이다.
  "5-27": { minRows: 8, minPeriods: 4, minEntities: 2, blockBelowMinEntities: true, entityFields: ["store_source"], priority: 6 },
  // 한 행이 한 핵심 액션 관측 에피소드라 날짜 축을 요구하지 않는다. 기간과 이탈 여부의
  // 유효성·중도절단 구성은 5-28 순수 엔진이 별도로 검증한다.
  "5-28": { minRows: 2, minPeriods: 0, priority: 9 },
  // 두 기간을 비교하는 도구라 최소 2개 기간이 필요하다. 세그먼트 축·인원수 컬럼은
  // 사용자마다 이름이 달라 표준 필드로 요구하지 않고 도구 안 역할 매퍼가 검증한다.
  "5-29": { minRows: 4, minPeriods: 2, priority: 8 },
  // 검색어 리포트와 소재 일별 리포트는 일반 운영 CSV와 구조가 달라, /start에서
  // 개별 도구의 매핑 계약으로 별도 판정해야 한다.
  "5-26": { minRows: 1, minPeriods: 1, priority: 2 },
  "9-6": { minRows: 8, minPeriods: 7, minEntityActivePeriods: 4, entityFields: ["creative_id"], spendKeys: ["spend", "cost"], resultKeys: ["installs"], priority: 3 },
  // 5-20·9-1은 효율 패널과 grain이 다르다(1행 = 유저 1명 / 콘텐츠 1편). 캠페인 일별
  // CSV로는 사실상 항상 "불가"지만, 목록에서 통째로 빼면 "왜 못 하는지, 뭐가 더
  // 필요한지"를 아예 못 보게 된다 — 5-23처럼 **의도적으로** 제외하는 것과 "그냥
  // 없는 것"은 다르다(실제로 이 둘은 후자였다). 표준 필드 계약(TOOL_REQUIRED_FIELDS)에
  // 억지로 넣지는 않는다: user_id·converted는 STANDARD_FIELDS 키가 아니라 템플릿·
  // 매핑 파이프라인이 undefined를 받게 된다. 필요한 grain·컬럼은 TOOL_GUIDE에서 파생한다.
  "5-20": { minRows: 1, minPeriods: 0, foreignGrain: true, priority: 20 },
  "9-1": { minRows: 1, minPeriods: 0, foreignGrain: true, priority: 21 },
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

function defaultRecommendationReason({ toolId, periodCount, entityCoverage, locale }) {
  const entityLabel = entityCoverage?.entityField === "campaign_name"
    ? (locale === "en" ? "campaign" : "캠페인")
    : (locale === "en" ? "channel" : "채널");
  const periodLabel = locale === "en" ? `${periodCount} dated periods` : `${periodCount}일자`;
  const reasons = {
    "5-2": locale === "en"
      ? `${periodLabel} of spend and outcome data are ready for a first performance, pacing, and anomaly check.`
      : `${periodLabel}의 비용·성과 데이터가 있어 전체 흐름, 예산 속도, 이상 신호부터 확인할 수 있습니다.`,
    "5-21": locale === "en"
      ? `${periodLabel} of ${entityLabel}-level spend and outcome data can explain what changed between recent periods.`
      : `${periodLabel}의 ${entityLabel}별 비용·성과 데이터가 있어 최근 성과 변화의 원인을 비교할 수 있습니다.`,
    "5-22": locale === "en"
      ? `${entityLabel}-level spend varies across ${periodLabel}, so you can check where efficiency is nearing its limit.`
      : `${periodLabel} 동안 ${entityLabel}별 지출 변동이 있어 어디가 한계 효율에 가까운지 확인할 수 있습니다.`,
    "5-3": locale === "en"
      ? `${entityLabel}-level performance across ${periodLabel} is ready for increase/decrease budget scenarios.`
      : `${periodLabel}의 ${entityLabel}별 성과가 있어 증액·감액 예산 시나리오를 비교할 수 있습니다.`,
    "5-25": locale === "en"
      ? `${periodLabel} of spend across multiple ${entityLabel}s can be checked for overlapping movement before MMM.`
      : `${periodLabel}의 여러 ${entityLabel} 지출이 있어 MMM 전에 중복 움직임을 점검할 수 있습니다.`,
    "5-27": locale === "en"
      ? `Product page views and installs by traffic source are ready to split store conversion into mix and efficiency.`
      : `유입 소스별 제품 페이지 조회·설치가 있어 스토어 전환율 변화를 구성과 효율로 나눠 볼 수 있습니다.`,
    "5-26": locale === "en"
      ? `Search terms, taps, spend, and outcomes are ready to review Exact promotion and CPT actions.`
      : `검색어·탭·비용·성과가 있어 Exact 승격 후보와 CPT 조정 후보를 바로 확인할 수 있습니다.`,
    "9-6": locale === "en"
      ? `Creative-level delivery and outcome data can identify fatigue and the next replacement candidates.`
      : `소재별 노출·탭·성과가 있어 피로도와 다음 교체 후보를 확인할 수 있습니다.`,
  };
  return reasons[toolId] || null;
}

export function evaluateEligibility({ mapping = {}, canonicalData, toolId, diagnosis, locale = "ko", mappingContract = null }) {
  const contract = ANALYSIS_CONTRACTS[toolId] || { minRows: 1, minPeriods: 0, priority: 99 };
  const records = canonicalData?.records || [];
  const mapped = new Set(Object.values(mapping).filter((field) => field && field !== "__ignore__"));
  const required = TOOL_REQUIRED_FIELDS[toolId] || [];
  const requiredKeys = new Set(required.flatMap((field) => typeof field === "string" ? [field] : field?.oneOf || []));
  const missing = missingFields(required, mapped);
  const metricKeys = requiredMetricKeys(required, mapped, records);
  const quality = buildDataQualityReport(canonicalData, { metricKeys });
  const vifPanel = toolId === "5-25" ? buildVifSpendPanel(records.map((record) => ({
    date: record.date,
    entity: record.dimensions?.channel || record.dimensions?.campaign_name,
    cost: record.metrics?.cost ?? record.metrics?.spend,
  }))) : null;
  const eligiblePeriodCount = vifPanel ? vifPanel.dates.length : quality.periodCount;
  const preliminaryEntityCoverage = evaluateEntityCoverage(records, contract);
  const eligibleEntityCount = vifPanel ? vifPanel.entities.length : preliminaryEntityCoverage.entities.length;
  const dynamicMinPeriods = contract.minPeriodsOverEntities && eligibleEntityCount
    ? eligibleEntityCount + contract.minPeriodsOverEntities
    : 0;
  const requiredPeriodCount = Math.max(contract.minPeriods || 0, dynamicMinPeriods);
  const reasons = [];
  const blockers = [];
  const details = [];
  if (missing.length) {
    reasons.push(`필수 항목 누락: ${missing.join(", ")}`);
    blockers.push({ code: "missing_fields", fields: missing });
  }
  // grain이 다른 도구는 "이 CSV로는 불가"를 컬럼 이름까지 붙여 정직하게 말한다.
  // 문구는 TOOL_GUIDE에서 파생 — 여기 다시 적으면 업로드 화면 안내와 갈라진다.
  const foreignGrainGuide = contract.foreignGrain ? getToolGuide(toolId, locale) : null;
  const foreignGrainColumns = (foreignGrainGuide?.needs || [])
    .filter((need) => need.required)
    .map((need) => need.label || need.col);
  if (foreignGrainGuide) {
    reasons.push(locale === "en"
      ? `Needs a different CSV grain (${foreignGrainGuide.grain}) — required: ${foreignGrainColumns.join(", ")}`
      : `다른 단위의 CSV가 필요합니다 (${foreignGrainGuide.grain}) — 필요: ${foreignGrainColumns.join(", ")}`);
    blockers.push({ code: "foreign_grain", grain: foreignGrainGuide.grain, fields: foreignGrainColumns });
  }
  const hasMappingConflict = Boolean(mappingContract?.conflicts?.length);
  const hasRequiredMappingConfirmation = Boolean(mappingContract?.assessments?.some((assessment) => (
    assessment.state === "must_confirm" && requiredKeys.has(assessment.field)
  )));
  if (hasMappingConflict) {
    reasons.push("자동 매핑 충돌 확인 필요");
    blockers.push({ code: "mapping_conflict" });
  }
  if (hasRequiredMappingConfirmation) {
    reasons.push("필수 컬럼 자동 매핑 확인 필요");
    blockers.push({ code: "mapping_confirmation" });
  }
  if (records.length < contract.minRows) {
    reasons.push(`최소 ${contract.minRows}행 필요 (현재 ${records.length}행)`);
    blockers.push({ code: "min_rows", required: contract.minRows, current: records.length });
  }
  const hasTooFewPeriods = requiredPeriodCount > 0 && eligiblePeriodCount < requiredPeriodCount;
  if (hasTooFewPeriods) {
    reasons.push(`최소 ${requiredPeriodCount}개 기간 필요 (현재 ${eligiblePeriodCount}개 기간)`);
    blockers.push({ code: "min_periods", required: requiredPeriodCount, current: eligiblePeriodCount });
  }

  const unusableMetrics = metricKeys.filter((key) => {
    const stats = quality.metricStats[key];
    return stats && (stats.validCount === 0 || stats.zeroRate === 1);
  });
  if (unusableMetrics.length) {
    reasons.push(`유효한 핵심 지표 필요: ${unusableMetrics.join(", ")}`);
    blockers.push({ code: "unusable_metrics", fields: unusableMetrics });
  }

  const hasTooFewEntities = Boolean(contract.blockBelowMinEntities && eligibleEntityCount < contract.minEntities);
  if (hasTooFewEntities) {
    reasons.push(`비교 가능한 단위 최소 ${contract.minEntities}개 필요 (현재 ${eligibleEntityCount}개)`);
    blockers.push({ code: "min_entities", required: contract.minEntities, current: eligibleEntityCount });
  }
  const hasInsufficientVifVariation = Boolean(vifPanel && !hasTooFewEntities && !unusableMetrics.length && vifPanel.entities.length >= 2 && vifPanel.variableEntityIndices.length < 2);
  if (hasInsufficientVifVariation) {
    reasons.push(`지출이 변한 채널 또는 캠페인 최소 2개 필요 (현재 ${vifPanel.variableEntityIndices.length}개)`);
    blockers.push({ code: "insufficient_variation", required: 2, current: vifPanel.variableEntityIndices.length });
  }
  const isBlocked = Boolean(foreignGrainGuide) || missing.length || hasMappingConflict || hasRequiredMappingConfirmation || records.length < contract.minRows || hasTooFewPeriods || hasTooFewEntities || hasInsufficientVifVariation || unusableMetrics.length;
  let confidenceTier = "standard";
  if (!isBlocked && toolId === "5-18-mmm") {
    const mmm = evaluateMmmConfidence(records, quality, contract);
    confidenceTier = mmm.tier;
    details.push(...mmm.details);
  }
  const entityCoverage = !isBlocked ? preliminaryEntityCoverage : { entities: preliminaryEntityCoverage.entities, details: [] };
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
  const schemaRecommendationScore = toolId === "5-26" && mapped.has("search_term")
    ? 120
    : (toolId === "9-6" && mapped.has("creative_id") ? 110 : 0);
  return {
    toolId,
    status,
    reasons,
    blockers,
    reasonDetails: details,
    rowCount: records.length,
    periodCount: eligiblePeriodCount,
    priority: contract.priority,
    confidenceTier,
    statisticalStatus,
    quality,
    entityCoverage,
    recommendationScore: recommendation?.score || schemaRecommendationScore,
    recommendationReason: recommendation?.reason || (!isBlocked
      ? defaultRecommendationReason({ toolId, periodCount: eligiblePeriodCount, entityCoverage, locale })
      : null),
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
  if (blocker.code === "min_entities") {
    return isEn
      ? `Add another comparison unit: at least ${blocker.required} channels or campaigns are required (${blocker.current} now).`
      : `비교 단위를 더 추가하세요. 채널 또는 캠페인이 최소 ${blocker.required}개 필요하며 현재 ${blocker.current}개입니다.`;
  }
  if (blocker.code === "mapping_conflict") {
    return isEn
      ? "Review the conflicting automatic mappings before opening this analysis."
      : "충돌한 자동 매핑을 확인한 뒤 이 분석을 여세요.";
  }
  if (blocker.code === "mapping_confirmation") {
    return isEn
      ? "Confirm the required column mapping before opening this analysis."
      : "필수 컬럼의 자동 매핑을 확인한 뒤 이 분석을 여세요.";
  }
  if (blocker.code === "insufficient_variation") {
    return isEn
      ? `Add independent spend movement: at least ${blocker.required} channels or campaigns must vary over time (${blocker.current} now).`
      : `지출 변동을 추가하세요. 시간에 따라 비용이 변한 채널 또는 캠페인이 최소 ${blocker.required}개 필요하며 현재 ${blocker.current}개입니다.`;
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
