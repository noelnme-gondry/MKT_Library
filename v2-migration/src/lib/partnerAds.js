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
  "site-rail": { provider: "coupang", ko: "오른쪽 또는 분석 본문 뒤 광고", en: "Ad beside or after the analysis content", formats: ["rail", "compact"] },
  "home-intro": { provider: "coupang", ko: "홈 소개 아래 광고", en: "Ad below the home introduction", formats: ["wide", "compact"] },
  "blog-byline": { provider: "coupang", ko: "블로그 작성자 아래 광고", en: "Ad below the article byline", formats: ["wide", "compact"] },
  "analysis-bottom": { provider: "coupang", ko: "분석 결과 아래 광고", en: "Ad below the analysis results", formats: ["wide", "compact"] },
  "page-bottom": { provider: "coupang", ko: "페이지 하단 광고", en: "Bottom of page ad", formats: ["wide", "compact"] },
});

// 광고 송출/클릭이 아니라 영역 도달이다. 원본 입력이나 전역 측정 버전은 받지 않는다.
export function partnerAdEventParams(params = {}) {
  const { ad_slot: slot, ad_format: format, locale } = params;
  const path = typeof params.page_path === "string" ? params.page_path.split(/[?#]/)[0] : "";
  if (!Object.hasOwn(PARTNER_AD_PLACEMENTS, slot) || !PARTNER_AD_PLACEMENTS[slot].formats.includes(format)
    || !["ko", "en"].includes(locale) || !path.startsWith("/") || path.startsWith("//")) return null;
  return { ad_provider: PARTNER_AD_PLACEMENTS[slot].provider, ad_slot: slot, ad_format: format, locale, page_path: path, ad_measurement_version: 1 };
}

export function partnerAdFormat(placement, availableWidth) {
  if (!Number.isFinite(availableWidth)) return null;
  return PARTNER_AD_PLACEMENTS[placement]?.formats.find(key => PARTNER_AD_FORMATS[key].width <= availableWidth) || null;
}

// 홈에서만 지면을 넓힌다. 선택한 프레임과 위젯이 같은 실제 크기를 사용한다.
export function partnerAdDimensions(format, { placement, availableWidth, isHome = false } = {}) {
  if (!Object.hasOwn(PARTNER_AD_FORMATS, format)) return null;
  const { width, height } = PARTNER_AD_FORMATS[format];
  if (format === "wide" && placement === "home-intro" && Number.isFinite(availableWidth) && availableWidth >= width) {
    return { width: Math.min(1600, Math.floor(availableWidth)), height: 140 };
  }
  if (format === "rail" && isHome) return { width, height: 800 };
  return { width, height };
}

// 본문 폭이 모자랄 때만 compact에 필요한 여백을 빌린다. 소재를 축소하지 않는다.
export function partnerAdInlineLayout({ contentLeft, contentWidth, safeLeft, safeRight, preferredWidth = contentWidth, maxWidth = Infinity }) {
  const safeWidth = Math.max(0, safeRight - safeLeft);
  const width = Math.max(0, Math.min(safeWidth, maxWidth, Math.max(preferredWidth, PARTNER_AD_FORMATS.compact.width)));
  const left = Math.max(safeLeft, Math.min(contentLeft + (contentWidth - width) / 2, safeRight - width));
  return { width, marginLeft: left - contentLeft };
}

export function partnerAdRailFormat(pathname, availableWidth) {
  if (!Number.isFinite(availableWidth)) return null;
  if (availableWidth >= PARTNER_AD_RAIL_MIN_WIDTH) return "rail";
  return pageAdPlacement(pathname) === "analysis-bottom" && availableWidth >= PARTNER_AD_FORMATS.compact.width ? "compact" : null;
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
