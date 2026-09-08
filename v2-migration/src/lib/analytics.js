// 분석 이벤트에는 CSV 값·파일명·채널명 등 사용자 데이터를 절대 싣지 않는다.
// GA4 탐색에서 미리 정의된 범주형/집계형 파라미터만 쓴다.

const ALLOWED_PARAMS = new Set([
  "tool_id", "source", "column_count", "row_count", "mapped_count", "confidence_bucket",
  "conflict_count", "missing_required_count", "tab_name", "download_type", "analysis_type",
  "result_state", "locale", "placement", "content_slug", "content_type",
  "source_tool_id", "data_continuity", "rank",
  "section_id", "state", "days_since_decision", "elapsed_bucket",
  // 크래시 계측 — 오류 메시지·스택은 원자료가 섞일 수 있어 절대 싣지 않고,
  // 범주형(scope=site|analysis, state=오류 타입, section_id=digest)만 보낸다.
  "scope",
]);

let firstToolViewAt = null;
let hasRecordedFirstActivation = false;

const EDITORIAL_JOURNEY_KEY = "gop:editorial-journey";
const EDITORIAL_JOURNEY_TTL = 30 * 60 * 1000;
const EDITORIAL_FUNNEL_EVENTS = new Set([
  "data_import_start", "data_import_success", "data_import_failed",
  "data_profile_completed", "mapping_confirmed", "analysis_started", "analysis_completed",
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
        && /^[59]-\d+(?:-[a-z-]+)?$/.test(params.tool_id || "")) {
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

export function sanitizeProductEventParams(params = {}) {
  return Object.fromEntries(Object.entries(params)
    .filter(([key, value]) => ALLOWED_PARAMS.has(key) && value != null)
    .map(([key, value]) => [key, key === "tool_id" ? normalizeProductToolId(value) : value]));
}

export function trackProductEvent(name, params = {}) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return false;
  params = withEditorialJourney(name, params);
  if (name === "tool_view" && firstToolViewAt == null) firstToolViewAt = Date.now();
  const isFirstReadyActivation = name === "analysis_completed"
    && firstToolViewAt != null
    && !hasRecordedFirstActivation
    && params.source !== "demo"
    && params.result_state === "ready";
  const enriched = isFirstReadyActivation
    ? { ...params, elapsed_bucket: productElapsedBucket(Date.now() - firstToolViewAt) }
    : params;
  window.gtag("event", name, sanitizeProductEventParams(enriched));
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
