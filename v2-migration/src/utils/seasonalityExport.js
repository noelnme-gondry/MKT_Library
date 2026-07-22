import { annotateCalendarPeriod } from "./seasonalityMath";

export function classifySeasonalitySource(value) {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return "unknown";
  if (/organic|오가닉|유기|natural|자연/.test(text)) return "organic";
  if (/paid|페이드|광고|유료|media|매체|google|meta|facebook|tiktok|apple|asa|adwords/.test(text)) return "paid";
  return "other";
}

export function buildRawIsoRows({ raw = [], headers = [], mapping = {}, grain = "month" } = {}) {
  const dateHeader = headers.find((header) => mapping[header] === "date");
  const sourceHeader = headers.find((header) => mapping[header] === "source");
  return raw.map((row) => {
    const period = dateHeader ? annotateCalendarPeriod(row[dateHeader], grain) : null;
    return {
      ...Object.fromEntries(headers.map((header) => [header, row[header] ?? ""])),
      iso_year: period?.year ?? "",
      iso_period: period?.isoLabel ?? "",
      iso_week: period?.sourceGrain === "day" || period?.sourceGrain === "week" ? period.bucket : "",
      iso_month: period?.month ?? (period?.sourceGrain === "month" ? period.bucket : ""),
      source_group: classifySeasonalitySource(sourceHeader ? row[sourceHeader] : ""),
    };
  });
}

export function buildGraphSheetRows(result, series, label, grain, getBucketLabel) {
  const seasonalByBucket = new Map((result?.seasonal || []).map((item) => [item.bucket, item]));
  return (result?.points || []).map((point) => {
    const seasonal = seasonalByBucket.get(point.bucket);
    const yearMean = result.yearMean?.get(point.year);
    return {
      series,
      series_label: label,
      year: point.year,
      bucket: point.bucket,
      period_label: getBucketLabel(point.bucket, grain),
      actual_value: point.value,
      trend_baseline: point.trend,
      detrend_index_pct: point.trend > 0 ? (point.value / point.trend) * 100 : "",
      year_mean: yearMean ?? "",
      yearmean_index_pct: yearMean > 0 ? (point.value / yearMean) * 100 : "",
      seasonal_index_pct: seasonal?.index ?? "",
      seasonal_delta_pct: seasonal?.delta ?? "",
      sample_count: seasonal?.n ?? 0,
    };
  });
}
