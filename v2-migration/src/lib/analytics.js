// 분석 이벤트에는 CSV 값·파일명·채널명 등 사용자 데이터를 절대 싣지 않는다.
// GA4 탐색에서 미리 정의된 범주형/집계형 파라미터만 쓴다.

const ALLOWED_PARAMS = new Set([
  "tool_id", "source", "column_count", "row_count", "mapped_count", "confidence_bucket",
  "conflict_count", "missing_required_count", "tab_name", "download_type", "analysis_type",
  "result_state", "locale", "placement", "content_slug", "content_type",
  "source_tool_id", "data_continuity", "rank",
  "section_id", "state", "days_since_decision",
]);

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
  "9-1": "content_elements",
  "9-2": "content_aha",
  "9-3": "pvm",
  "9-6": "creative",
  "9-7": "content_dashboard",
};

export function normalizeProductToolId(toolId) {
  const id = String(toolId || "");
  return /^5-18-(trend|cannibal|mmm|forecast)$/.test(id) ? "5-18" : id;
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
  window.gtag("event", name, sanitizeProductEventParams(params));
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
