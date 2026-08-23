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
  // SUGGEST는 항상 사용자 검토 대상이지만, 이 표시는 특히 열 이름·값만으로
  // 분석 의미를 확정할 수 없는 역할을 downstream 계약에도 남긴다.
  requiresConfirmation: Boolean(options.requiresConfirmation),
  semanticGroup: options.semanticGroup || null,
});

export const CANONICAL_FIELD_FAMILIES = new Set([
  "TIME", "DIMENSION", "MEDIA", "OUTCOME", "CONTROL", "IDENTIFIER", "FEATURE", "DERIVED_METRIC",
]);

export const CANONICAL_FIELDS = Object.freeze({
  date: field("date", "TIME", "날짜", "Date", { valueType: "date", unitFamily: "date", aggregation: "none", cardinalityHint: "one", validationRules: ["utc_date"] }),
  week: field("week", "TIME", "주차", "Week", { valueType: "date", unitFamily: "week", aggregation: "none", cardinalityHint: "one", validationRules: ["week_or_date"] }),
  snapshot_date: field("snapshot_date", "TIME", "추출 기준일", "Snapshot date", { valueType: "date", unitFamily: "date", aggregation: "none", cardinalityHint: "one" }),
  cohort_date: field("cohort_date", "TIME", "코호트 시작일", "Cohort date", { valueType: "date", unitFamily: "date", aggregation: "none", cardinalityHint: "one" }),
  // 원본 CSV 열이 아니라 개입 분석 화면에서 사용자가 선언하는 기준일이다.
  intervention_cutoff: field("intervention_cutoff", "TIME", "개입 기준일", "Intervention cutoff date", { valueType: "date", unitFamily: "date", aggregation: "none", cardinalityHint: "one", requiresConfirmation: true }),

  channel: field("channel", "DIMENSION", "채널", "Channel", { valueType: "string", unitFamily: "category", aggregation: "none", cardinalityHint: "low" }),
  campaign: field("campaign", "DIMENSION", "캠페인", "Campaign", { valueType: "string", unitFamily: "category", aggregation: "none", cardinalityHint: "many" }),
  ad_group: field("ad_group", "DIMENSION", "광고그룹", "Ad group", { valueType: "string", unitFamily: "category", aggregation: "none", cardinalityHint: "many" }),
  creative: field("creative", "DIMENSION", "소재", "Creative", { valueType: "string", unitFamily: "category", aggregation: "none", cardinalityHint: "many" }),
  country: field("country", "DIMENSION", "국가", "Country", { valueType: "string", unitFamily: "category", aggregation: "none", cardinalityHint: "low" }),
  platform: field("platform", "DIMENSION", "플랫폼", "Platform", { valueType: "string", unitFamily: "category", aggregation: "none", cardinalityHint: "low" }),
  paid_organic_source: field("paid_organic_source", "DIMENSION", "유료·오가닉 구분", "Paid or organic source", { valueType: "string", unitFamily: "category", aggregation: "none", cardinalityHint: "low" }),
  store_source: field("store_source", "DIMENSION", "스토어 유입 소스", "Store traffic source", { valueType: "string", unitFamily: "category", aggregation: "none", cardinalityHint: "low" }),
  creative_url: field("creative_url", "DIMENSION", "소재 링크", "Creative URL", { valueType: "string", unitFamily: "url", aggregation: "none", cardinalityHint: "many" }),
  asa_match_type: field("asa_match_type", "DIMENSION", "ASA 매치 타입", "ASA match type", { valueType: "string", unitFamily: "category", aggregation: "none", cardinalityHint: "low" }),
  event_annotation: field("event_annotation", "DIMENSION", "운영 이벤트 메모", "Operational event annotation", { valueType: "string", unitFamily: "text", aggregation: "none", cardinalityHint: "many" }),
  event_type: field("event_type", "DIMENSION", "운영 이벤트 종류", "Operational event type", { valueType: "string", unitFamily: "category", aggregation: "none", cardinalityHint: "low" }),
  subscription_plan: field("subscription_plan", "DIMENSION", "구독 플랜", "Subscription plan", { valueType: "string", unitFamily: "category", aggregation: "none", cardinalityHint: "low" }),
  creative_audience_segment: field("creative_audience_segment", "DIMENSION", "소재 오디언스", "Creative audience", { valueType: "string", unitFamily: "category", aggregation: "none", cardinalityHint: "many", semanticGroup: "creative_attribute" }),
  creative_hook_type: field("creative_hook_type", "DIMENSION", "소재 Hook 유형", "Creative hook type", { valueType: "string", unitFamily: "category", aggregation: "none", cardinalityHint: "many", semanticGroup: "creative_attribute" }),
  creative_message_angle: field("creative_message_angle", "DIMENSION", "소재 메시지 앵글", "Creative message angle", { valueType: "string", unitFamily: "category", aggregation: "none", cardinalityHint: "many", semanticGroup: "creative_attribute" }),
  creative_first_3s: field("creative_first_3s", "DIMENSION", "소재 첫 3초 컨셉", "Creative first-three-seconds concept", { valueType: "string", unitFamily: "category", aggregation: "none", cardinalityHint: "many", semanticGroup: "creative_attribute" }),
  creative_format: field("creative_format", "DIMENSION", "소재 포맷", "Creative format", { valueType: "string", unitFamily: "category", aggregation: "none", cardinalityHint: "many", semanticGroup: "creative_attribute" }),
  creative_text_overlay: field("creative_text_overlay", "DIMENSION", "소재 텍스트 오버레이", "Creative text overlay", { valueType: "string", unitFamily: "binary_or_category", aggregation: "none", cardinalityHint: "low", semanticGroup: "creative_attribute" }),
  creative_cta_style: field("creative_cta_style", "DIMENSION", "소재 CTA 스타일", "Creative CTA style", { valueType: "string", unitFamily: "category", aggregation: "none", cardinalityHint: "many", semanticGroup: "creative_attribute" }),
  creative_duration_bucket: field("creative_duration_bucket", "DIMENSION", "소재 길이대", "Creative duration bucket", { valueType: "string", unitFamily: "category", aggregation: "none", cardinalityHint: "low", semanticGroup: "creative_attribute" }),
  creative_duration_seconds: field("creative_duration_seconds", "FEATURE", "실제 영상 길이", "Video duration", { unitFamily: "seconds", aggregation: "none", cardinalityHint: "many", semanticGroup: "creative_numeric_feature" }),
  creative_text_length: field("creative_text_length", "FEATURE", "화면 텍스트 글자수", "On-screen text length", { unitFamily: "count", aggregation: "none", cardinalityHint: "many", semanticGroup: "creative_numeric_feature" }),
  creative_scene_cut_count: field("creative_scene_cut_count", "FEATURE", "장면 전환수", "Scene cut count", { unitFamily: "count", aggregation: "none", cardinalityHint: "many", semanticGroup: "creative_numeric_feature" }),
  creative_face_screen_ratio: field("creative_face_screen_ratio", "FEATURE", "인물 화면 비율", "Face screen ratio", { unitFamily: "rate", aggregation: "none", cardinalityHint: "many", semanticGroup: "creative_numeric_feature" }),
  creative_speech_rate: field("creative_speech_rate", "FEATURE", "말하기 속도", "Speech rate", { unitFamily: "rate", aggregation: "none", cardinalityHint: "many", semanticGroup: "creative_numeric_feature" }),

  media_spend: field("media_spend", "MEDIA", "광고 집행액", "Media spend", { unitFamily: "currency", repeatable: true }),
  media_daily_budget: field("media_daily_budget", "MEDIA", "일일 예산", "Daily media budget", { unitFamily: "currency", repeatable: true }),
  media_target_cpa: field("media_target_cpa", "MEDIA", "목표 CPA", "Target CPA", { unitFamily: "currency", repeatable: true }),
  media_target_cpt: field("media_target_cpt", "MEDIA", "목표 CPT", "Target CPT", { unitFamily: "currency", repeatable: true }),
  media_current_cpt: field("media_current_cpt", "MEDIA", "현재 CPT", "Current CPT", { unitFamily: "currency", repeatable: true }),
  media_impressions: field("media_impressions", "MEDIA", "노출수", "Media impressions", { repeatable: true }),
  media_clicks: field("media_clicks", "MEDIA", "클릭수", "Media clicks", { repeatable: true }),
  media_video_3s_views: field("media_video_3s_views", "MEDIA", "3초 영상 조회", "Three-second video views", { repeatable: true }),
  media_video_completions: field("media_video_completions", "MEDIA", "영상 완료", "Video completions", { repeatable: true }),

  outcome_installs: field("outcome_installs", "OUTCOME", "설치수", "Installs", { repeatable: true }),
  outcome_signups: field("outcome_signups", "OUTCOME", "가입수", "Sign-ups", { repeatable: true }),
  outcome_registrations: field("outcome_registrations", "OUTCOME", "가입·등록수", "Registrations", { repeatable: true }),
  outcome_reactivations: field("outcome_reactivations", "OUTCOME", "재활성화 수", "Reactivations", { repeatable: true }),
  outcome_brand_searches: field("outcome_brand_searches", "OUTCOME", "브랜드 검색량", "Brand searches", { repeatable: true }),
  outcome_direct_traffic: field("outcome_direct_traffic", "OUTCOME", "직접 유입", "Direct traffic", { repeatable: true }),
  outcome_purchases: field("outcome_purchases", "OUTCOME", "구매·결제수", "Purchases", { repeatable: true, windowSupport: true }),
  outcome_revenue: field("outcome_revenue", "OUTCOME", "매출", "Revenue", { unitFamily: "currency", repeatable: true, windowSupport: true }),
  outcome_retention: field("outcome_retention", "OUTCOME", "리텐션", "Retention", { unitFamily: "rate", aggregation: "weighted_mean", repeatable: true, windowSupport: true }),
  outcome_generic: field("outcome_generic", "OUTCOME", "구체화되지 않은 성과", "Unspecified outcome", { repeatable: true, validationRules: ["requires_user_outcome_confirmation"] }),
  store_product_page_views: field("store_product_page_views", "OUTCOME", "제품 페이지 조회", "Product page views", { repeatable: true }),
  // Legacy identifiers remain stable for V1/V2 migration compatibility. 5-28
  // uses them for any defined action-observation episode, not subscriptions alone.
  subscription_tenure: field("subscription_tenure", "OUTCOME", "생존 관측 기간", "Survival observation duration", { unitFamily: "period", aggregation: "none", cardinalityHint: "many" }),
  churn_event: field("churn_event", "OUTCOME", "이탈·종료 이벤트 관측", "Observed dropout or exit event", { unitFamily: "binary", aggregation: "sum", cardinalityHint: "low", validationRules: ["binary_values"] }),
  subscription_start_date: field("subscription_start_date", "TIME", "관측 시작일", "Observation start date", { valueType: "date", unitFamily: "date", aggregation: "none", cardinalityHint: "many", validationRules: ["utc_date"] }),
  subscription_churn_date: field("subscription_churn_date", "TIME", "이탈·종료 이벤트일", "Dropout or exit event date", { valueType: "date", unitFamily: "date", aggregation: "none", cardinalityHint: "many", validationRules: ["utc_date"] }),
  subscription_observation_end_date: field("subscription_observation_end_date", "TIME", "관측 종료일", "Observation end date", { valueType: "date", unitFamily: "date", aggregation: "none", cardinalityHint: "one", validationRules: ["utc_date"] }),
  subscription_entry: field("subscription_entry", "TIME", "관측 진입 기간", "Observation entry period", { unitFamily: "period", aggregation: "none", cardinalityHint: "many" }),
  customer_acquisition_cost: field("customer_acquisition_cost", "MEDIA", "개체 획득·유지비", "Entity acquisition or maintenance cost", { unitFamily: "currency", aggregation: "none", cardinalityHint: "many" }),

  control_promotion: field("control_promotion", "CONTROL", "프로모션 통제", "Promotion control", { unitFamily: "binary_or_index", repeatable: true }),
  control_holiday: field("control_holiday", "CONTROL", "휴일 통제", "Holiday control", { unitFamily: "binary_or_index", repeatable: true }),
  control_market_index: field("control_market_index", "CONTROL", "시장 수요 지수", "Market demand index", { unitFamily: "index", repeatable: true }),
  control_campaign_active: field("control_campaign_active", "CONTROL", "캠페인 집행 여부", "Campaign active", { unitFamily: "binary_or_index", repeatable: true }),
  intervention_group: field("intervention_group", "IDENTIFIER", "개입 처리·대조 그룹", "Intervention treatment or control group", { valueType: "string", unitFamily: "identifier", aggregation: "none", cardinalityHint: "low", requiresConfirmation: true }),

  experiment_arm: field("experiment_arm", "IDENTIFIER", "실험군", "Experiment arm", { valueType: "string", unitFamily: "identifier", aggregation: "none", cardinalityHint: "low" }),
  experiment_id: field("experiment_id", "IDENTIFIER", "실험 식별자", "Experiment identifier", { valueType: "string", unitFamily: "identifier", aggregation: "none", cardinalityHint: "many" }),
  experiment_metric: field("experiment_metric", "IDENTIFIER", "실험 지표", "Experiment metric", { valueType: "string", unitFamily: "identifier", aggregation: "none", cardinalityHint: "many" }),
  experiment_numerator: field("experiment_numerator", "OUTCOME", "실험 분자", "Experiment numerator", { repeatable: true }),
  experiment_denominator: field("experiment_denominator", "OUTCOME", "실험 분모", "Experiment denominator", { repeatable: true }),
  cohort_size: field("cohort_size", "IDENTIFIER", "코호트 규모", "Cohort size", { valueType: "number", unitFamily: "count", aggregation: "sum" }),
  cohort_day_offset: field("cohort_day_offset", "TIME", "코호트 경과일", "Cohort day offset", { valueType: "number", unitFamily: "day", aggregation: "none", cardinalityHint: "low" }),
  holdout_group: field("holdout_group", "IDENTIFIER", "홀드아웃 그룹", "Holdout group", { valueType: "string", unitFamily: "identifier", aggregation: "none", cardinalityHint: "low" }),
  asa_search_term: field("asa_search_term", "DIMENSION", "ASA 검색어", "ASA search term", { valueType: "string", unitFamily: "category", aggregation: "none", cardinalityHint: "many" }),
  user_id: field("user_id", "IDENTIFIER", "사용자 식별자", "User identifier", { valueType: "string", unitFamily: "identifier", aggregation: "none", cardinalityHint: "many", requiresConfirmation: true }),
  content_id: field("content_id", "IDENTIFIER", "콘텐츠 식별자", "Content identifier", { valueType: "string", unitFamily: "identifier", aggregation: "none", cardinalityHint: "many", requiresConfirmation: true }),

  row_id: field("row_id", "IDENTIFIER", "행 식별자", "Row identifier", { valueType: "string", unitFamily: "identifier", aggregation: "none", cardinalityHint: "many", repeatable: true }),

  outcome_binary: field("outcome_binary", "OUTCOME", "0/1 성과", "Binary outcome", { repeatable: true, requiresConfirmation: true, validationRules: ["binary_values", "both_classes_required"] }),
  outcome_numeric: field("outcome_numeric", "OUTCOME", "사용자 지정 수치 성과", "User-selected numeric outcome", { repeatable: true, requiresConfirmation: true }),
  numeric_feature: field("numeric_feature", "FEATURE", "반복 수치 특성", "Repeatable numeric feature", { repeatable: true, requiresConfirmation: true, semanticGroup: "tool_owned_feature" }),

  derived_ctr: field("derived_ctr", "DERIVED_METRIC", "CTR", "CTR", { unitFamily: "rate", aggregation: "weighted_mean", repeatable: true, derivedFormula: "media_clicks / media_impressions" }),
  derived_cpa: field("derived_cpa", "DERIVED_METRIC", "CPA", "CPA", { unitFamily: "currency", aggregation: "weighted_mean", repeatable: true, derivedFormula: "media_spend / outcome" }),
});

export const canonicalField = (key) => CANONICAL_FIELDS[key] || null;
