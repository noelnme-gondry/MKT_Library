import { normalizeDateValue, normalizeNumericValue } from "../normalizeValues";

const compactHeader = (value) => String(value || "")
  .normalize("NFKC")
  .trim()
  .replace(/([a-z])([A-Z])/g, "$1 $2")
  .toLowerCase();

export function headerFeatures(header) {
  const normalized = compactHeader(header);
  const tokens = normalized.split(/[\s_-]+/).filter(Boolean);
  const ngrams = new Set();
  const joined = tokens.join("");
  for (let size = 2; size <= 5; size += 1) {
    for (let index = 0; index <= joined.length - size; index += 1) ngrams.add(joined.slice(index, index + size));
  }
  const windowMatch = normalized.match(/(?:^|[\s_-])d(\d{1,3})(?:$|[\s_-])/i) || normalized.match(/(?:revenue|ret|pu)[\s_-]?(\d{1,3})/i);
  return { normalized, tokens, ngrams: [...ngrams], windowDay: windowMatch ? Number(windowMatch[1]) : null };
}

const quantile = (values, percentile) => {
  if (!values.length) return null;
  const position = (values.length - 1) * percentile;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return lower === upper ? values[lower] : values[lower] + (values[upper] - values[lower]) * (position - lower);
};

function numericSummary(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mean = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
  const variance = sorted.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / sorted.length;
  return {
    min: sorted[0], max: sorted.at(-1), mean, standardDeviation: Math.sqrt(variance),
    p01: quantile(sorted, 0.01), p25: quantile(sorted, 0.25), p50: quantile(sorted, 0.5), p75: quantile(sorted, 0.75), p99: quantile(sorted, 0.99),
  };
}

function inferType({ count, numericCount, dateCount, booleanCount, uniqueCount }) {
  if (!count) return "empty";
  if (dateCount / count >= 0.8) return "date";
  if (booleanCount / count >= 0.8) return "boolean";
  if (numericCount / count >= 0.8) return "number";
  if (uniqueCount / count <= 0.2) return "enum";
  return "string";
}

export function profileColumnV2(header, sampledRows = []) {
  const values = sampledRows.map((row) => row?.[header]).filter((value) => value != null && String(value).trim() !== "");
  const textValues = values.map((value) => String(value).trim());
  const numeric = textValues.map(normalizeNumericValue).filter(Boolean);
  const numericValues = numeric.map((entry) => entry.value).filter(Number.isFinite);
  const dateCount = textValues.filter((value) => Boolean(normalizeDateValue(value))).length;
  const booleanCount = textValues.filter((value) => /^(true|false|yes|no|y|n|0|1|예|아니오)$/i.test(value)).length;
  const uniqueCount = new Set(textValues).size;
  const count = textValues.length;
  const currencyLikeCount = textValues.filter((value) => /[₩$€£¥]|\b(?:krw|usd|eur|jpy)\b/i.test(value)).length;
  const percentLikeCount = numeric.filter((entry) => entry.isPercent).length;
  const nonNegativeCount = numericValues.filter((value) => value >= 0).length;
  const integerCount = numericValues.filter(Number.isInteger).length;
  const increasingPairs = numericValues.slice(1).filter((value, index) => value >= numericValues[index]).length;
  const averageLength = count ? textValues.reduce((sum, value) => sum + value.length, 0) / count : 0;

  return {
    header,
    headerFeatures: headerFeatures(header),
    sampleSize: sampledRows.length,
    nonEmptyCount: count,
    missingRate: sampledRows.length ? (sampledRows.length - count) / sampledRows.length : 1,
    uniqueRate: count ? uniqueCount / count : 0,
    inferredType: inferType({ count, numericCount: numericValues.length, dateCount, booleanCount, uniqueCount }),
    rates: {
      numeric: count ? numericValues.length / count : 0,
      date: count ? dateCount / count : 0,
      boolean: count ? booleanCount / count : 0,
      currencyLike: count ? currencyLikeCount / count : 0,
      percentLike: count ? percentLikeCount / count : 0,
      nonNegative: numericValues.length ? nonNegativeCount / numericValues.length : 0,
      integer: numericValues.length ? integerCount / numericValues.length : 0,
      nonDecreasing: numericValues.length > 1 ? increasingPairs / (numericValues.length - 1) : 0,
    },
    cardinality: uniqueCount <= 12 ? "low" : uniqueCount / Math.max(count, 1) >= 0.8 ? "high" : "medium",
    averageLength,
    numeric: numericSummary(numericValues),
  };
}
