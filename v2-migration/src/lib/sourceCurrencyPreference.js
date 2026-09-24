// 원본 데이터 통화 기본값 — 업로드 직후 통화 선언을 묻지 않기 위한 한 곳의 규칙.
// 순서: 로그인 계정에 저장된 선택 → 이 브라우저에서 마지막으로 고른 통화 → 화면 언어
// (한국어 원, 그 밖은 달러). 값은 단위 선언일 뿐 환산이 아니므로 틀렸으면 사용자가
// 업로드 화면의 통화 버튼으로 바꾸고, 그 선택이 다음 기본값이 된다.

export const SOURCE_CURRENCIES = Object.freeze(["KRW", "USD"]);

export function normalizeSourceCurrency(value) {
  return SOURCE_CURRENCIES.includes(value) ? value : null;
}

export function localeDefaultSourceCurrency(locale) {
  return locale === "en" ? "USD" : "KRW";
}

export function defaultSourceCurrency({ remembered = null, locale = "ko" } = {}) {
  return normalizeSourceCurrency(remembered) || localeDefaultSourceCurrency(locale);
}

// 스토어는 locale을 모른다. 루트 문서가 <html lang>을 로케일로 찍으므로 거기서 읽는다.
export function documentLocale() {
  if (typeof document === "undefined") return "ko";
  return /^en\b/i.test(document.documentElement?.lang || "") ? "en" : "ko";
}
