// EN 랜딩(§ en-landing) 사용자 언어 선택 기억 — localStorage 1개 키.
// 값이 있으면 언어 자동 감지를 건너뛴다(한 번 정하면 재이동 안 함).
// Plain module (no "use client") so it can be imported from any client component.
export const LOCALE_STORAGE_KEY = "mkt_locale_pref";

export function getLocalePref() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(LOCALE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setLocalePref(locale) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // localStorage 접근 불가(사파리 프라이빗 모드 등) — 조용히 무시, 자동감지만 매번 재평가됨
  }
}
