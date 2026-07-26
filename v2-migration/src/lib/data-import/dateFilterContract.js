export const DEFAULT_DATE_FILTER = Object.freeze({
  start: null,
  end: null,
  startInclusive: true,
  endInclusive: true,
  grain: "raw",
  timezone: "UTC",
});

function cleanDate(value) {
  if (value == null || String(value).trim() === "") return null;
  const text = String(value).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

export function normalizeDateFilter(input = {}) {
  const value = { ...DEFAULT_DATE_FILTER, ...(input || {}) };
  return {
    start: cleanDate(value.start),
    end: cleanDate(value.end),
    startInclusive: value.startInclusive !== false,
    endInclusive: value.endInclusive !== false,
    grain: String(value.grain || "raw"),
    timezone: String(value.timezone || "UTC"),
  };
}

export function dateFilterSignature(input = {}) {
  const filter = normalizeDateFilter(input);
  return [filter.start || "", filter.end || "", filter.startInclusive ? "1" : "0", filter.endInclusive ? "1" : "0", filter.grain, filter.timezone].join("|");
}

export function isDateInFilter(date, input = {}) {
  const value = cleanDate(date);
  if (!value) return false;
  const filter = normalizeDateFilter(input);
  const afterStart = !filter.start || (filter.startInclusive ? value >= filter.start : value > filter.start);
  const beforeEnd = !filter.end || (filter.endInclusive ? value <= filter.end : value < filter.end);
  return afterStart && beforeEnd;
}
