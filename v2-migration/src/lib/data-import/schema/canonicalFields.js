// Semantic Mapper V2의 전역 역할 registry. 이 파일은 기존 STANDARD_FIELDS를
// 대체하지 않는다. V1 입력·엔진 계약은 마이그레이션이 끝날 때까지 유지한다.
// alias는 의미 정의가 아니라 다음 단계 scorer의 결정적 신호로 분리한다.
const field = (key, family, label, labelEn, options = {}) => ({
  key,
  family,
  label,
  labelEn,
  valueType: options.valueType || "number",
  unitFamily: options.unitFamily || "count",
  aggregation: options.aggregation || "sum",
  allowedSigns: options.allowedSigns || "non_negative",
  cardinalityHint: options.cardinalityHint || "many",
  repeatable: Boolean(options.repeatable),
  windowSupport: Boolean(options.windowSupport),
  derivedFormula: options.derivedFormula || null,
  validationRules: options.validationRules || [],
});

export const CANONICAL_FIELD_FAMILIES = new Set([
  "TIME", "DIMENSION", "MEDIA", "OUTCOME", "CONTROL", "IDENTIFIER", "DERIVED_METRIC",
]);

export const CANONICAL_FIELDS = Object.freeze({
  date: field("date", "TIME", "날짜", "Date", { valueType: "date", unitFamily: "date", aggregation: "none", cardinalityHint: "one", validationRules: ["utc_date"] }),
  week: field("week", "TIME", "주차", "Week", { valueType: "date", unitFamily: "week", aggregation: "none", cardinalityHint: "one", validationRules: ["week_or_date"] }),
  snapshot_date: field("snapshot_date", "TIME", "추출 기준일", "Snapshot date", { valueType: "date", unitFamily: "date", aggregation: "none", cardinalityHint: "one" }),
  cohort_date: field("cohort_date", "TIME", "코호트 시작일", "Cohort date", { valueType: "date", unitFamily: "date", aggregation: "none", cardinalityHint: "one" }),

  channel: field("channel", "DIMENSION", "채널", "Channel", { valueType: "string", unitFamily: "category", aggregation: "none", cardinalityHint: "low" }),
  campaign: field("campaign", "DIMENSION", "캠페인", "Campaign", { valueType: "string", unitFamily: "category", aggregation: "none", cardinalityHint: "many" }),
  ad_group: field("ad_group", "DIMENSION", "광고그룹", "Ad group", { valueType: "string", unitFamily: "category", aggregation: "none", cardinalityHint: "many" }),
  creative: field("creative", "DIMENSION", "소재", "Creative", { valueType: "string", unitFamily: "category", aggregation: "none", cardinalityHint: "many" }),
  country: field("country", "DIMENSION", "국가", "Country", { valueType: "string", unitFamily: "category", aggregation: "none", cardinalityHint: "low" }),
  platform: field("platform", "DIMENSION", "플랫폼", "Platform", { valueType: "string", unitFamily: "category", aggregation: "none", cardinalityHint: "low" }),
  paid_organic_source: field("paid_organic_source", "DIMENSION", "유료·오가닉 구분", "Paid or organic source", { valueType: "string", unitFamily: "category", aggregation: "none", cardinalityHint: "low" }),
  store_source: field("store_source", "DIMENSION", "스토어 유입 소스", "Store traffic source", { valueType: "string", unitFamily: "category", aggregation: "none", cardinalityHint: "low" }),

  media_spend: field("media_spend", "MEDIA", "광고 집행액", "Media spend", { unitFamily: "currency", repeatable: true }),
  media_impressions: field("media_impressions", "MEDIA", "노출수", "Media impressions", { repeatable: true }),
  media_clicks: field("media_clicks", "MEDIA", "클릭수", "Media clicks", { repeatable: true }),

  outcome_installs: field("outcome_installs", "OUTCOME", "설치수", "Installs", { repeatable: true }),
  outcome_signups: field("outcome_signups", "OUTCOME", "가입수", "Sign-ups", { repeatable: true }),
  outcome_purchases: field("outcome_purchases", "OUTCOME", "구매·결제수", "Purchases", { repeatable: true, windowSupport: true }),
  outcome_revenue: field("outcome_revenue", "OUTCOME", "매출", "Revenue", { unitFamily: "currency", repeatable: true, windowSupport: true }),
  outcome_retention: field("outcome_retention", "OUTCOME", "리텐션", "Retention", { unitFamily: "rate", aggregation: "weighted_mean", repeatable: true, windowSupport: true }),
  outcome_generic: field("outcome_generic", "OUTCOME", "구체화되지 않은 성과", "Unspecified outcome", { repeatable: true, validationRules: ["requires_user_outcome_confirmation"] }),
  store_product_page_views: field("store_product_page_views", "OUTCOME", "제품 페이지 조회", "Product page views", { repeatable: true }),

  control_promotion: field("control_promotion", "CONTROL", "프로모션 통제", "Promotion control", { unitFamily: "binary_or_index", repeatable: true }),
  control_holiday: field("control_holiday", "CONTROL", "휴일 통제", "Holiday control", { unitFamily: "binary_or_index", repeatable: true }),
  control_market_index: field("control_market_index", "CONTROL", "시장 수요 지수", "Market demand index", { unitFamily: "index", repeatable: true }),

  row_id: field("row_id", "IDENTIFIER", "행 식별자", "Row identifier", { valueType: "string", unitFamily: "identifier", aggregation: "none", cardinalityHint: "many", repeatable: true }),

  derived_ctr: field("derived_ctr", "DERIVED_METRIC", "CTR", "CTR", { unitFamily: "rate", aggregation: "weighted_mean", repeatable: true, derivedFormula: "media_clicks / media_impressions" }),
  derived_cpa: field("derived_cpa", "DERIVED_METRIC", "CPA", "CPA", { unitFamily: "currency", aggregation: "weighted_mean", repeatable: true, derivedFormula: "media_spend / outcome" }),
});

export const canonicalField = (key) => CANONICAL_FIELDS[key] || null;
