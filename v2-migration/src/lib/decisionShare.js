import { idToSlug } from "@/lib/routeMap";

// 결론 공유 링크 — 결론·근거·핵심 수치 "표시 문자열"만 URL에 담는다.
// 원본 행·업로드 파일·매핑·필터는 절대 포함하지 않는다(§2.2 클라이언트 사이드 100%).
// 전송 대상은 서버가 아니라 사용자가 직접 붙여넣는 링크이며, 앱은 어떤 것도 저장하지 않는다.
const SCHEMA_VERSION = 1;
const MAX_TOKEN_LENGTH = 4000;
const LIMITS = { headline: 240, point: 200, statLabel: 60, statValue: 60, points: 6, stats: 6 };

function plain(value, max) {
  if (typeof value !== "string" && typeof value !== "number") return "";
  return String(value).replace(/\s+/g, " ").trim().slice(0, max);
}

function base64UrlEncode(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(token) {
  const padded = token.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(token.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

// 입력 객체를 펼치지 않고 허용 필드만 새로 조립한다(금지 키가 흘러들 경로를 없앤다).
export function buildSharePayload({ toolId, toolTitle, headline, points = [], stats = [], locale = "ko" }) {
  const id = typeof toolId === "string" ? toolId : "";
  const line = plain(headline, LIMITS.headline);
  if (!id || !idToSlug[id] || !line) return null;
  return {
    v: SCHEMA_VERSION,
    t: id,
    n: plain(toolTitle, 80),
    h: line,
    p: points
      .map((item) => plain([item?.label, item?.text].filter(Boolean).join(" · "), LIMITS.point))
      .filter(Boolean)
      .slice(0, LIMITS.points),
    s: stats
      .map((item) => ({ l: plain(item?.label, LIMITS.statLabel), v: plain(item?.value, LIMITS.statValue) }))
      .filter((item) => item.l && item.v)
      .slice(0, LIMITS.stats),
    l: locale === "en" ? "en" : "ko",
  };
}

export function encodeSharePayload(input) {
  const payload = buildSharePayload(input || {});
  if (!payload) return null;
  const token = base64UrlEncode(JSON.stringify(payload));
  return token.length > MAX_TOKEN_LENGTH ? null : token;
}

export function decodeSharePayload(token) {
  if (typeof token !== "string" || !token || token.length > MAX_TOKEN_LENGTH) return null;
  try {
    const parsed = JSON.parse(base64UrlDecode(token));
    if (!parsed || parsed.v !== SCHEMA_VERSION) return null;
    // 재조립으로 디코드 결과도 허용 필드만 남긴다(변조된 토큰 방어).
    return buildSharePayload({
      toolId: parsed.t,
      toolTitle: parsed.n,
      headline: parsed.h,
      points: Array.isArray(parsed.p) ? parsed.p.map((text) => ({ text })) : [],
      stats: Array.isArray(parsed.s) ? parsed.s.map((item) => ({ label: item?.l, value: item?.v })) : [],
      locale: parsed.l,
    });
  } catch {
    return null;
  }
}

export function shareUrlFromPayload(token, locale = "ko", origin = "") {
  if (!token) return null;
  return `${origin}${locale === "en" ? "/en" : ""}/share?d=${token}`;
}

export function toolHrefForShare(payload) {
  if (!payload?.t) return null;
  const slug = idToSlug[payload.t];
  if (!slug) return null;
  return payload.l === "en" ? `/en${slug}` : slug;
}
