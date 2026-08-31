const EMPTY_MARKERS = new Set(["", "-", "n/a", "na", "null", "undefined", "없음"]);

const CURRENCY_PREFIX = /^(?:[₩$€£¥]|krw|usd|eur|jpy|gbp)\s*/i;
const CURRENCY_SUFFIX = /\s*(?:[₩$€£¥]|krw|usd|eur|jpy|gbp|원)$/i;
const MONTHS = new Map([
  ["jan", 1], ["january", 1], ["feb", 2], ["february", 2],
  ["mar", 3], ["march", 3], ["apr", 4], ["april", 4],
  ["may", 5], ["jun", 6], ["june", 6], ["jul", 7], ["july", 7],
  ["aug", 8], ["august", 8], ["sep", 9], ["sept", 9], ["september", 9],
  ["oct", 10], ["october", 10], ["nov", 11], ["november", 11],
  ["dec", 12], ["december", 12],
]);

function normalizedText(value) {
  return String(value).normalize("NFKC").trim();
}

export function normalizeNumericValue(value) {
  if (value == null) return null;
  const raw = normalizedText(value);
  if (EMPTY_MARKERS.has(raw.toLowerCase())) return null;

  let text = raw;
  let isNegative = false;
  if (text.startsWith("(") || text.endsWith(")")) {
    if (!(text.startsWith("(") && text.endsWith(")"))) return null;
    isNegative = true;
    text = text.slice(1, -1).trim();
  }

  const isPercent = /%\s*$/.test(text);
  text = text.replace(/%\s*$/, "").trim();

  let sign = 1;
  const consumeSign = () => {
    if (text.startsWith("-") || text.startsWith("+")) {
      if (text.startsWith("-")) sign = -1;
      text = text.slice(1).trim();
      return true;
    }
    return false;
  };
  const hadLeadingSign = consumeSign();
  const beforeCurrency = text;
  text = text.replace(CURRENCY_PREFIX, "").trim();
  const hadCurrencyPrefix = beforeCurrency !== text;
  if (hadCurrencyPrefix && !hadLeadingSign) consumeSign();
  else if (text.startsWith("-") || text.startsWith("+")) return null;
  text = text.replace(CURRENCY_SUFFIX, "").trim();

  const plainNumber = /^(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?$/i;
  const groupedNumber = /^\d{1,3}(?:[,\s\u00a0\u202f]\d{3})+(?:\.\d+)?$/;
  if (!plainNumber.test(text) && !groupedNumber.test(text)) return null;

  const cleaned = text.replace(/[,\s\u00a0\u202f]/g, "");
  let number = Number(cleaned);
  if (!Number.isFinite(number)) return null;
  if (isNegative || sign < 0) number = -Math.abs(number);
  return { value: number, isPercent };
}

function isoWeekParts(date) {
  const cursor = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const weekday = cursor.getUTCDay() || 7;
  cursor.setUTCDate(cursor.getUTCDate() + 4 - weekday);
  const year = cursor.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil((((cursor - yearStart) / 86400000) + 1) / 7);
  return { year, week };
}

function strictDay(year, month, day, minYear, maxYear) {
  if (year < minYear || year > maxYear) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

function strictIsoWeek(year, week, minYear, maxYear) {
  if (year < minYear || year > maxYear || week < 1 || week > 53) return null;
  const januaryFourth = new Date(Date.UTC(year, 0, 4));
  const mondayOffset = 1 - (januaryFourth.getUTCDay() || 7);
  const date = new Date(Date.UTC(year, 0, 4 + mondayOffset + ((week - 1) * 7)));
  const actual = isoWeekParts(date);
  return actual.year === year && actual.week === week ? date : null;
}

function parsedResult(date, grain, canonical) {
  return { date, grain, canonical, isoDate: date.toISOString().slice(0, 10) };
}

/**
 * 날짜 값을 환경의 Date 문자열 파서에 맡기지 않고 UTC 달력 규칙으로 검증한다.
 * 모호한 숫자형 A/B/YYYY는 기존 MMM 계약과 같이 A>12면 D/M, 그 외에는 M/D로
 * 결정하되 존재하지 않는 날짜는 rollover하지 않고 거부한다.
 */
export function parseDateValue(value, { minYear = 2000, maxYear = 2100 } = {}) {
  if (value == null) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const date = strictDay(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate(), minYear, maxYear);
    return date ? parsedResult(date, "day", date.toISOString().slice(0, 10)) : null;
  }

  const raw = normalizedText(value);
  if (!raw || EMPTY_MARKERS.has(raw.toLowerCase()) || (/^\d+(?:\.\d+)?$/.test(raw) && !/^\d{8}$/.test(raw))) return null;

  let match = raw.match(/^(\d{4})\s*(?:-|\/|\.)?\s*W(\d{1,2})(?:주차?)?$/i)
    || raw.match(/^(\d{4})년\s*(\d{1,2})주(?:차)?$/);
  if (match) {
    const year = Number(match[1]);
    const week = Number(match[2]);
    const date = strictIsoWeek(year, week, minYear, maxYear);
    return date ? parsedResult(date, "week", `${year}-W${String(week).padStart(2, "0")}`) : null;
  }

  match = raw.match(/^(\d{4})\s*(?:-|\/|\.)\s*(\d{1,2})$/)
    || raw.match(/^(\d{4})년\s*(\d{1,2})월$/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const date = strictDay(year, month, 1, minYear, maxYear);
    return date ? parsedResult(date, "month", `${year}-${String(month).padStart(2, "0")}`) : null;
  }

  const timeSuffix = String.raw`(?:[T ](?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,9})?)?(?:Z|[+-](?:[01]\d|2[0-3]):?[0-5]\d)?)?`;
  match = raw.match(new RegExp(`^(\\d{4})[-/.](\\d{1,2})[-/.](\\d{1,2})${timeSuffix}$`))
    || raw.match(/^(\d{4})(\d{2})(\d{2})$/)
    || raw.match(/^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일$/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = strictDay(year, month, day, minYear, maxYear);
    return date ? parsedResult(date, "day", date.toISOString().slice(0, 10)) : null;
  }

  match = raw.match(new RegExp(`^(\\d{1,2})[-/.](\\d{1,2})[-/.](\\d{4})${timeSuffix}$`));
  if (match) {
    const first = Number(match[1]);
    const second = Number(match[2]);
    if (first > 12 && second > 12) return null;
    const month = first > 12 ? second : first;
    const day = first > 12 ? first : second;
    const year = Number(match[3]);
    const date = strictDay(year, month, day, minYear, maxYear);
    return date ? parsedResult(date, "day", date.toISOString().slice(0, 10)) : null;
  }

  match = raw.match(/^([a-z]+)\s+(\d{1,2}),?\s+(\d{4})$/i)
    || raw.match(/^(\d{1,2})\s+([a-z]+),?\s+(\d{4})$/i);
  if (match) {
    const isMonthFirst = MONTHS.has(match[1].toLowerCase());
    const month = MONTHS.get(String(isMonthFirst ? match[1] : match[2]).toLowerCase());
    const day = Number(isMonthFirst ? match[2] : match[1]);
    const year = Number(match[3]);
    const date = month ? strictDay(year, month, day, minYear, maxYear) : null;
    return date ? parsedResult(date, "day", date.toISOString().slice(0, 10)) : null;
  }

  return null;
}

export function normalizeDateValue(value) {
  return parseDateValue(value)?.isoDate || null;
}

// 레거시 엔진은 YYYY-MM·YYYY-Wnn 원본 grain으로 cadence를 판별한다. 검증은 같은
// strict parser로 하되, 일자는 ISO 날짜로 통일하고 월/주는 granularity를 보존한다.
export function normalizeDateLabel(value) {
  return parseDateValue(value)?.canonical || null;
}
