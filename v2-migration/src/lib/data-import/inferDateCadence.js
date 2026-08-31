import { parseDateValue } from "./normalizeValues";

const DAY_MS = 86_400_000;

function dateTimestamp(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.getTime();
  const text = String(value ?? "").trim();
  if (!text) return null;
  // 순번형 Week(1, 2, 3...)는 날짜가 아니라 명시적인 week 역할에서 따로 처리한다.
  if (/^[+-]?\d+(?:\.\d+)?$/.test(text)) return null;
  return parseDateValue(text, { minYear: 1900, maxYear: 2200 })?.date.getTime() ?? null;
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
