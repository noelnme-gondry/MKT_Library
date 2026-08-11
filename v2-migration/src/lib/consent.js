// Google Consent Mode v2 — EEA/UK 방문자에게는 동의 전까지 광고·분석 저장소를 막는다.
//
// 왜 region 방식인가: 이 앱은 서버가 없어 IP 지오로케이션을 할 수 없다. 대신 Consent
// Mode의 `region` 파라미터는 **Google이 자기 인프라에서 IP로 판정**하므로, 클라이언트가
// 위치를 추측하지 않고도 EEA에서만 기본 거부를 적용할 수 있다. 배너 노출 여부만
// 브라우저 타임존으로 추정하고(휴리스틱), 법적 게이트 자체는 region이 담당한다.
export const EEA_UK_REGIONS = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU",
  "IS", "IE", "IT", "LV", "LI", "LT", "LU", "MT", "NL", "NO", "PL", "PT", "RO",
  "SK", "SI", "ES", "SE", "GB", "CH",
];

export const CONSENT_STORAGE_KEY = "gop_consent_v1";

// EEA/UK 기본 거부 + 그 외 지역 허용. GTM·GA4 스크립트보다 먼저 실행돼야 의미가 있다.
export function consentDefaultSnippet() {
  const regions = JSON.stringify(EEA_UK_REGIONS);
  return `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',region:${regions},wait_for_update:500});
gtag('consent','default',{ad_storage:'granted',ad_user_data:'granted',ad_personalization:'granted',analytics_storage:'granted'});
try{var s=localStorage.getItem('${CONSENT_STORAGE_KEY}');if(s==='granted'){gtag('consent','update',{ad_storage:'granted',ad_user_data:'granted',ad_personalization:'granted',analytics_storage:'granted'});}else if(s==='denied'){gtag('consent','update',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied'});}}catch(e){}`;
}

// 배너 노출 대상 추정. 법적 차단은 위 region 기본값이 이미 처리하므로, 이 판정이
// 틀려도 EEA 사용자가 동의 없이 추적되지는 않는다(과소 노출 시 계측만 계속 거부됨).
const EEA_TZ_PREFIX = ["Europe/", "Atlantic/Canary", "Atlantic/Madeira", "Atlantic/Azores", "Atlantic/Reykjavik"];
export function looksEeaVisitor(timeZone, language) {
  const tz = String(timeZone || "");
  if (EEA_TZ_PREFIX.some((prefix) => tz.startsWith(prefix))) {
    // 러시아·터키 등 비EEA 유럽 타임존은 제외한다.
    if (/^Europe\/(Moscow|Istanbul|Kiev|Kyiv|Minsk|Volgograd|Samara|Saratov|Astrakhan|Ulyanovsk|Kirov)/.test(tz)) return false;
    return true;
  }
  return /^(en-GB|de|fr|it|es|nl|sv|da|fi|no|pl|pt|cs|el|hu|ro|sk|sl|bg|hr|et|lv|lt|ga|mt|is)\b/i.test(String(language || ""));
}

export function readStoredConsent() {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null;
  }
}

export function writeStoredConsent(value) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, value);
  } catch {
    // 저장소를 못 쓰면 이번 세션 선택만 적용된다(동의 자체는 gtag update로 전달됨).
  }
}

export function applyConsent(value) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  const granted = value === "granted";
  window.gtag("consent", "update", {
    ad_storage: granted ? "granted" : "denied",
    ad_user_data: granted ? "granted" : "denied",
    ad_personalization: granted ? "granted" : "denied",
    analytics_storage: granted ? "granted" : "denied",
  });
}
