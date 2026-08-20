import { canonicalFieldForLegacyKey } from "../schema/legacyFieldMigration";

const SIGNALS = {
  date: ["date", "날짜", "일자"], week: ["week", "주차"], channel: ["channel", "network", "media", "채널", "매체"], campaign: ["campaign", "캠페인"], ad_group: ["adgroup", "ad group", "광고그룹"], creative: ["creative", "ad name", "소재", "광고소재"], country: ["country", "국가"], platform: ["platform", "os", "플랫폼"], paid_organic_source: ["paid organic", "organic paid", "광고구분", "유입구분"], store_source: ["source type", "traffic source", "유입소스", "소스유형"], media_spend: ["spend", "cost", "expense", "amount spent", "광고비", "비용", "소진액", "집행액"], media_impressions: ["impressions", "impression", "노출"], media_clicks: ["clicks", "click", "taps", "tap", "클릭"], outcome_installs: ["installs", "install", "downloads", "설치"], outcome_signups: ["signups", "signup", "registrations", "가입"], outcome_purchases: ["purchases", "purchase", "payments", "결제", "구매"], outcome_revenue: ["revenue", "sales", "매출"], outcome_retention: ["retention", "retained", "리텐션", "잔존"], store_product_page_views: ["product page views", "page views", "제품 페이지 조회"],
};
const compact = (value) => String(value || "").toLowerCase().replace(/[\s_-]/g, "");
export function scoreNameFeatures(profile, canonicalKey) {
  const normalized = profile?.headerFeatures?.normalized || "";
  const legacy = canonicalFieldForLegacyKey(compact(normalized));
  if (legacy?.canonicalKey === canonicalKey) return { score: 0.9, evidence: ["EXACT_LEGACY_KEY"] };
  const signal = (SIGNALS[canonicalKey] || []).find((item) => {
    const candidate = compact(item); const header = compact(normalized);
    return candidate.length >= 3 && (header === candidate || header.includes(candidate));
  });
  return signal ? { score: 0.58, evidence: ["NAME_SEED_SIGNAL"] } : { score: 0, evidence: [] };
}
