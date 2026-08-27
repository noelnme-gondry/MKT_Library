const DAY_MS = 86_400_000;

function isoWeekMonday(year, week) {
  if (!(year >= 1900) || !(week >= 1 && week <= 53)) return null;
  const jan4 = Date.UTC(year, 0, 4);
  const jan4Day = new Date(jan4).getUTCDay() || 7;
  return jan4 - (jan4Day - 1) * DAY_MS + (week - 1) * 7 * DAY_MS;
}

function dateTimestamp(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.getTime();
  const text = String(value ?? "").trim();
  if (!text) return null;
  const isoWeek = text.match(/^(\d{4})\s*-?\s*W\s*(\d{1,2})$/i);
  if (isoWeek) return isoWeekMonday(Number(isoWeek[1]), Number(isoWeek[2]));
  const ymd = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/);
  if (ymd) {
    const year = Number(ymd[1]);
    const month = Number(ymd[2]);
    const day = Number(ymd[3]);
    const timestamp = Date.UTC(year, month - 1, day);
    const parsed = new Date(timestamp);
    return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
      ? timestamp
      : null;
  }
  // 순번형 Week(1, 2, 3...)를 Date.parse에 넘기면 2001년의 월로 오해한다.
  // 숫자만인 값은 날짜가 아니라 명시적인 week 역할에서 따로 처리한다.
  if (/^[+-]?\d+(?:\.\d+)?$/.test(text)) return null;
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function inferDateCadence(values = []) {
  const timestamps = [...new Set(values.map(dateTimestamp).filter(Number.isFinite))].sort((left, right) => left - right);
  const weeklyPeriodCount = new Set(timestamps.map((timestamp) => {
    const date = new Date(timestamp);
    const day = date.getUTCDay() || 7;
    return timestamp - (day - 1) * DAY_MS;
  })).size;
  if (timestamps.length < 2) return { cadence: "unknown", intervalDays: null, periodCount: timestamps.length, weeklyPeriodCount };
  const gaps = timestamps.slice(1).map((value, index) => Math.round((value - timestamps[index]) / DAY_MS)).filter((value) => value > 0);
  const intervalDays = median(gaps);
  let cadence = "irregular";
  if (intervalDays != null && intervalDays <= 3) cadence = "daily";
  else if (intervalDays != null && intervalDays >= 5 && intervalDays <= 9) cadence = "weekly";
  else if (intervalDays != null && intervalDays >= 25 && intervalDays <= 35) cadence = "monthly";
  return { cadence, intervalDays, periodCount: timestamps.length, weeklyPeriodCount };
}

export function inferMappedDateCadence({ raw = [], headers = [], mapping = {} } = {}) {
  const dateHeader = headers.find((header) => ["date", "iso_week_start", "week"].includes(mapping[header]));
  if (!dateHeader) return { cadence: "unknown", intervalDays: null, periodCount: 0, dateHeader: null };
  const values = raw.map((row) => row?.[dateHeader]);
  const inferred = inferDateCadence(values);
  if (mapping[dateHeader] === "week" && inferred.cadence === "unknown") {
    return {
      cadence: "weekly",
      intervalDays: 7,
      periodCount: new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean)).size,
      weeklyPeriodCount: new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean)).size,
      dateHeader,
    };
  }
  return { ...inferred, dateHeader };
}
