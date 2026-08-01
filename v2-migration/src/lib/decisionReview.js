// 결정 기록은 원본 분석 데이터와 분리된 작은 운영 메모다. 브라우저 영속 저장은
// 사용자가 명시적으로 켠 경우에만 허용하며, 아래 allowlist를 통과한 값만 저장한다.
// 텍스트 값은 CSV 수식 주입을 막고, Excel 호환을 위해 호출부에서 BOM + CRLF로 저장한다.
export const DECISION_REVIEW_SCHEMA_VERSION = 2;
export const DECISION_REVIEW_SAFE_FIELDS = Object.freeze([
  "id",
  "toolId",
  "locale",
  "conclusion",
  "action",
  "hypothesis",
  "metric",
  "baseline",
  "reviewQuestion",
  "reviewDate",
  "sourcePeriod",
  "actual",
  "learning",
  "status",
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
  "baseline",
  "review_question",
  "review_date",
  "source_period",
  "actual",
  "learning",
  "status",
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
  reviewQuestion: 500,
  sourcePeriod: 160,
  actual: 500,
  learning: 1000,
});

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

function field(row, camel, snake = camel) {
  return row?.[snake] ?? row?.[camel];
}

export function getDecisionReviewStatus({ actual, learning } = {}) {
  return asText(actual) || asText(learning) ? "reviewed" : "pending";
}

export function getDecisionReviewBucket(record = {}, today = toLocalDecisionDate()) {
  if (getDecisionReviewStatus(record) === "reviewed") return "reviewed";
  const reviewDate = asDate(record.reviewDate ?? record.review_date);
  const normalizedToday = asDate(today);
  if (!reviewDate || !normalizedToday) return "unscheduled";
  if (reviewDate < normalizedToday) return "overdue";
  if (reviewDate === normalizedToday) return "today";
  return "upcoming";
}

export function sanitizeDecisionReviewRecord(row, fallbackToolId = "") {
  if (!row || typeof row !== "object" || Array.isArray(row)) return null;
  const action = asText(field(row, "action"), FIELD_LIMITS.action);
  if (!action) return null;
  const actual = asText(field(row, "actual"), FIELD_LIMITS.actual);
  const learning = asText(field(row, "learning"), FIELD_LIMITS.learning);
  const locale = asText(field(row, "locale"), FIELD_LIMITS.locale).toLowerCase() === "en" ? "en" : "ko";
  const record = {
    id: asText(field(row, "id", "record_id"), FIELD_LIMITS.id),
    toolId: asText(field(row, "toolId", "tool_id"), FIELD_LIMITS.toolId) || asText(fallbackToolId, FIELD_LIMITS.toolId),
    locale,
    conclusion: asText(field(row, "conclusion"), FIELD_LIMITS.conclusion),
    action,
    hypothesis: asText(field(row, "hypothesis"), FIELD_LIMITS.hypothesis),
    metric: asText(field(row, "metric"), FIELD_LIMITS.metric),
    baseline: asText(field(row, "baseline"), FIELD_LIMITS.baseline),
    reviewQuestion: asText(field(row, "reviewQuestion", "review_question"), FIELD_LIMITS.reviewQuestion),
    reviewDate: asDate(field(row, "reviewDate", "review_date")),
    sourcePeriod: asText(field(row, "sourcePeriod", "source_period"), FIELD_LIMITS.sourcePeriod),
    actual,
    learning,
    status: getDecisionReviewStatus({ actual, learning }),
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
    record.baseline,
    record.reviewQuestion,
    record.reviewDate,
    record.sourcePeriod,
    record.actual,
    record.learning,
    record.status,
    record.createdAt,
    record.updatedAt,
    record.id,
  ]);
  return `\uFEFF${[DECISION_REVIEW_COLUMNS, ...rows].map((row) => row.map(safeCell).join(",")).join("\r\n")}\r\n`;
}
