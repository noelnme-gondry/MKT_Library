function median(values = []) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function percentile(values = [], p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  return lower === upper ? sorted[lower] : sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function metricProfile(records, key) {
  const values = records.map((record) => record.metrics?.[key]);
  const numeric = values.filter((value) => Number.isFinite(value));
  const nonZero = numeric.filter((value) => value !== 0);
  const mean = numeric.length ? numeric.reduce((sum, value) => sum + value, 0) / numeric.length : null;
  const variance = numeric.length && mean != null
    ? numeric.reduce((sum, value) => sum + (value - mean) ** 2, 0) / numeric.length
    : null;
  const q1 = numeric.length >= 4 ? percentile(numeric, 0.25) : null;
  const q3 = numeric.length >= 4 ? percentile(numeric, 0.75) : null;
  const iqr = q1 != null && q3 != null ? q3 - q1 : null;
  const outlierCount = iqr != null && iqr > 0
    ? numeric.filter((value) => value < q1 - 1.5 * iqr || value > q3 + 1.5 * iqr).length
    : 0;
  return {
    key,
    validCount: numeric.length,
    missingRate: values.length ? (values.length - numeric.length) / values.length : 1,
    zeroRate: numeric.length ? (numeric.length - nonZero.length) / numeric.length : 1,
    nonZeroCount: nonZero.length,
    coefficientOfVariation: mean && variance != null ? Math.sqrt(variance) / Math.abs(mean) : null,
    outlierCount,
  };
}

function buildPeriodStats(records) {
  const timestamps = [...new Set(records.map((record) => record.date).filter(Boolean))]
    .map((date) => Date.parse(`${date}T00:00:00Z`))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  const dayGaps = timestamps.slice(1).map((timestamp, index) => (timestamp - timestamps[index]) / 86400000);
  const expectedIntervalDays = median(dayGaps);
  const gapCount = expectedIntervalDays && dayGaps.length
    ? dayGaps.filter((gap) => gap > expectedIntervalDays * 1.5).length
    : 0;
  return { periodCount: timestamps.length, expectedIntervalDays, gapCount };
}

function buildChannelCoverage(records) {
  const periodsByChannel = new Map();
  records.forEach((record) => {
    const channel = record.dimensions?.channel;
    if (!channel || !record.date) return;
    if (!periodsByChannel.has(channel)) periodsByChannel.set(channel, new Set());
    periodsByChannel.get(channel).add(record.date);
  });
  return [...periodsByChannel.entries()]
    .map(([channel, periods]) => ({ channel, periodCount: periods.size }))
    .sort((a, b) => b.periodCount - a.periodCount || a.channel.localeCompare(b.channel));
}

// 공통 데이터 위생 신호. 도구별로 무엇을 막을지는 analysis-router 계약이 결정한다.
// 여기서는 사실(결측·연속성·변동성)을 계산만 하고, 브라우저 밖으로 데이터를 보내지 않는다.
export function buildDataQualityReport(canonicalData, { metricKeys, requiresDate = true } = {}) {
  const records = canonicalData?.records || [];
  const summary = canonicalData?.summary || {};
  const duplicateKeys = new Set();
  let duplicateCount = 0;
  let missingDateCount = 0;
  if (requiresDate) {
    records.forEach((record) => {
      if (!record.date) missingDateCount += 1;
      const key = JSON.stringify([record.date, record.dimensions]);
      if (duplicateKeys.has(key)) duplicateCount += 1;
      duplicateKeys.add(key);
    });
  }

  const allMetricKeys = [...new Set(records.flatMap((record) => Object.keys(record.metrics || {})))];
  const selectedMetricKeys = metricKeys?.length ? metricKeys : allMetricKeys;
  const metricStats = Object.fromEntries(allMetricKeys.map((key) => [key, metricProfile(records, key)]));
  const periodStats = requiresDate
    ? buildPeriodStats(records)
    : { periodCount: 0, expectedIntervalDays: null, gapCount: 0 };
  const issues = [];
  if (missingDateCount) issues.push({ code: "missing_date", count: missingDateCount });
  if (duplicateCount) issues.push({ code: "duplicates", count: duplicateCount });
  if (summary.invalidValueCount) issues.push({ code: "invalid_values", count: summary.invalidValueCount });
  if (periodStats.gapCount) issues.push({ code: "period_gaps", count: periodStats.gapCount });

  const highMissingFields = selectedMetricKeys.filter((key) => metricStats[key]?.validCount > 0 && metricStats[key].missingRate > 0.2);
  if (highMissingFields.length) issues.push({ code: "high_missing_rate", count: highMissingFields.length, fields: highMissingFields });
  const allZeroFields = selectedMetricKeys.filter((key) => metricStats[key]?.validCount > 0 && metricStats[key].zeroRate === 1);
  if (allZeroFields.length) issues.push({ code: "all_zero_metric", count: allZeroFields.length, fields: allZeroFields });
  const outlierFields = selectedMetricKeys.filter((key) => metricStats[key]?.outlierCount > 0);
  if (outlierFields.length) issues.push({ code: "outliers", count: outlierFields.length, fields: outlierFields });

  const grade = records.length === 0 || (requiresDate && missingDateCount === records.length) ? "unfit" : issues.length ? "caution" : "ready";
  return {
    grade,
    requiresDate,
    rowCount: records.length,
    periodCount: periodStats.periodCount,
    issues,
    periodStats,
    metricStats,
    channelCoverage: requiresDate ? buildChannelCoverage(records) : [],
  };
}
