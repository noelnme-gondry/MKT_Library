// Small device-only record of what the user saw. Raw rows and file metadata are never accepted.
export const REVIEW_SCOPE_LABELS = Object.freeze({
  start: ["시작", "Start"], end: ["종료", "End"], channel: ["채널", "Channel"], campaign: ["캠페인", "Campaign"],
  dateStart: ["분석 시작일", "Analysis start"], dateEnd: ["분석 종료일", "Analysis end"],
  comparisonStart: ["비교 시작일", "Comparison start"], comparisonEnd: ["비교 종료일", "Comparison end"],
  previous: ["이전 기간", "Previous period"], current: ["현재 기간", "Current period"],
  currency: ["통화", "Currency"], denomBasis: ["전환 기준", "Conversion basis"], metric: ["지표", "Metric"],
  platforms: ["플랫폼", "Platforms"], countries: ["국가", "Countries"], channels: ["채널", "Channels"], sources: ["유입 구분", "Sources"],
});
const text = (value, limit = 500) => ["string", "number"].includes(typeof value) ? String(value).trim().slice(0, limit) : "";
export function buildReviewEvidence(input = {}) {
  if (!input || typeof input !== "object") return null;
  const summary = input.summary || input;
  const headline = text(summary.headline);
  if (!headline) return null;
  return {
    version: 1, capturedAt: text(input.capturedAt, 40), headline,
    analysisType: text(input.analysisType, 80), resultState: text(input.resultState, 40),
    stats: (Array.isArray(summary.stats) ? summary.stats : []).slice(0, 8).map(stat => ({ label: text(stat?.label, 100), value: text(stat?.value, 160), detail: text(stat?.detail, 200) })).filter(stat => stat.label && stat.value),
    points: (Array.isArray(summary.points) ? summary.points : []).slice(0, 8).map(point => ({ label: text(point?.label, 100), text: text(point?.text, 400), detail: text(point?.detail, 200) })).filter(point => point.text || point.detail),
    scope: Object.fromEntries(Object.entries(input.scope || {}).filter(([key]) => Object.hasOwn(REVIEW_SCOPE_LABELS, key)).map(([key, value]) => [key, Array.isArray(value) ? value.slice(0, 12).map(item => text(item, 80)).filter(Boolean).join(", ").slice(0, 160) : text(value, 160)]).filter(([, value]) => value)),
  };
}
export function serializeReviewEvidence(value) {
  const safe = typeof value === "string" ? readReviewEvidence(value) : buildReviewEvidence(value);
  return safe ? JSON.stringify(safe) : "";
}
export function readReviewEvidence(value) {
  if (typeof value !== "string" || value.length > 16000) return null;
  try { const parsed = JSON.parse(value); return parsed?.version === 1 ? buildReviewEvidence(parsed) : null; } catch { return null; }
}
export function reviewScopeRows(scope, locale = "ko") {
  return Object.entries(scope || {}).filter(([, value]) => value != null && value !== "" && (!Array.isArray(value) || value.length)).map(([key, value]) => [REVIEW_SCOPE_LABELS[key]?.[locale === "en" ? 1 : 0] || key, Array.isArray(value) ? value.join(", ") : String(value)]);
}
