/**
 * Weekly Review 기간 판정.
 *
 * 왜 이렇게 하는가: 광고 플랫폼 export는 보통 어제까지이고 사용자가 과거 데이터를 올리기도 한다.
 * "오늘"을 기준으로 자르면 빈 주를 비교하게 되므로 **데이터의 최대 날짜**가 기준이다.
 * 그리고 최대 날짜가 주 중간이면 그 주를 통째로 버리는 대신 **전주의 같은 요일까지만** 잘라
 * 비교한다. 요일 수가 같아야 요일 효과가 상쇄된다 — 주말 CPA가 평일과 다른 계정에서
 * 월–수를 전주 7일과 견주면 요일 구성 차이만으로 두 자릿수 변화가 나온다.
 *
 * 날짜는 전부 UTC로 다룬다. `new Date("2026-08-31")`은 UTC 자정으로 파싱되므로 요일 판정도
 * `getUTCDay()`여야 한다. `getDay()`를 쓰면 UTC 이서 타임존에서 하루 밀린다.
 *
 * 순수 함수 — 시스템 시계·로케일·타임존에 의존하지 않는다.
 */

const DAY_MS = 86400000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "YYYY-MM-DD" → UTC 자정 Date. 형식이 아니거나 존재하지 않는 날짜면 null. */
export function parseUtcDate(value) {
  const match = ISO_DATE.exec(String(value ?? "").trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  // 2026-02-30 같은 값은 롤오버되므로 되돌려 확인한다.
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return date;
}

/** UTC 자정 Date → "YYYY-MM-DD". */
export function formatUtcDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function addDaysUtc(date, days) {
  return new Date(date.getTime() + days * DAY_MS);
}

/** 그 날짜가 속한 ISO 주(월요일 시작)의 월요일. */
export function isoWeekStartUtc(date) {
  const weekday = date.getUTCDay(); // 0=일 … 6=토
  const backToMonday = weekday === 0 ? 6 : weekday - 1;
  return addDaysUtc(date, -backToMonday);
}

function inclusiveDayCount(start, end) {
  return Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;
}

function period(start, end) {
  return { start: formatUtcDate(start), end: formatUtcDate(end), days: inclusiveDayCount(start, end) };
}

/** 표본이 이틀 이하면 판정이 흔들리므로 볼륨 게이트를 두 배로 올린다(§4.1). */
export const SMALL_SAMPLE_MAX_DAYS = 2;
export const SMALL_SAMPLE_VOLUME_MULTIPLIER = 2;

function decorate(current, previous, dateSet, warnings) {
  const partial = current.days < 7;
  const smallSample = current.days <= SMALL_SAMPLE_MAX_DAYS;
  const hasPrevious = rangeHasData(previous, dateSet);
  if (!hasPrevious) {
    return { ok: false, reason: "no_previous_data", current, previous, partial, smallSample, warnings };
  }
  return {
    ok: true,
    reason: null,
    current,
    previous,
    partial,
    smallSample,
    volumeMultiplier: smallSample ? SMALL_SAMPLE_VOLUME_MULTIPLIER : 1,
    warnings,
  };
}

function rangeHasData(range, dateSet) {
  if (!dateSet || dateSet.size === 0) return false;
  for (const value of dateSet) {
    if (value >= range.start && value <= range.end) return true;
  }
  return false;
}

/**
 * 비교 기간을 정한다.
 *
 * @param {string[]} dates      데이터에 등장한 날짜들("YYYY-MM-DD"). 순서 무관, 중복 허용.
 * @param {object=} custom      사용자가 지정한 기간. `{ currentStart, currentEnd, previousStart?, previousEnd? }`
 *                              지난 기간을 생략하면 이번 기간과 **같은 길이로** 직전 구간을 잡는다.
 * @returns {object} `{ ok, reason, current, previous, partial, smallSample, volumeMultiplier, warnings }`
 *                   `ok:false`면 `reason`이 이유를 말한다 — 값을 지어내지 않는다.
 */
export function resolveComparisonPeriods({ dates = [], custom = null } = {}) {
  const parsed = [];
  const dateSet = new Set();
  for (const value of dates) {
    const date = parseUtcDate(value);
    if (!date) continue;
    const iso = formatUtcDate(date);
    if (dateSet.has(iso)) continue;
    dateSet.add(iso);
    parsed.push(date);
  }

  if (custom) return resolveCustom(custom, dateSet);

  if (parsed.length === 0) {
    return { ok: false, reason: "no_dates", current: null, previous: null, partial: false, smallSample: false, warnings: [] };
  }

  const maxDate = parsed.reduce((a, b) => (a.getTime() >= b.getTime() ? a : b));
  const weekStart = isoWeekStartUtc(maxDate);
  const current = period(weekStart, maxDate);
  const previous = period(addDaysUtc(weekStart, -7), addDaysUtc(maxDate, -7));

  return decorate(current, previous, dateSet, []);
}

function resolveCustom(custom, dateSet) {
  const curStart = parseUtcDate(custom.currentStart);
  const curEnd = parseUtcDate(custom.currentEnd);
  if (!curStart || !curEnd || curEnd.getTime() < curStart.getTime()) {
    return { ok: false, reason: "invalid_custom_range", current: null, previous: null, partial: false, smallSample: false, warnings: [] };
  }

  const current = period(curStart, curEnd);
  const warnings = [];

  let prevStart = parseUtcDate(custom.previousStart);
  let prevEnd = parseUtcDate(custom.previousEnd);

  if (prevStart && prevEnd && prevEnd.getTime() >= prevStart.getTime()) {
    // 사용자가 두 기간을 모두 지정했다. 길이가 달라도 막지 않는다 — 격주·전후 비교처럼
    // 의도적인 경우가 있다. 대신 변화율이 기간 차이 때문일 수 있다고 경고한다.
    if (inclusiveDayCount(prevStart, prevEnd) !== current.days) warnings.push("length_mismatch");
  } else {
    // 지난 기간 미지정 → 같은 길이로 바로 앞 구간.
    prevEnd = addDaysUtc(curStart, -1);
    prevStart = addDaysUtc(prevEnd, -(current.days - 1));
  }

  return decorate(current, period(prevStart, prevEnd), dateSet, warnings);
}
