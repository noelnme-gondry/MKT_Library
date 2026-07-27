// 분석 이벤트에는 CSV 값·파일명·채널명 등 사용자 데이터를 절대 싣지 않는다.
// GA4 탐색에서 미리 정의된 범주형/집계형 파라미터만 쓴다.
const ALLOWED_PARAMS = new Set([
  "tool_id", "source", "column_count", "row_count", "mapped_count", "confidence_bucket",
  "conflict_count", "missing_required_count", "tab_name", "download_type", "analysis_type",
  "result_state", "locale", "placement", "content_slug", "content_type",
  "source_tool_id", "data_continuity", "rank",
]);

export function sanitizeProductEventParams(params = {}) {
  return Object.fromEntries(Object.entries(params).filter(([key, value]) => ALLOWED_PARAMS.has(key) && value != null));
}

export function trackProductEvent(name, params = {}) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", name, sanitizeProductEventParams(params));
}
