import { normalizeDateValue, normalizeNumericValue } from "./normalizeValues";

const SAMPLE_LIMIT = 500;

export function profileColumns(headers = [], rows = []) {
  const sample = rows.slice(0, SAMPLE_LIMIT);
  return headers.map((header) => {
    const values = sample.map((row) => row?.[header]).filter((value) => value != null && String(value).trim() !== "");
    const numeric = values.map(normalizeNumericValue).filter(Boolean);
    const dates = values.map(normalizeDateValue).filter(Boolean);
    const percentCount = numeric.filter((entry) => entry.isPercent).length;
    const uniqueCount = new Set(values.map((value) => String(value).trim())).size;
    const count = values.length;
    return {
      header,
      sampleValues: values.slice(0, 3).map((value) => String(value)),
      nonEmptyCount: count,
      missingRate: sample.length ? (sample.length - count) / sample.length : 1,
      uniqueCount,
      numericRate: count ? numeric.length / count : 0,
      dateRate: count ? dates.length / count : 0,
      percentRate: count ? percentCount / count : 0,
      inferredType: dates.length / Math.max(count, 1) >= 0.8 ? "date" : numeric.length / Math.max(count, 1) >= 0.8 ? (percentCount / Math.max(count, 1) >= 0.5 ? "percent" : "number") : "string",
    };
  });
}
