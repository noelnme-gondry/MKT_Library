// ── Shared number / currency / percent formatting (design-system baseline) ──
// SSOT for all display formatting. Tools MUST use these instead of ad-hoc
// toLocaleString / manual currency strings (docs/design-system-baseline.md §1.1).
// Pure & deterministic (no Date/Math.random). Golden-tested (format.test.js).

const CURRENCY_SYMBOL = { KRW: "₩", USD: "$" };

// CSV의 금액 숫자는 통화 코드를 품지 않는다. 업로드 때 사용자가 선언한 원본
// 통화만 신뢰하고, 없을 때에만 호출자가 명시한 fallback을 쓴다. 효율 도구는
// 숫자를 환산하지 않으므로 화면 포맷·엔진 step 모두 이 원본 통화를 사용한다.
export function sourceCurrencyOf(csvData, fallback = null) {
  const currency = csvData?.currency;
  return CURRENCY_SYMBOL[currency] ? currency : fallback;
}

// 고정 환율(결정론 — 실시간 조회 없음, §3). 대략적 기준값, 정밀 회계용 아님 —
// CSV 업로드 시 사용자가 지정한 원본 통화(csvData.currency)와 표시 토글
// (displayCurrency)이 다를 때 표시 단위를 바꿔주는 용도.
//
// 이 값이 화면에 고지되지 않으면 §8 "거짓 숫자"가 된다: 사용자는 환산값을 실제
// 시세로 읽는다. 게다가 5-18 예측의 예산 입력은 표시 통화로 받아 이 환율로
// 되돌려 엔진에 넣으므로 표시만의 문제도 아니다. 환산이 실제로 일어나는
// 화면에서는 `ds/FixedRateNote`가 이 상수를 그대로 고지한다 — 상수를 바꾸면
// 고지 문구도 함께 바뀌도록 여기서만 정의한다.
export const USD_KRW_RATE = 1400;

// 환산이 실제로 일어나는가(= 고지가 필요한가). from/to 중 하나라도 비었거나
// 같으면 convertCurrency가 no-op이므로 고지할 것도 없다.
export function isCurrencyConverted(from, to) {
  return Boolean(from && to && from !== to && CURRENCY_SYMBOL[from] && CURRENCY_SYMBOL[to]);
}

// value가 `from` 통화로 기록된 원본이라 가정하고 `to` 통화 표시값으로 변환.
// from===to면 그대로(불필요한 변환 오차 방지). from/to 미지정·동일 문자열이면 no-op.
export function convertCurrency(value, from, to) {
  if (value == null || !Number.isFinite(Number(value))) return value;
  if (!from || !to || from === to) return value;
  const v = Number(value);
  if (from === "KRW" && to === "USD") return v / USD_KRW_RATE;
  if (from === "USD" && to === "KRW") return v * USD_KRW_RATE;
  return v;
}

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
