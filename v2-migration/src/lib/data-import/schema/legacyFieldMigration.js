import { STANDARD_FIELDS } from "@/utils/csvConstants";
import { CANONICAL_FIELDS } from "./canonicalFields";

const exact = (canonicalKey, options = {}) => ({ policy: "canonical", canonicalKey, ...options });
const windowed = (canonicalKey, value) => ({
  policy: "windowed_canonical",
  canonicalKey,
  window: { kind: "cohort_day", value },
});

// V1 키 중 V2에서 같은 의미로 합쳐지는 것만 명시한다. 나머지는 이번 기준선에서
// 억지로 역할을 만들지 않고 legacy_passthrough로 보존한다.
export const LEGACY_FIELD_MIGRATIONS = Object.freeze({
  date: exact("date"),
  week: exact("week"),
  snapshot_date: exact("snapshot_date"),
  cohort_date: exact("cohort_date"),
  channel: exact("channel"),
  campaign_name: exact("campaign", { memberHint: "name" }),
  campaign_id: exact("campaign", { memberHint: "id" }),
  adgroup_name: exact("ad_group"),
  creative_id: exact("creative", { memberHint: "id" }),
  country: exact("country"),
  platform: exact("platform"),
  source: exact("paid_organic_source"),
  store_source: exact("store_source"),
  cost: exact("media_spend"),
  spend: exact("media_spend"),
  impressions: exact("media_impressions"),
  clicks: exact("media_clicks"),
  installs: exact("outcome_installs"),
  actions: exact("outcome_generic", { requiresConfirmation: true }),
  paid_regs: exact("outcome_registrations", { memberHint: "paid" }),
  organic_regs: exact("outcome_registrations", { memberHint: "organic" }),
  brand_search: exact("outcome_brand_searches"),
  direct_traffic: exact("outcome_direct_traffic"),
  campaign_on: exact("control_campaign_active"),
  arm_id: exact("experiment_arm"),
  experiment_id: exact("experiment_id"),
  metric_name: exact("experiment_metric"),
  metric_tier: exact("experiment_metric", { memberHint: "tier" }),
  numerator: exact("experiment_numerator"),
  denominator: exact("experiment_denominator"),
  is_control: exact("experiment_arm", { memberHint: "control_flag" }),
  cohort_size: exact("cohort_size"),
  day_offset: exact("cohort_day_offset"),
  cohort_revenue: exact("outcome_revenue"),
  holdout_group: exact("holdout_group"),
  search_term: exact("asa_search_term"),
  mmm_reg: exact("outcome_registrations"),
  mmm_react: exact("outcome_reactivations"),
  ch_google_roi: exact("media_spend", { memberHint: "google_roi" }),
  ch_google_cbua: exact("media_spend", { memberHint: "google_cbua" }),
  ch_meta: exact("media_spend", { memberHint: "meta" }),
  ch_tiktok: exact("media_spend", { memberHint: "tiktok" }),
  ch_brand: exact("media_spend", { memberHint: "brand" }),
  product_page_views: exact("store_product_page_views"),
  revenue_d0: windowed("outcome_revenue", 0),
  revenue_d7: windowed("outcome_revenue", 7),
  revenue_d14: windowed("outcome_revenue", 14),
  revenue_d30: windowed("outcome_revenue", 30),
  revenue_d90: windowed("outcome_revenue", 90),
  revenue_d180: windowed("outcome_revenue", 180),
  revenue_d360: windowed("outcome_revenue", 360),
  pu_d7: windowed("outcome_purchases", 7),
  retained_users: exact("outcome_retention", { representation: "count" }),
  ret_d7: windowed("outcome_retention", 7),
});

export const LEGACY_MIGRATION_POLICIES = new Set([
  "canonical", "windowed_canonical", "legacy_passthrough",
]);

export function legacyFieldMigrationFor(legacyKey) {
  const migration = LEGACY_FIELD_MIGRATIONS[legacyKey];
  if (migration) return { legacyKey, ...migration };
  // 현재 엔진이 쓰는 독자 역할은 V2 role을 추측하지 않는다. 다음 migration PR에서
  // 해당 도구의 실제 소비 경로와 함께 명시적으로 승격한다.
  return { legacyKey, policy: "legacy_passthrough", canonicalKey: null };
}

export function canonicalFieldForLegacyKey(legacyKey) {
  const migration = legacyFieldMigrationFor(legacyKey);
  return migration.canonicalKey && CANONICAL_FIELDS[migration.canonicalKey] ? migration : null;
}

// 기준선 정합성 테스트와 인벤토리가 동일한 V1 키 집합을 보도록 파생한다.
export const LEGACY_STANDARD_FIELD_KEYS = Object.freeze(Object.keys(STANDARD_FIELDS));
