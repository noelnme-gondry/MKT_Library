import { parseNumericStrict } from "./parseNumeric";
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
  // 판별 가능한 표기는 공유 규칙(utils/parseNumeric SSOT)이 먼저 읽는다. 콤마만
  // 벗기는 자체 해석은 유럽식 소수 구분자를 1,000배 축소한 채 통과시켰다
  // ("1.000,25" → 1.00025, 2026-09-16 감사). 공유 규칙이 못 읽는 나머지 —
  // MMM만 받는 압축 단위 접미사(1.2M · 5억 · 3천) — 만 아래 경로가 처리한다.
  const strict = parseNumericStrict(text);
  if (strict != null) return strict;
  const parenthesizedNegative = /^\(.*\)$/.test(text);
  if (parenthesizedNegative) text = text.slice(1, -1).trim();
  const normalized = text.replace(/[,\s\u00a0]/g, "");
  const tokens = normalized.match(/[+-]?(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))(?:[eE][+-]?\d+)?/g);
  if (!tokens || tokens.length !== 1) return NaN;
  const token = tokens[0];
  let parsed = Number(token);
  if (!Number.isFinite(parsed)) return NaN;
  const trailing = normalized.slice(normalized.indexOf(token) + token.length);
  // 여기까지 온 값은 공유 규칙이 이미 "못 읽겠다"고 판정한 것이다. 이 경로가
  // 받아도 되는 건 압축 단위 접미사가 붙은 경우뿐 — 접미사 없이 숫자만 남았다면
  // 그건 공유 규칙이 거부한 표기(유럽식 소수 구분자 등)이므로 다시 통과시키면
  // 단일화가 무의미해진다("1.000,25" → 1.00025로 되살아났다).
  let appliedMagnitude = false;
  if (/^[kKmMbB]/.test(trailing)) {
    const compact = trailing.match(/^([kKmMbB])(?:krw|usd|eur|gbp|jpy|원)?$/i);
    if (!compact) return NaN;
    const multiplier = { k: 1e3, m: 1e6, b: 1e9 }[compact[1].toLowerCase()];
    parsed *= multiplier;
    appliedMagnitude = true;
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
    appliedMagnitude = true;
  }
  if (!appliedMagnitude) return NaN;
  return parenthesizedNegative ? -Math.abs(parsed) : parsed;
}
