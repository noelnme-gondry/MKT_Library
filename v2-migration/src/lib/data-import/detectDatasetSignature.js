import { getWidePeriodColumns } from "./wideToLong";

// 헤더·행 형태만으로 데이터 출처/그레인을 보수적으로 추정한다.
// 확정 판정이 아니므로 UI는 항상 "추정"이라고 표시하고, 라우터의 보조 신호로만 쓴다.
const hasAny = (headers, words) => words.some((word) => headers.some((header) => header.includes(word)));

export function detectDatasetSignature(headers = [], rows = []) {
  const normalized = headers.map((header) => String(header).trim().toLowerCase());
  const hasDate = hasAny(normalized, ["date", "날짜", "일자", "day"]);
  const hasCampaign = hasAny(normalized, ["campaign", "캠페인"]);
  const hasCreative = hasAny(normalized, ["creative", "ad name", "광고 소재", "소재", "ad id"]);
  const hasGa4 = hasAny(normalized, ["event name", "event_count", "active users", "screen class"]);
  const hasMeta = hasAny(normalized, ["amount spent", "reach", "link clicks", "ad set"]);
  const hasGoogleAds = hasAny(normalized, ["cost", "impr.", "clicks", "campaign"]);
  const periodColumns = getWidePeriodColumns(headers).length;
  const firstRowsFilled = rows.slice(0, 10).map((row) => Object.values(row || {}).filter((value) => String(value || "").trim()).length);
  const avgFilled = firstRowsFilled.length ? firstRowsFilled.reduce((sum, value) => sum + value, 0) / firstRowsFilled.length : 0;

  let source = "generic";
  if (hasGa4) source = "ga4";
  else if (hasMeta) source = "meta_ads";
  else if (hasGoogleAds) source = "google_ads";

  const shape = periodColumns >= 2 && !hasDate ? "wide" : "long";
  const grain = hasCreative ? "creative_daily" : hasCampaign ? (hasDate ? "campaign_daily" : "campaign_summary") : hasDate ? "daily" : "unknown";
  const confidence = Math.min(0.95, Math.max(0.35, (hasDate ? 0.2 : 0) + (hasCampaign ? 0.2 : 0) + (hasCreative ? 0.2 : 0) + (source !== "generic" ? 0.25 : 0) + (avgFilled >= 3 ? 0.1 : 0)));

  return { source, shape, grain, confidence, needsWideToLong: shape === "wide", evidence: { hasDate, hasCampaign, hasCreative, periodColumns } };
}
