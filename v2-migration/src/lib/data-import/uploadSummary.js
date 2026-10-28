import { detectPlatformExport } from "@/lib/platformExports";

/**
 * 올린 파일 한 줄 요약 — 파일 이름 · 행 수 · 기간 · 확인된 내보내기 형식(product-ssot §1.1c 3단계).
 * 행 수는 원본 행, 기간은 정규화한 날짜(YYYY-MM-DD)의 처음과 끝이다. 날짜가 없으면 기간을 말하지 않는다.
 * 형식은 헤더가 확인된 내보내기(platformExports)와 전부 같을 때만 말한다.
 */
export function summarizeUpload({ fileName = "", raw = [], headers = [], canonicalData = null, locale = "ko" } = {}) {
  const en = locale === "en";
  const dates = (canonicalData?.records || []).map((record) => record?.date).filter((date) => typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)).sort();
  const platform = detectPlatformExport(headers);
  return {
    fileName,
    rows: en ? `${raw.length.toLocaleString("en-US")} ${raw.length === 1 ? "row" : "rows"}` : `${raw.length.toLocaleString("ko-KR")}행`,
    period: dates.length ? (dates[0] === dates.at(-1) ? dates[0] : `${dates[0]} – ${dates.at(-1)}`) : null,
    format: platform ? (en ? `${platform.platform.en} format` : `${platform.platform.ko} 형식`) : null,
  };
}
