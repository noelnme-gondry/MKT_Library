import { resolvePathToId } from "./routeMap";
import { isAnalyticsHost } from "./analyticsHost";
import { looksEeaVisitor, readStoredConsent } from "./consent";

// 사용자가 발급한 배너 ID와 제작 규격. 로컬에서는 외부 광고를 호출하지 않는다.
export const PARTNER_AD_FORMATS = Object.freeze({
  rail: { id: 1039165, width: 160, height: 600 },
  wide: { id: 1039166, width: 728, height: 90 },
  compact: { id: 1039167, width: 320, height: 100 },
});
export const PARTNER_TRACKING_CODE = "AF3219545";
export const PARTNER_AD_DISCLOSURE = {
  ko: "이 페이지는 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.",
  en: "This page contains Coupang Partners affiliate ads. We may receive a commission from qualifying purchases.",
};

export function partnerAdMode({ hostname, environment, consent, needsConsent }) {
  if (consent === "denied" || (needsConsent && consent !== "granted")) return "off";
  if (isAnalyticsHost(hostname)) return "live";
  return environment === "development" ? "preview" : "off";
}

// 렌더와 전송 직전 검사가 같은 동의·호스트 계약을 사용한다.
export function currentPartnerAdMode() {
  if (typeof window === "undefined") return "off";
  let timeZone = "";
  try { timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch { /* 언어 폴백 */ }
  return partnerAdMode({ hostname: window.location.hostname, environment: process.env.NODE_ENV, consent: readStoredConsent(), needsConsent: looksEeaVisitor(timeZone, navigator.language) });
}
export const PARTNER_AD_RAIL_MIN_WIDTH = 1180;
export const PARTNER_AD_PLACEMENTS = Object.freeze({
  "site-rail": { ko: "오른쪽 세로 광고", en: "Right sidebar ad", formats: ["rail"] },
  "home-intro": { ko: "홈 소개 아래 광고", en: "Ad below the home introduction", formats: ["wide", "compact"] },
  "blog-byline": { ko: "블로그 작성자 아래 광고", en: "Ad below the article byline", formats: ["wide", "compact"] },
  "analysis-bottom": { ko: "분석 결과 아래 광고", en: "Ad below the analysis results", formats: ["wide", "compact"] },
  "page-bottom": { ko: "페이지 하단 광고", en: "Bottom of page ad", formats: ["wide", "compact"] },
});

// 광고 송출/클릭이 아니라 영역 도달이다. 원본 입력이나 전역 측정 버전은 받지 않는다.
export function partnerAdEventParams(params = {}) {
  const { ad_slot: slot, ad_format: format, locale } = params;
  const path = typeof params.page_path === "string" ? params.page_path.split(/[?#]/)[0] : "";
  if (!Object.hasOwn(PARTNER_AD_PLACEMENTS, slot) || !PARTNER_AD_PLACEMENTS[slot].formats.includes(format)
    || !["ko", "en"].includes(locale) || !path.startsWith("/") || path.startsWith("//")) return null;
  return { ad_provider: "coupang", ad_slot: slot, ad_format: format, locale, page_path: path, ad_measurement_version: 1 };
}

export function partnerAdFormat(placement, availableWidth) {
  if (!Number.isFinite(availableWidth)) return null;
  return PARTNER_AD_PLACEMENTS[placement]?.formats.find(key => PARTNER_AD_FORMATS[key].width <= availableWidth) || null;
}

export function isAnalysisAdRoute(routeId) {
  return routeId === "dochi-result" || /^(5-|9-)/.test(routeId || "");
}

export function pageAdPlacement(pathname) {
  const path = (pathname || "/").replace(/^\/en(?=\/|$)/, "").replace(/\/$/, "") || "/";
  if (path === "/") return "home-intro";
  if (/^\/blog\/[^/]+$/.test(path)) return "blog-byline";
  if (isAnalysisAdRoute(resolvePathToId(path))) return "analysis-bottom";
  return "page-bottom";
}
