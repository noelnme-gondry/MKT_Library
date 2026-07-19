const ALLOWED_PARAMS = new Set(["tool_id", "source", "column_count", "row_count", "mapped_count", "confidence_bucket", "conflict_count", "missing_required_count"]);

export function trackProductEvent(name, params = {}) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  const safeParams = Object.fromEntries(Object.entries(params).filter(([key, value]) => ALLOWED_PARAMS.has(key) && value != null));
  window.gtag("event", name, safeParams);
}
