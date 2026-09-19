// 결정 기록은 원본 분석 데이터와 분리된 작은 운영 메모다. 브라우저 영속 저장은
// 사용자가 명시적으로 켠 경우에만 허용하며, 아래 allowlist를 통과한 값만 저장한다.
// 텍스트 값은 CSV 수식 주입을 막고, Excel 호환을 위해 호출부에서 BOM + CRLF로 저장한다.
import { normalizeDecisionComparisonScope, readDecisionComparisonScope } from "@/lib/decisionComparisonScope";
import { readDatasetContinuitySnapshot, serializeDatasetContinuitySnapshot } from "@/lib/dataContinuity";
import { resolvePathToId } from "@/lib/routeMap";
import { isRerunGoalMetric } from "@/lib/decisionGoals";
import { parseNumericStrict } from "@/utils/parseNumeric";

// v9: Weekly Review가 지난 결정을 자동 판정하려면 목표와 가드레일이 결정과 함께 기록돼야 한다.
// v8까지는 `action`이 자유 문자열이라 "예산 +15%"가 성공인지 판단할 근거가 없었다.
// 옛 레코드는 이 필드들이 비어 있고, `decisionScore`가 추측하지 않고 UNSCORED로 남긴다.
// v10: 가드레일이 하나뿐이면 "오가닉은 늘었는데 총량이 줄었다" 같은 실패를 못 잡는다.
// `guardrails`가 목록을 들고, 옛 단수 필드는 그 목록의 첫 항목으로 계속 유효하다.
export const DECISION_REVIEW_SCHEMA_VERSION = 11;
export const DECISION_REVIEW_SAFE_FIELDS = Object.freeze([
  "id",
  "toolId",
  "sourcePath",
  "dataOrigin",
  "locale",
  "conclusion",
  "action",
  // v9 — 자동 판정을 위한 구조화 필드(§6.1). 비어 있으면 판정하지 않는다.
  "actionKind",
  "actionTarget",
  "actionAmount",
  "goalMetric",
  "goalDirection",
  "guardrailMetric",
  "guardrailOp",
  "guardrailValue",
  // v10 — 추가 가드레일. "metric|op|value" 를 ";"로 이은 문자열(재조립 후 저장).
  "guardrails",
  // v11 — 관측 이력. 한 결정은 여러 번 관측된다(§관측 이력). `actual`·`learning`은
  // 최신 에피소드의 미러로 남겨 기존 소비처 13곳을 그대로 둔다.
  "episodes",
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
  "datasetSnapshot",
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
  "source_path",
  "data_origin",
  "locale",
  "conclusion",
  "action",
  "action_kind",
  "action_target",
  "action_amount",
  "goal_metric",
  "goal_direction",
  "guardrail_metric",
  "guardrail_op",
  "guardrail_value",
  "guardrails",
  "episodes",
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
  "dataset_snapshot",
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

const MAX_DECISION_EPISODES = 12;
const ACTUAL_TEXT_LIMIT = 500;
const LEARNING_TEXT_LIMIT = 1000;
const FIELD_LIMITS = Object.freeze({
  id: 120,
  toolId: 32,
  sourcePath: 220,
  locale: 5,
  conclusion: 500,
  action: 500,
  hypothesis: 500,
  metric: 120,
  guardrails: 400,
  // UTF-16 한 단위당 최대 9자 인코딩 + 시각(40자)·구분자를 모두 수용한다.
  // 임의 6000자 절단은 한글 기록의 최신 관측과 % 시퀀스를 잘라 버렸다.
  episodes: MAX_DECISION_EPISODES * ((ACTUAL_TEXT_LIMIT + LEARNING_TEXT_LIMIT + 40) * 9 + 3),
  baseline: 160,
  comparisonScope: 5000,
  datasetSnapshot: 1200,
  reviewQuestion: 500,
  sourcePeriod: 160,
  actual: ACTUAL_TEXT_LIMIT,
  learning: LEARNING_TEXT_LIMIT,
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
  // 토큰을 뽑는 건 여기가 하고, 그 토큰을 숫자로 읽는 규칙은 SSOT가 소유한다.
  return parseNumericStrict(match[0]);
}

const LOWER_IS_BETTER_METRICS = /(^|[^A-Z0-9])(CPA|CPI|CAC|CPR|WMAPE|MAPE|RMSE|MAE)(?=$|[^A-Z0-9])/;
const HIGHER_IS_BETTER_METRICS = /(^|[^A-Z0-9])(ROAS|ROI|CTR|CVR|LTV|ARPU|AOV|F1|LIFT)(?=$|[^A-Z0-9])/;

// ── v9: 자동 판정용 구조화 필드 ──────────────────────────────────
// 전부 화이트리스트로 좁힌다. 자유 문자열로 두면 `decisionScore`가 분기할 수 없고,
// 그러면 v9 필드가 있어도 판정이 안 되는 v8과 다를 바 없어진다.
export const DECISION_ACTION_KINDS = Object.freeze([
  "increase_budget", "decrease_budget", "hold", "replace", "investigate",
]);
const GOAL_DIRECTIONS = ["up", "down", "hold"];
const GUARDRAIL_OPS = ["lte", "gte"];

function asActionKind(value) {
  const normalized = asText(value, 24).toLowerCase();
  return DECISION_ACTION_KINDS.includes(normalized) ? normalized : "";
}

function asGoalDirection(value) {
  const normalized = asText(value, 8).toLowerCase();
  return GOAL_DIRECTIONS.includes(normalized) ? normalized : "";
}

function asGuardrailOp(value) {
  const normalized = asText(value, 8).toLowerCase();
  return GUARDRAIL_OPS.includes(normalized) ? normalized : "";
}

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

// ── v10 가드레일 목록 ────────────────────────────────────────────
// 가드레일은 "넘었으면 넘은 것"이라 유의미성을 묻지 않는 선언적 한계선이다(decisionScore §정직성③).
// 하나로는 부족한 경우가 있다 — 잠식 결정에서 "오가닉 전환 ↑"만 걸면, 광고를 끈 뒤
// 어트리뷰션이 오가닉으로 옮겨가 총 전환이 줄어도 성공으로 읽힌다. 총량 가드레일이
// 그 자기기만을 막는 자리이고, 그러려면 가드레일이 둘 이상이어야 한다.
//
// 저장은 문자열 하나로 한다(`comparisonScope`·`datasetSnapshot`과 같은 결). 파싱은
// 허용 필드만 새로 조립하므로(§12.29) 저장된 값이 변조돼도 형식 밖 값은 들어오지 않는다.
const GUARDRAIL_LIST_SEPARATOR = ";";
const GUARDRAIL_PART_SEPARATOR = "|";
const MAX_GUARDRAILS = 4;

export function parseDecisionGuardrails(value) {
  const text = asText(value, FIELD_LIMITS.guardrails);
  if (!text) return [];
  const seen = new Set();
  const list = [];
  for (const chunk of text.split(GUARDRAIL_LIST_SEPARATOR)) {
    const [rawMetric, rawOp, rawValue] = chunk.split(GUARDRAIL_PART_SEPARATOR);
    const metric = asText(rawMetric, FIELD_LIMITS.metric);
    const op = asGuardrailOp(rawOp);
    const numberText = asFiniteNumberText(rawValue);
    // 셋이 다 있어야 비교가 성립한다. 하나라도 비면 조용히 버린다 —
    // 반쪽 가드레일을 남기면 스코어러가 "측정 불가"로 판정 전체를 막는다.
    if (!metric || !op || !numberText) continue;
    if (seen.has(metric)) continue;
    seen.add(metric);
    list.push({ metric, op, value: numberText });
    if (list.length >= MAX_GUARDRAILS) break;
  }
  return list;
}

export function serializeDecisionGuardrails(list) {
  if (!Array.isArray(list)) return "";
  const text = list
    .slice(0, MAX_GUARDRAILS)
    .map((item) => [item?.metric, item?.op, item?.value].join(GUARDRAIL_PART_SEPARATOR))
    .join(GUARDRAIL_LIST_SEPARATOR);
  // 재조립으로 한 번 더 거른다 — 직렬화 입력이 이미 검증됐다고 가정하지 않는다.
  const parsed = parseDecisionGuardrails(text);
  return parsed.map((item) => [item.metric, item.op, item.value].join(GUARDRAIL_PART_SEPARATOR)).join(GUARDRAIL_LIST_SEPARATOR);
}

/**
 * 레코드가 실제로 걸고 있는 가드레일 전부.
 *
 * 옛 레코드(v9)는 단수 필드만 갖는다. 그걸 첫 항목으로 두고 목록을 이어 붙여,
 * 스코어러가 두 세대를 같은 모양으로 읽게 한다. 같은 지표가 양쪽에 있으면
 * 단수 쪽이 이긴다(화면이 그 값을 보여 주고 있었으므로).
 */
export function decisionGuardrailList(record = {}) {
  const list = [];
  const primaryMetric = asText(record.guardrailMetric ?? record.guardrail_metric, FIELD_LIMITS.metric);
  const primaryOp = asGuardrailOp(record.guardrailOp ?? record.guardrail_op);
  const primaryValue = asFiniteNumberText(record.guardrailValue ?? record.guardrail_value);
  if (primaryMetric && primaryOp && primaryValue) list.push({ metric: primaryMetric, op: primaryOp, value: primaryValue });
  const seen = new Set(list.map((item) => item.metric));
  for (const item of parseDecisionGuardrails(record.guardrails)) {
    if (seen.has(item.metric)) continue;
    seen.add(item.metric);
    list.push(item);
  }
  return list.slice(0, MAX_GUARDRAILS);
}

// ── v11 관측 이력(에피소드) ──────────────────────────────────────
// 한 결정은 한 번만 관측되지 않는다. 예측 검토는 기간마다 돌아오고, 잠식 결정은
// 광고를 끈 다음 주와 그 다음 주가 다르게 읽힌다. 그런데 `actual`·`learning`이
// 레코드당 한 칸뿐이라 두 번째 관측이 첫 관측을 **말없이 덮어썼다** — 5-18 예측의
// "관측값 적용"에는 완료 게이트조차 없어 누를 때마다 이전 기록이 사라졌다.
//
// 저장은 `guardrails`(v10)와 같은 결로 문자열 하나에 담는다. 다만 가드레일의 각
// 조각은 지표명·연산자·숫자라 구분자가 섞일 일이 없는 반면 **에피소드는 자유
// 텍스트**다 — 사용자가 "CPA 1,200원; 목표 미달|재검토"라고 적으면 구분자가 그대로
// 깨진다. 그래서 자유 텍스트 조각만 퍼센트 인코딩해 담는다: `encodeURIComponent`는
// `;`·`|`·`,`·줄바꿈을 전부 `%XX`로 바꾸므로 구분자도 CSV도 안전하다.
const EPISODE_LIST_SEPARATOR = ";";
const EPISODE_PART_SEPARATOR = "|";
// 주간 검토 기준 한 분기. 넘으면 오래된 것부터 버린다 — 최신 관측이 화면에
// 보이는 값이므로 뒤를 남긴다.

function encodeEpisodePart(value, limit) {
  const text = asText(value, limit);
  return text ? encodeURIComponent(text) : "";
}

function decodeEpisodePart(value, limit) {
  const raw = typeof value === "string" ? value : "";
  if (!raw) return "";
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    // 잘린 `%` 시퀀스는 던진다. 저장된 값이 손상됐더라도 조각을 통째로 버리기보다
    // 원문을 그대로 보여 주는 편이 사용자에게 낫다(§8 정직한 빈 상태보다 나은 경우).
    decoded = raw;
  }
  return asText(decoded, limit);
}

export function parseDecisionEpisodes(value) {
  const text = asText(value, FIELD_LIMITS.episodes);
  if (!text) return [];
  const list = [];
  for (const chunk of text.split(EPISODE_LIST_SEPARATOR)) {
    if (!chunk) continue;
    const [rawObservedAt, rawActual, rawLearning] = chunk.split(EPISODE_PART_SEPARATOR);
    const observedAt = asTimestamp(decodeEpisodePart(rawObservedAt, 40));
    const actual = decodeEpisodePart(rawActual, FIELD_LIMITS.actual);
    const learning = decodeEpisodePart(rawLearning, FIELD_LIMITS.learning);
    // 관측 내용이 없으면 에피소드가 아니다. 시각만 남은 줄은 조용히 버린다 —
    // 빈 칸을 이력에 남기면 "몇 번 봤나"가 거짓이 된다.
    if (!actual) continue;
    list.push({ observedAt, actual, learning });
    if (list.length >= MAX_DECISION_EPISODES) break;
  }
  return list;
}

export function serializeDecisionEpisodes(list) {
  if (!Array.isArray(list)) return "";
  const text = list
    .slice(-MAX_DECISION_EPISODES)
    .map((item) => [
      encodeEpisodePart(item?.observedAt, 40),
      encodeEpisodePart(item?.actual, FIELD_LIMITS.actual),
      encodeEpisodePart(item?.learning, FIELD_LIMITS.learning),
    ].join(EPISODE_PART_SEPARATOR))
    .join(EPISODE_LIST_SEPARATOR);
  // 가드레일과 같은 규율 — 재조립으로 한 번 더 거른다. 직렬화 입력이 이미
  // 검증됐다고 가정하지 않는다(§12.29 공유 링크 재조립).
  const parsed = parseDecisionEpisodes(asText(text, FIELD_LIMITS.episodes));
  return parsed
    .map((item) => [
      encodeEpisodePart(item.observedAt, 40),
      encodeEpisodePart(item.actual, FIELD_LIMITS.actual),
      encodeEpisodePart(item.learning, FIELD_LIMITS.learning),
    ].join(EPISODE_PART_SEPARATOR))
    .join(EPISODE_LIST_SEPARATOR);
}

/**
 * 레코드가 실제로 가진 관측 전부, 오래된 것부터.
 *
 * v10 이하 레코드는 `episodes`가 없고 `actual`·`learning` 한 벌만 갖는다. 그걸
 * 첫 에피소드로 세워 두 세대를 같은 모양으로 읽게 한다(v10이 `guardrailMetric`을
 * 첫 항목으로 세운 것과 같은 방식). 이미 `episodes`가 있으면 그쪽이 정본이다 —
 * `actual`은 그 목록의 미러이므로 다시 더하면 최신 관측이 두 번 세어진다.
 */
export function decisionEpisodeList(record = {}) {
  const episodes = parseDecisionEpisodes(record.episodes);
  if (episodes.length) return episodes;
  const actual = asText(record.actual, FIELD_LIMITS.actual);
  if (!actual) return [];
  return [{
    observedAt: asTimestamp(record.reviewedAt ?? record.reviewed_at),
    actual,
    learning: asText(record.learning, FIELD_LIMITS.learning),
  }];
}

/**
 * 관측 하나를 이력 끝에 붙이고, `actual`·`learning`을 최신 값으로 맞춘 패치를 준다.
 *
 * 미러를 함께 갱신하는 것이 이 설계의 핵심이다 — `actual`을 읽는 소비처가 13곳인데
 * 전부 고치는 대신 최신 관측을 그 자리에 계속 넣어 준다. 소비처는 "지금 값"을
 * 그대로 보고, 이력이 필요한 화면만 `decisionEpisodeList`를 부른다.
 */
export function appendDecisionEpisode(record = {}, episode = {}) {
  const actual = asText(episode.actual, FIELD_LIMITS.actual);
  if (!actual) return null;
  const learning = asText(episode.learning, FIELD_LIMITS.learning);
  const observedAt = asTimestamp(episode.observedAt) || new Date().toISOString();
  const next = [...decisionEpisodeList(record), { observedAt, actual, learning }];
  return {
    episodes: serializeDecisionEpisodes(next),
    actual,
    learning,
    reviewedAt: observedAt,
  };
}

function asFiniteNumberText(value) {
  const normalized = asText(value, 80).replace(/[,\s]/g, "");
  if (!normalized) return "";
  const number = Number(normalized);
  return Number.isFinite(number) ? String(number) : "";
}

function normalizeSourcePath(value) {
  const raw = asText(value, FIELD_LIMITS.sourcePath);
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || /[\r\n#]/.test(raw)) return "";
  const [pathname, query = ""] = raw.split("?", 2);
  const normalizedPath = (pathname.replace(/^\/en(?=\/|$)/, "") || "/").replace(/\/$/, "") || "/";
  if (!resolvePathToId(normalizedPath)) return "";
  const params = new URLSearchParams(query);
  const stage = params.get("stage");
  // 현재 반응 분석만 단계 쿼리를 사용한다. 다른 쿼리·외부 URL을 보존하지 않아
  // 보관함 링크가 의도치 않은 화면이나 외부 대상으로 바뀌지 않게 한다.
  return ["hub", "trend", "diagnose", "mmm", "lab"].includes(stage)
    ? `${normalizedPath}?stage=${stage}`
    : normalizedPath;
}

function hasComparableMetric(metric) {
  const text = String(metric ?? "").normalize("NFKC").toUpperCase();
  return /(^|[^A-Z])(?:CPA|CPI|ROAS)(?=$|[^A-Z])/.test(text);
}

// 새 CSV로 자동 대조할 수 있는 기록과, 같은 도구에서 재분석한 값을 사용자가
// 기록해야 하는 진단형 결정을 구분한다. 후자를 자동 성과처럼 만들지 않는다.
export function decisionReviewFollowUpMode(record = {}) {
  if (String(record.comparisonKind ?? record.comparison_kind) === "forecast_actual") return "forecast_auto";
  // 도구가 "이 목표는 효율 CSV로 계산되지 않는다"고 선언했으면 그 선언이 이긴다.
  // 표시 라벨을 정규식으로 읽어 추측하는 것보다 정확하다 — 라벨은 번역·리네임으로 바뀐다.
  if (isRerunGoalMetric(record.goalMetric ?? record.goal_metric)) return "rerun_manual";
  if (!hasComparableMetric(record.metric)) return "rerun_manual";
  const baselineDate = asDate(record.baselineDate ?? record.baseline_date);
  const scope = readDecisionComparisonScope(record.comparisonScope ?? record.comparison_scope);
  return baselineDate && scope ? "period_auto" : "period_setup";
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
    dataOrigin: ["real", "demo"].includes(field(row, "dataOrigin", "data_origin")) ? field(row, "dataOrigin", "data_origin") : "unknown",
    sourcePath: normalizeSourcePath(field(row, "sourcePath", "source_path")),
    locale,
    conclusion: asText(field(row, "conclusion"), FIELD_LIMITS.conclusion),
    action,
    actionKind: asActionKind(field(row, "actionKind", "action_kind")),
    actionTarget: asText(field(row, "actionTarget", "action_target"), FIELD_LIMITS.metric),
    actionAmount: asText(field(row, "actionAmount", "action_amount"), 32),
    goalMetric: asText(field(row, "goalMetric", "goal_metric"), FIELD_LIMITS.metric),
    goalDirection: asGoalDirection(field(row, "goalDirection", "goal_direction")),
    guardrailMetric: asText(field(row, "guardrailMetric", "guardrail_metric"), FIELD_LIMITS.metric),
    guardrailOp: asGuardrailOp(field(row, "guardrailOp", "guardrail_op")),
    guardrailValue: asFiniteNumberText(field(row, "guardrailValue", "guardrail_value")),
    guardrails: serializeDecisionGuardrails(parseDecisionGuardrails(field(row, "guardrails"))),
    episodes: serializeDecisionEpisodes(parseDecisionEpisodes(field(row, "episodes"))),
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
    datasetSnapshot: serializeDatasetContinuitySnapshot(readDatasetContinuitySnapshot(field(row, "datasetSnapshot", "dataset_snapshot"))),
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
  const rows = normalizeDecisionReviewRows(records).map(record => DECISION_REVIEW_COLUMNS.map(column => record[column === "record_id" ? "id" : column.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())] ?? ""));
  return `\uFEFF${[DECISION_REVIEW_COLUMNS, ...rows].map((row) => row.map(safeCell).join(",")).join("\r\n")}\r\n`;
}
