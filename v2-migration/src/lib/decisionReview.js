// 결정 기록은 원본 분석 데이터와 분리된 작은 운영 메모다. 브라우저 영속 저장은
// 사용자가 명시적으로 켠 경우에만 허용하며, 아래 allowlist를 통과한 값만 저장한다.
// 텍스트 값은 CSV 수식 주입을 막고, Excel 호환을 위해 호출부에서 BOM + CRLF로 저장한다.
import { normalizeDecisionComparisonScope } from "@/lib/decisionComparisonScope";

export const DECISION_REVIEW_SCHEMA_VERSION = 6;
export const DECISION_REVIEW_SAFE_FIELDS = Object.freeze([
  "id",
  "toolId",
  "locale",
  "conclusion",
  "action",
  "hypothesis",
  "metric",
  "targetDirection",
  "comparisonKind",
  "forecastPeriod",
  "forecastTarget",
  "forecastPlatform",
  "forecastValue",
  "forecastLower",
  "forecastUpper",
  "forecastSourceThrough",
  "baseline",
  "baselineDate",
  "comparisonWindowDays",
  "comparisonScope",
  "reviewQuestion",
  "reviewDate",
  "sourcePeriod",
  "actual",
  "learning",
  "status",
  "reviewedAt",
  "createdAt",
  "updatedAt",
]);

export const DECISION_REVIEW_COLUMNS = [
  "tool_id",
  "locale",
  "conclusion",
  "action",
  "hypothesis",
  "metric",
  "target_direction",
  "comparison_kind",
  "forecast_period",
  "forecast_target",
  "forecast_platform",
  "forecast_value",
  "forecast_lower",
  "forecast_upper",
  "forecast_source_through",
  "baseline",
  "baseline_date",
  "comparison_window_days",
  "comparison_scope",
  "review_question",
  "review_date",
  "source_period",
  "actual",
  "learning",
  "status",
  "reviewed_at",
  "created_at",
  "updated_at",
  "record_id",
];

const FIELD_LIMITS = Object.freeze({
  id: 120,
  toolId: 32,
  locale: 5,
  conclusion: 500,
  action: 500,
  hypothesis: 500,
  metric: 120,
  baseline: 160,
  comparisonScope: 5000,
  reviewQuestion: 500,
  sourcePeriod: 160,
  actual: 500,
  learning: 1000,
});

const FORECAST_TARGETS = new Set(["Traffic", "Regs", "React", "Purchasers", "Revenue"]);

function safeCell(value) {
  const text = String(value ?? "");
  // Excel/Sheets가 사용자 입력을 수식으로 해석하지 않도록 보호한다.
  const protectedText = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${protectedText.replace(/"/g, '""')}"`;
}

function asText(value, limit = 1000) {
  const text = typeof value === "string" ? value.trim() : String(value ?? "").trim();
  return text.slice(0, limit);
}

function asDate(value) {
  const text = asText(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return "";
  const [year, month, day] = text.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? text : "";
}

function asTimestamp(value) {
  const text = asText(value, 40);
  if (!text) return "";
  const time = Date.parse(text);
  return Number.isFinite(time) ? new Date(time).toISOString() : "";
}

export function toLocalDecisionDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function decisionReviewAgeBucket(record = {}, { now = new Date(), isSameSession = false } = {}) {
  if (isSameSession) return "same_session";
  const createdAt = Date.parse(record.createdAt || record.created_at || "");
  const current = now instanceof Date ? now.getTime() : Date.parse(now);
  if (!Number.isFinite(createdAt) || !Number.isFinite(current)) return "unknown";
  const days = Math.max(0, Math.floor((current - createdAt) / 86400000));
  if (days <= 3) return "1-3d";
  if (days <= 9) return "4-9d";
  return "10d+";
}

function nextCalendarDate(value) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

function escapeCalendarText(value) {
  return String(value ?? "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

// 캘린더에는 채널·캠페인·소재명이나 결정 메모를 넣지 않는다. 날짜와 제품의
// 주간 검토 링크만 담아 사용자가 캘린더 동기화 시에도 운영 데이터가 노출되지 않게 한다.
export function serializeDecisionReviewIcs(record = {}, locale = "ko") {
  const reviewDate = asDate(record.reviewDate ?? record.review_date);
  if (!reviewDate) return "";
  const compactDate = reviewDate.replace(/-/g, "");
  const createdAt = asTimestamp(record.createdAt || record.created_at) || `${reviewDate}T00:00:00.000Z`;
  const calendarStamp = createdAt.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const isEnglish = locale === "en";
  const reviewUrl = `https://growthoptplaybook.com${isEnglish ? "/en" : ""}/weekly-review`;
  const uidToken = asText(record.id || record.record_id || createdAt, 120).replace(/[^a-zA-Z0-9_-]/g, "-");
  const summary = isEnglish ? "Review marketing decision" : "마케팅 결정 검토";
  const description = isEnglish
    ? "Review the actual outcome and record what you learned."
    : "실제 결과와 배운 점을 검토하세요.";
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Growth Opt Playbook//Decision Review//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uidToken}@growthoptplaybook.com`,
    `DTSTAMP:${calendarStamp}`,
    `DTSTART;VALUE=DATE:${compactDate}`,
    `DTEND;VALUE=DATE:${nextCalendarDate(reviewDate)}`,
    `SUMMARY:${escapeCalendarText(summary)}`,
    `DESCRIPTION:${escapeCalendarText(description)}`,
    `URL:${reviewUrl}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

function field(row, camel, snake = camel) {
  return row?.[snake] ?? row?.[camel];
}

function asComparisonWindowDays(value) {
  const parsed = Number(asText(value, 3));
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 60 ? String(parsed) : "7";
}

export function getDecisionReviewStatus({ status, reviewedAt, reviewed_at } = {}) {
  const explicitStatus = asText(status, 12).toLowerCase();
  return explicitStatus === "reviewed" || Boolean(asTimestamp(reviewedAt ?? reviewed_at)) ? "reviewed" : "pending";
}

export function getDecisionReviewBucket(record = {}, today = toLocalDecisionDate()) {
  const reviewDate = asDate(record.reviewDate ?? record.review_date);
  const normalizedToday = asDate(today);
  // 예전 자동 로직이 actual 입력만으로 남긴 status:"reviewed"는 검토일 전에는
  // 완료로 보이지 않게 한다. reviewedAt은 사용자가 명시적으로 완료한 기록이다.
  const hasExplicitReview = Boolean(asTimestamp(record.reviewedAt ?? record.reviewed_at));
  if (reviewDate && normalizedToday && reviewDate > normalizedToday && !hasExplicitReview) return "upcoming";
  if (getDecisionReviewStatus(record) === "reviewed") return "reviewed";
  if (!reviewDate || !normalizedToday) return "unscheduled";
  if (reviewDate < normalizedToday) return "overdue";
  if (reviewDate === normalizedToday) return "today";
  return "upcoming";
}

function firstNumericValue(value) {
  // D7·D30 같은 코호트 창은 지표명이지 값이 아니다. 자동 후보는 값을 앞에
  // 배치하지만, 사용자가 "D7 ROAS 1.2"로 입력해도 7을 읽지 않게 한다.
  const match = String(value ?? "").replace(/\bD\d+\b/gi, "").match(/[+-]?(?:\d[\d,\s]*)(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0].replace(/[,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

const LOWER_IS_BETTER_METRICS = /(^|[^A-Z0-9])(CPA|CPI|CAC|CPR|WMAPE|MAPE|RMSE|MAE)(?=$|[^A-Z0-9])/;
const HIGHER_IS_BETTER_METRICS = /(^|[^A-Z0-9])(ROAS|ROI|CTR|CVR|LTV|ARPU|AOV|F1|LIFT)(?=$|[^A-Z0-9])/;

function asTargetDirection(value) {
  const normalized = asText(value, 12).toLowerCase();
  return ["higher", "lower", "neutral"].includes(normalized) ? normalized : "";
}

function asForecastTarget(value) {
  const normalized = asText(value, 20);
  return FORECAST_TARGETS.has(normalized) ? normalized : "";
}

function asForecastPlatform(value) {
  const normalized = asText(value, 10).toLowerCase();
  return ["all", "android", "ios"].includes(normalized) ? normalized : "";
}

function asFiniteNumberText(value) {
  const normalized = asText(value, 80).replace(/[,\s]/g, "");
  if (!normalized) return "";
  const number = Number(normalized);
  return Number.isFinite(number) ? String(number) : "";
}

// CPA·ROAS처럼 업계 의미가 안정적인 지표만 자동 제안한다. 비용·전환수·매출처럼
// 예산이나 목표에 따라 방향이 달라지는 지표는 사용자가 직접 방향을 고르기 전까지
// 중립으로 남긴다.
export function decisionMetricDirection(metric) {
  const normalized = String(metric ?? "").normalize("NFKC").toUpperCase();
  if (LOWER_IS_BETTER_METRICS.test(normalized) || /(예측\s*)?오차|오류율/.test(normalized)) return "lower";
  if (HIGHER_IS_BETTER_METRICS.test(normalized) || /전환율|클릭률|리텐션|유지율|달성률/.test(normalized)) return "higher";
  return "";
}

// 결정 기록에는 원본 행이 아니라 사용자가 확인한 요약 문자열만 있다. 기준·실제값의
// 첫 숫자가 모두 읽힐 때만 중립적인 델타를 계산하고, 좋음/나쁨 방향은 지표마다 달라
// 임의 판정하지 않는다.
export function decisionNumericComparison(record = {}) {
  const baseline = firstNumericValue(record.baseline);
  const actual = firstNumericValue(record.actual);
  const baselineIsPercent = String(record.baseline || "").includes("%");
  const actualIsPercent = String(record.actual || "").includes("%");
  if (!Number.isFinite(baseline) || !Number.isFinite(actual) || baselineIsPercent !== actualIsPercent) return null;
  const delta = actual - baseline;
  return {
    baseline,
    actual,
    delta,
    changePct: baseline === 0 ? null : delta / Math.abs(baseline),
    isPercentPoint: baselineIsPercent,
  };
}

// "판단이 맞았다"는 인과 주장을 하지 않는다. 저장된 목표 방향과 기준값에 비춰
// 지표가 좋아졌는지만 분류하고, 방향이 없으면 변화량만 제공한다.
export function assessDecisionOutcome(record = {}) {
  const comparison = decisionNumericComparison(record);
  const explicitDirection = asTargetDirection(record.targetDirection ?? record.target_direction);
  const direction = explicitDirection || decisionMetricDirection(record.metric);
  if (!comparison) return { state: "incomplete", direction, comparison: null };
  if (comparison.delta === 0) return { state: "unchanged", direction, comparison };
  if (!direction || direction === "neutral") return { state: "unscored", direction: direction || "", comparison };
  const isImproved = direction === "higher" ? comparison.delta > 0 : comparison.delta < 0;
  return { state: isImproved ? "improved" : "declined", direction, comparison };
}

export function summarizeDecisionOutcomes(records = []) {
  const summary = { improved: 0, declined: 0, unchanged: 0, unscored: 0, comparable: 0 };
  (Array.isArray(records) ? records : []).forEach((record) => {
    const outcome = assessDecisionOutcome(record);
    if (outcome.state === "incomplete") return;
    summary[outcome.state] += 1;
    summary.comparable += 1;
  });
  return summary;
}

export function sanitizeDecisionReviewRecord(row, fallbackToolId = "") {
  if (!row || typeof row !== "object" || Array.isArray(row)) return null;
  const action = asText(field(row, "action"), FIELD_LIMITS.action);
  if (!action) return null;
  const actual = asText(field(row, "actual"), FIELD_LIMITS.actual);
  const learning = asText(field(row, "learning"), FIELD_LIMITS.learning);
  const reviewedAt = asTimestamp(field(row, "reviewedAt", "reviewed_at"));
  const locale = asText(field(row, "locale"), FIELD_LIMITS.locale).toLowerCase() === "en" ? "en" : "ko";
  const comparisonKind = asText(field(row, "comparisonKind", "comparison_kind"), 24) === "forecast_actual" ? "forecast_actual" : "";
  const record = {
    id: asText(field(row, "id", "record_id"), FIELD_LIMITS.id),
    toolId: asText(field(row, "toolId", "tool_id"), FIELD_LIMITS.toolId) || asText(fallbackToolId, FIELD_LIMITS.toolId),
    locale,
    conclusion: asText(field(row, "conclusion"), FIELD_LIMITS.conclusion),
    action,
    hypothesis: asText(field(row, "hypothesis"), FIELD_LIMITS.hypothesis),
    metric: asText(field(row, "metric"), FIELD_LIMITS.metric),
    targetDirection: asTargetDirection(field(row, "targetDirection", "target_direction")),
    comparisonKind,
    forecastPeriod: comparisonKind ? asDate(field(row, "forecastPeriod", "forecast_period")) : "",
    forecastTarget: comparisonKind ? asForecastTarget(field(row, "forecastTarget", "forecast_target")) : "",
    forecastPlatform: comparisonKind ? asForecastPlatform(field(row, "forecastPlatform", "forecast_platform")) : "",
    forecastValue: comparisonKind ? asFiniteNumberText(field(row, "forecastValue", "forecast_value")) : "",
    forecastLower: comparisonKind ? asFiniteNumberText(field(row, "forecastLower", "forecast_lower")) : "",
    forecastUpper: comparisonKind ? asFiniteNumberText(field(row, "forecastUpper", "forecast_upper")) : "",
    forecastSourceThrough: comparisonKind ? asDate(field(row, "forecastSourceThrough", "forecast_source_through")) : "",
    baseline: asText(field(row, "baseline"), FIELD_LIMITS.baseline),
    baselineDate: asDate(field(row, "baselineDate", "baseline_date")),
    comparisonWindowDays: asComparisonWindowDays(field(row, "comparisonWindowDays", "comparison_window_days")),
    comparisonScope: normalizeDecisionComparisonScope(field(row, "comparisonScope", "comparison_scope")),
    reviewQuestion: asText(field(row, "reviewQuestion", "review_question"), FIELD_LIMITS.reviewQuestion),
    reviewDate: asDate(field(row, "reviewDate", "review_date")),
    sourcePeriod: asText(field(row, "sourcePeriod", "source_period"), FIELD_LIMITS.sourcePeriod),
    actual,
    learning,
    status: getDecisionReviewStatus({ status: field(row, "status"), reviewedAt }),
    reviewedAt,
    createdAt: asTimestamp(field(row, "createdAt", "created_at")),
    updatedAt: asTimestamp(field(row, "updatedAt", "updated_at")),
  };
  return Object.fromEntries(DECISION_REVIEW_SAFE_FIELDS.map((key) => [key, record[key] ?? ""]));
}

export function normalizeDecisionReviewRows(rows, fallbackToolId = "") {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => sanitizeDecisionReviewRecord({
    ...row,
    tool_id: row?.tool_id ?? row?.["\uFEFFtool_id"] ?? row?.toolId,
  }, fallbackToolId)).filter(Boolean);
}

export function sanitizeDecisionReviewRecords(records = []) {
  return normalizeDecisionReviewRows(records).map((record) => Object.fromEntries(
    DECISION_REVIEW_SAFE_FIELDS.map((key) => [key, record[key] ?? ""]),
  ));
}

export function serializeDecisionReviewCsv(records = []) {
  const rows = normalizeDecisionReviewRows(records).map((record) => [
    record.toolId,
    record.locale,
    record.conclusion,
    record.action,
    record.hypothesis,
    record.metric,
    record.targetDirection,
    record.comparisonKind,
    record.forecastPeriod,
    record.forecastTarget,
    record.forecastPlatform,
    record.forecastValue,
    record.forecastLower,
    record.forecastUpper,
    record.forecastSourceThrough,
    record.baseline,
    record.baselineDate,
    record.comparisonWindowDays,
    record.comparisonScope,
    record.reviewQuestion,
    record.reviewDate,
    record.sourcePeriod,
    record.actual,
    record.learning,
    record.status,
    record.reviewedAt,
    record.createdAt,
    record.updatedAt,
    record.id,
  ]);
  return `\uFEFF${[DECISION_REVIEW_COLUMNS, ...rows].map((row) => row.map(safeCell).join(",")).join("\r\n")}\r\n`;
}
