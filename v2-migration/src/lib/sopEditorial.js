// SOP의 출처·검수일 SSOT. 본문이 코드/JSON으로 나뉘어 있어도 같은 공개 근거를
// 화면·구조화 데이터·sitemap에서 재사용한다. URL은 운영 문서의 공식 원문만 쓴다.
const REVIEWED_AT = "2026-08-09";

const official = (url, ko, en) => ({ url, ko, en });

export const SOP_EDITORIAL = {
  "1-1": [
    official("https://dev.adjust.com/en/", "Adjust 개발자 문서", "Adjust developer documentation"),
    official("https://developer.apple.com/documentation/apptrackingtransparency", "Apple App Tracking Transparency", "Apple App Tracking Transparency"),
    official("https://developer.android.com/training/app-links", "Android App Links", "Android App Links"),
  ],
  "1-2": [
    official("https://developers.google.com/analytics/devguides/collection/ga4/reference/events", "Google Analytics 4 이벤트 참고", "Google Analytics 4 event reference"),
    official("https://firebase.google.com/docs/analytics/events", "Firebase Analytics 이벤트 문서", "Firebase Analytics event documentation"),
  ],
  "1-3": [
    official("https://dev.adjust.com/en/", "Adjust 포스트백·콜백 문서", "Adjust postback and callback documentation"),
    official("https://support.appsflyer.com/hc/en-us", "AppsFlyer 지원 문서", "AppsFlyer support documentation"),
  ],
  "1-4": [
    official("https://developer.apple.com/documentation/apptrackingtransparency", "Apple ATT 문서", "Apple ATT documentation"),
    official("https://developer.apple.com/documentation/storekit/skadnetwork", "Apple SKAdNetwork 문서", "Apple SKAdNetwork documentation"),
  ],
  "2-1": [
    official("https://support.google.com/google-ads/answer/6247380", "Google Ads 앱 캠페인 도움말", "Google Ads App campaigns help"),
    official("https://support.google.com/google-ads/", "Google Ads 고객센터", "Google Ads Help Center"),
  ],
  "2-2": [
    official("https://www.facebook.com/business/help", "Meta Business 도움말", "Meta Business Help Center"),
    official("https://www.facebook.com/business/ads-guide/", "Meta 광고 가이드", "Meta Ads Guide"),
  ],
  "2-3": [
    official("https://searchads.apple.com/help/", "Apple Search Ads 도움말", "Apple Search Ads Help"),
    official("https://searchads.apple.com/", "Apple Search Ads", "Apple Search Ads"),
  ],
  "2-4": [
    official("https://support.google.com/google-ads/", "Google Ads 리마케팅 도움말", "Google Ads remarketing help"),
    official("https://dev.adjust.com/en/", "Adjust 리어트리뷰션 문서", "Adjust reattribution documentation"),
  ],
  "3-1": [
    official("https://developer.apple.com/app-store/product-page/", "Apple App Store 제품 페이지 가이드", "Apple App Store product page guide"),
    official("https://support.google.com/googleplay/android-developer/", "Google Play Console 고객센터", "Google Play Console Help Center"),
  ],
  "3-2": [
    official("https://www.facebook.com/business/ads-guide/", "Meta 광고 규격 가이드", "Meta ad specifications guide"),
    official("https://support.google.com/google-ads/", "Google Ads 에셋 도움말", "Google Ads asset help"),
  ],
  "3-3": [
    official("https://www.facebook.com/business/ads-guide/", "Meta 동영상 광고 가이드", "Meta video ads guide"),
    official("https://support.google.com/google-ads/", "Google Ads 동영상 광고 도움말", "Google Ads video ads help"),
  ],
  "4-1": [
    official("https://support.google.com/analytics/", "Google Analytics 고객센터", "Google Analytics Help Center"),
    official("https://support.google.com/google-ads/", "Google Ads 측정 도움말", "Google Ads measurement help"),
  ],
  "4-2": [
    official("https://support.google.com/analytics/", "Google Analytics 코호트 참고", "Google Analytics cohort reference"),
    official("https://support.appsflyer.com/hc/en-us", "AppsFlyer 리텐션 참고", "AppsFlyer retention reference"),
  ],
  "4-3": [
    official("https://www.facebook.com/business/help", "Meta Conversion Lift 도움말", "Meta Conversion Lift help"),
    official("https://support.google.com/google-ads/", "Google Ads 증분 측정 도움말", "Google Ads incrementality help"),
  ],
  "8-1": [
    official("https://www.rfc-editor.org/rfc/rfc4180", "RFC 4180 CSV 형식", "RFC 4180 CSV format"),
    official("https://www.papaparse.com/", "Papa Parse 문서", "Papa Parse documentation"),
  ],
};

export function getSopEditorial(routeId, locale = "ko") {
  const sources = SOP_EDITORIAL[routeId];
  if (!sources) return null;
  return {
    reviewedAt: REVIEWED_AT,
    reviewer: locale === "en" ? "Growth Opt Playbook editorial review" : "Growth Opt Playbook 편집 검수",
    sources: sources.map((source) => ({ url: source.url, title: locale === "en" ? source.en : source.ko })),
  };
}

export function getSopLastModified(routeId) {
  return SOP_EDITORIAL[routeId] ? REVIEWED_AT : null;
}
