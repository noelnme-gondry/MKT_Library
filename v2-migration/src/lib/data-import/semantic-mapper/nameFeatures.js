import { canonicalFieldForLegacyKey } from "../schema/legacyFieldMigration";
import { LEGACY_ALIAS_SIGNALS, normalizeAliasSignal } from "../schema/legacyAliasSignals";
import { CANONICAL_FIELDS } from "../schema/canonicalFields";

const SIGNALS = {
  date: ["date", "날짜", "일자"], week: ["week", "주차"], channel: ["channel", "network", "media", "채널", "매체"], campaign: ["campaign", "캠페인"], ad_group: ["adgroup", "ad group", "광고그룹"], creative: ["creative", "ad name", "소재", "광고소재"], country: ["country", "국가"], platform: ["platform", "os", "플랫폼"], paid_organic_source: ["paid organic", "organic paid", "광고구분", "유입구분"], store_source: ["source type", "traffic source", "유입소스", "소스유형"], media_spend: ["spend", "cost", "expense", "amount spent", "광고비", "비용", "소진액", "집행액"], media_impressions: ["impressions", "impression", "노출"], media_clicks: ["clicks", "click", "taps", "tap", "클릭"], outcome_installs: ["installs", "install", "downloads", "설치"], outcome_signups: ["signups", "signup", "registrations", "가입"], outcome_purchases: ["purchases", "purchase", "payments", "결제", "구매"], outcome_revenue: ["revenue", "sales", "매출"], outcome_retention: ["retention", "retained", "리텐션", "잔존"], store_product_page_views: ["product page views", "page views", "제품 페이지 조회"], user_id: ["user id", "customer id", "member id", "사용자 id", "유저 id", "회원 id"], content_id: ["content id", "post id", "article id", "콘텐츠 id", "게시물 id"], outcome_binary: ["converted", "conversion flag", "retained", "subscribed", "전환여부", "잔존여부", "구독여부"],
};
const compact = (value) => String(value || "").toLowerCase().replace(/[\s_-]/g, "");
export function scoreNameFeatures(profile, canonicalKey) {
  const normalized = profile?.headerFeatures?.normalized || "";
  const legacy = canonicalFieldForLegacyKey(compact(normalized));
  if (legacy?.canonicalKey === canonicalKey) return { score: 0.9, evidence: ["EXACT_LEGACY_KEY"] };
  const exactAlias = LEGACY_ALIAS_SIGNALS.some((signal) => signal.canonicalKey === canonicalKey && signal.normalizedAlias === normalizeAliasSignal(normalized));
  if (exactAlias) return { score: 0.82, evidence: ["EXACT_LEGACY_ALIAS"] };
  const signal = (SIGNALS[canonicalKey] || []).find((item) => {
    const candidate = compact(item); const header = compact(normalized);
    return candidate.length >= 3 && (header === candidate || header.includes(candidate));
  });
  // tool-owned 성과·식별자는 이름 신호만으로 SUGGEST할 뿐 자동 확정하지 않는다.
  // ID처럼 숫자가 섞인 값도 이름 신호가 임계값을 넘도록 하되, requiresConfirmation
  // 메타데이터가 후속 선택·실행 경로에서 반드시 확인을 요구한다.
  if (!signal) return { score: 0, evidence: [] };
  return { score: CANONICAL_FIELDS[canonicalKey]?.requiresConfirmation ? 0.6 : 0.58, evidence: ["NAME_SEED_SIGNAL"] };
}
