// MMM CSV values arrive as strings because PapaParse keeps dynamic typing off.
// Extract exactly one numeric token so currency/unit labels and thousands
// separators are accepted without concatenating unrelated fragments. The token
// grammar deliberately preserves scientific notation (`1.2E+06`).
const MMM_DAY_MS = 86400000;

// Excel's 1900-date-system serials must resolve to the same UTC calendar date in
// the main MMM, experiment evidence, and reference-country evidence. Keeping the
// accepted range narrow preserves ordinary numeric week indexes such as 1..104.
export function mmmExcelSerialDateTimestamp(value) {
  const text = String(value ?? "").trim();
  if (!/^\d{5}(?:\.\d+)?$/.test(text)) return null;
  const serial = Number(text);
  if (!(serial > 20000 && serial < 80000)) return null;
  // CSV MMM uses calendar-day grain. A fractional Excel serial is a time of
  // day, so rounding would incorrectly move Sunday evening into next Monday.
  return Date.UTC(1899, 11, 30) + Math.floor(serial) * MMM_DAY_MS;
}

export function mmmParseNumericValue(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  let text = String(value ?? "").trim();
  if (!text) return NaN;
  const parenthesizedNegative = /^\(.*\)$/.test(text);
  if (parenthesizedNegative) text = text.slice(1, -1).trim();
  const normalized = text.replace(/[,\s\u00a0]/g, "");
  const tokens = normalized.match(/[+-]?(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))(?:[eE][+-]?\d+)?/g);
  if (!tokens || tokens.length !== 1) return NaN;
  const token = tokens[0];
  let parsed = Number(token);
  if (!Number.isFinite(parsed)) return NaN;
  const trailing = normalized.slice(normalized.indexOf(token) + token.length);
  if (/^[kKmMbB]/.test(trailing)) {
    const compact = trailing.match(/^([kKmMbB])(?:krw|usd|eur|gbp|jpy|원)?$/i);
    if (!compact) return NaN;
    const multiplier = { k: 1e3, m: 1e6, b: 1e9 }[compact[1].toLowerCase()];
    parsed *= multiplier;
  } else if (/^(?:천|만|백만|억|thousand|million|billion)/i.test(trailing)) {
    const magnitude = trailing.match(/^(천|만|백만|억|thousand|million|billion)(?:krw|usd|eur|gbp|jpy|원)?$/i);
    if (!magnitude) return NaN;
    const multiplier = {
      "천": 1e3,
      "만": 1e4,
      "백만": 1e6,
      "억": 1e8,
      thousand: 1e3,
      million: 1e6,
      billion: 1e9,
    }[magnitude[1].toLowerCase?.() || magnitude[1]];
    parsed *= multiplier;
  }
  return parenthesizedNegative ? -Math.abs(parsed) : parsed;
}
