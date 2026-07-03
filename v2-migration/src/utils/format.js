// ── Shared number / currency / percent formatting (design-system baseline) ──
// SSOT for all display formatting. Tools MUST use these instead of ad-hoc
// toLocaleString / manual currency strings (docs/design-system-baseline.md §1.1).
// Pure & deterministic (no Date/Math.random). Golden-tested (format.test.js).

const CURRENCY_SYMBOL = { KRW: "₩", USD: "$" };

// Currency: ₩ = 0 decimals, $ = 2 decimals. `precise` adapts small magnitudes
// (|v|<10 → 2 decimals) so sub-unit ARPU/LTV don't collapse to 0 (§7 LTV 함정).
export function fmtCurrency(value, opts = {}) {
  const { currency = "KRW", precise = false } = opts;
  if (value == null || !Number.isFinite(Number(value))) return "—";
  const v = Number(value);
  const sym = CURRENCY_SYMBOL[currency] || "₩";
  let digits = currency === "USD" ? 2 : 0;
  if (precise && Math.abs(v) < 10) digits = 2;
  return sym + v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

// Percent. `value` is a ratio by default (0.123 → "12.3%"); pass asRatio:false
// when the number is already in percent points (12.3 → "12.3%").
export function fmtPct(value, digits = 1, opts = {}) {
  const { asRatio = true } = opts;
  if (value == null || !Number.isFinite(Number(value))) return "—";
  const pct = asRatio ? Number(value) * 100 : Number(value);
  return pct.toFixed(digits) + "%";
}

// Plain number with thousands separators.
export function fmtNum(value, digits = 0) {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  return Number(value).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

// Compact Korean magnitude labels for dense axis ticks (1.2만 · 3.4억).
export function fmtCompact(value) {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  const v = Number(value);
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1e8) return sign + (abs / 1e8).toFixed(abs >= 1e9 ? 0 : 1) + "억";
  if (abs >= 1e4) return sign + (abs / 1e4).toFixed(abs >= 1e5 ? 0 : 1) + "만";
  return sign + abs.toLocaleString("en-US");
}

// Parse a possibly comma-formatted string → number, or null.
// Prevents parseFloat("72,341,057") === 72 (§7 함정). Read sites use this.
export function parseNum(str) {
  if (str == null) return null;
  const cleaned = String(str).replace(/[,\s₩$%]/g, "");
  if (cleaned === "") return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

export const CURRENCY_SYMBOLS = CURRENCY_SYMBOL;
