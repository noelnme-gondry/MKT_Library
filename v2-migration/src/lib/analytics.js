// 분석 이벤트에는 CSV 값·파일명·채널명 등 사용자 데이터를 절대 싣지 않는다.
// GA4 탐색에서 미리 정의된 범주형/집계형 파라미터만 쓴다.
import { PAYMENT_PRODUCT } from "./subscription/paymentProduct";
import { journeySurface, withSiteJourney } from "./siteJourney";
import { GA_MEASUREMENT_ID, isAnalyticsHost } from "./analyticsHost";

const ALLOWED_PARAMS = new Set([
  "tool_id", "source", "column_count", "row_count", "mapped_count", "confidence_bucket",
  "conflict_count", "missing_required_count", "tab_name", "download_type", "analysis_type",
  "result_state", "locale", "placement", "content_slug", "content_type",
  "source_tool_id", "data_continuity", "rank",
  "section_id", "state", "days_since_decision", "elapsed_bucket",
  // 크래시 계측 — 오류 메시지·스택은 원자료가 섞일 수 있어 절대 싣지 않고,
  // 범주형(scope=site|analysis, state=오류 타입, section_id=digest)만 보낸다.
  "scope",
  "journey_entry", "visit_type",
  "gate_reason", "trial_remaining_bucket",
]);

let weeklyImportStartedAt = null;
let firstToolViewAt = null;
let hasRecordedFirstActivation = false;

const EDITORIAL_JOURNEY_KEY = "gop:editorial-journey";
const EDITORIAL_JOURNEY_TTL = 30 * 60 * 1000;
const EDITORIAL_FUNNEL_EVENTS = new Set([
  "data_import_start", "data_import_success", "data_import_failed",
  "data_profile_completed", "mapping_confirmed", "analysis_started", "analysis_completed", "analysis_blocked",
  "weekly_review_viewed", "weekly_review_completed", "weekly_review_blocked",
  "weekly_decision_saved", "weekly_review_export",
]);

// 공개 글 식별자만 저장한다. 도구 ID는 정규화 전에 비교하여 MMM과 추세를
// 같은 방문으로 오인하지 않는다. 저장소 차단은 분석 실행에 영향을 주지 않는다.
function withEditorialJourney(name, params) {
  try {
    const storage = window.sessionStorage;
    if (!storage) return params;
    if (name === "blog_tool_cta_clicked") {
      storage.removeItem(EDITORIAL_JOURNEY_KEY);
      if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(params.content_slug || "")
        && ["blog", "glossary"].includes(params.content_type)
        && ["ko", "en"].includes(params.locale)
        && (params.tool_id === "weekly-review" || /^[59]-\d+(?:-[a-z-]+)?$/.test(params.tool_id || ""))) {
        storage.setItem(EDITORIAL_JOURNEY_KEY, JSON.stringify({
          content_slug: params.content_slug, content_type: params.content_type,
          locale: params.locale, tool_id: params.tool_id, createdAt: Date.now(),
        }));
      }
    } else if (EDITORIAL_FUNNEL_EVENTS.has(name) && params.source !== "demo") {
      const stored = storage.getItem(EDITORIAL_JOURNEY_KEY);
      if (!stored) return params;
      const journey = JSON.parse(stored);
      const age = Date.now() - journey.createdAt;
      if (!Number.isFinite(age) || age < 0 || age > EDITORIAL_JOURNEY_TTL) {
        storage.removeItem(EDITORIAL_JOURNEY_KEY);
      } else if (journey.tool_id === params.tool_id && journey.locale === params.locale) {
        return { ...params, content_slug: journey.content_slug, content_type: journey.content_type };
      }
    }
  } catch { /* 저장소 없이도 기존 집계 이벤트는 유지한다. */ }
  return params;
}

export function productElapsedBucket(elapsedMs) {
  const seconds = Math.max(0, Number(elapsedMs) || 0) / 1000;
  if (seconds < 60) return "under_1m";
  if (seconds < 180) return "1_3m";
  if (seconds < 600) return "3_10m";
  return "10m_plus";
}

// 한 화면에서 Strict Mode 재실행·도구 재마운트가 일어나도 같은 퍼널 사건을
// 중복 전송하지 않는다. 키 입력은 즉시 비식별 해시로 바꾸고 해시만 보관한다.
// CSV 값·파일명·헤더는 이벤트 payload로 보내지 않는다. 새로고침하면 비워지는
// 세션 메모리라 사용자 데이터도 브라우저 저장소에 남지 않는다.
const SENT_ONCE_KEYS = new Set();

const ANALYSIS_TYPE_BY_TOOL = {
  "5-2": "dashboard",
  "5-3": "budget_allocation",
  "5-4": "experiment",
  "5-6": "creative",
  "5-18": "marketing_response",
  "5-20": "aha",
  "5-21": "pvm",
  "5-22": "saturation",
  "5-23": "incrementality",
  "5-24": "brand_incrementality",
  "5-25": "multicollinearity",
  "5-26": "asa_keyword",
  "9-1": "content_elements",
  "9-2": "content_aha",
  "9-3": "pvm",
  "9-6": "creative",
  "9-7": "content_dashboard",
};

export function normalizeProductToolId(toolId) {
  const id = String(toolId || "");
  return /^5-18-(paid-organic|trend|cannibal|mmm|forecast)$/.test(id) ? "5-18" : id;
}

export function productAnalysisType(toolId) {
  return ANALYSIS_TYPE_BY_TOOL[normalizeProductToolId(toolId)] || "analysis";
}

export function sanitizeProductEventParams(params = {}, name) {
  const safe = Object.fromEntries(Object.entries(params)
    .filter(([key, value]) => ALLOWED_PARAMS.has(key) && value != null)
    .map(([key, value]) => [key, key === "tool_id" ? normalizeProductToolId(value) : value]));
  if (safe.gate_reason && !["price", "identity", "trust", "refund", "later"].includes(safe.gate_reason)) delete safe.gate_reason;
  if (safe.trial_remaining_bucket && !["not_started", "expired", "under_3d", "3_7d", "8_14d"].includes(safe.trial_remaining_bucket)) delete safe.trial_remaining_bucket;
  if (["begin_checkout", "purchase", "test_begin_checkout", "test_purchase"].includes(name)
    && params.currency === "KRW" && Number.isSafeInteger(params.value) && params.value > 0
    && params.items?.length === 1 && params.items[0].item_id === PAYMENT_PRODUCT.id) {
    Object.assign(safe, { currency: "KRW", value: params.value, items: [{ item_id: params.items[0].item_id, price: params.value, quantity: 1 }] });
    if (/^gop_[a-f0-9-]{36}$/.test(params.transaction_id || "")) safe.transaction_id = params.transaction_id;
  }
  return safe;
}

export function trackProductEvent(name, params = {}) {
  if (typeof window === "undefined") return false;
  // 운영 호스트에서 GA 스크립트보다 먼저 마운트된 화면의 이벤트도 표준 큐에 넣는다.
  // 로컬·미리보기는 여전히 no-op. 광고 차단기를 우회하는 별도 전송은 하지 않는다.
  if (typeof window.gtag !== "function" && isAnalyticsHost(window.location?.hostname)) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };
  }
  if (typeof window.gtag !== "function") return false;
  try {
    if (window.sessionStorage) {
      if (isAnalyticsHost(window.location?.hostname) || name === "landing_data_start_clicked") withSiteJourney("journey_page_viewed", { scope: journeySurface(window.location?.pathname) }, window.sessionStorage);
      params = withSiteJourney(name, params, window.sessionStorage);
    }
  } catch { /* 저장소 차단 시 기본 계측만 */ }
  params = withEditorialJourney(name, params);
  if (name === "data_import_start" && params.source !== "demo") weeklyImportStartedAt = Date.now();
  if (params.tool_id === "weekly-review") {
    if (name === "weekly_review_completed" && params.source !== "demo" && weeklyImportStartedAt != null) {
      params = { ...params, elapsed_bucket: productElapsedBucket(Date.now() - weeklyImportStartedAt) };
      weeklyImportStartedAt = null;
    }
  }
  if (["tool_view", "dochi_mapping_confirmed"].includes(name) && firstToolViewAt == null) firstToolViewAt = Date.now();
  const isFirstReadyActivation = name === "analysis_completed"
    && firstToolViewAt != null
    && !hasRecordedFirstActivation
    && params.source !== "demo"
    && params.result_state === "ready";
  const enriched = isFirstReadyActivation
    ? { ...params, elapsed_bucket: productElapsedBucket(Date.now() - firstToolViewAt) }
    : params;
  // 동의 기본값 스크립트가 큐만 먼저 만든 경우에도 config 이전 목적지를 명시한다.
  const safeParams = sanitizeProductEventParams(enriched, name);
  if (isAnalyticsHost(window.location?.hostname)) safeParams.send_to = GA_MEASUREMENT_ID;
  window.gtag("event", name, safeParams);
  if (isFirstReadyActivation) hasRecordedFirstActivation = true;
  return true;
}

export function productEventKey(...parts) {
  const input = parts.map((part) => String(part ?? "")).join("|");
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function analysisResultEventKey(toolId, analysisType, inputSignature = "", analysisKey = "", locale = "ko") {
  return productEventKey(normalizeProductToolId(toolId), analysisType, inputSignature, analysisKey, locale);
}

export function trackProductEventOnce(name, dedupeKey, params = {}) {
  const key = `${name}:${String(dedupeKey || "default")}`;
  if (SENT_ONCE_KEYS.has(key)) return false;
  const sent = trackProductEvent(name, params);
  if (sent) SENT_ONCE_KEYS.add(key);
  return sent;
}
