const FORECAST_TARGETS = new Set(["Traffic", "Regs", "React", "Purchasers", "Revenue"]);
const FORECAST_PLATFORMS = new Set(["all", "android", "ios"]);

function validDateParts(year, month, day) {
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? { timestamp, date }
    : null;
}

export function normalizeForecastPeriod(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
  }
  const text = String(value ?? "").trim();
  const full = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const short = text.match(/^(\d{2})-(\d{2})-(\d{2})$/);
  const parts = full
    ? [Number(full[1]), Number(full[2]), Number(full[3])]
    : short
      ? [2000 + Number(short[1]), Number(short[2]), Number(short[3])]
      : null;
  if (!parts || !validDateParts(...parts)) return "";
  return `${parts[0]}-${String(parts[1]).padStart(2, "0")}-${String(parts[2]).padStart(2, "0")}`;
}

export function forecastReviewDate(period, daysAfter = 7) {
  const normalized = normalizeForecastPeriod(period);
  if (!normalized) return "";
  const [year, month, day] = normalized.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + Math.max(0, Number(daysAfter) || 0)));
  return normalizeForecastPeriod(date);
}

function finiteNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const match = String(value ?? "").match(/[+-]?(?:\d[\d,\s]*)(?:\.\d+)?/);
  if (!match) return null;
  const number = Number(match[0].replace(/[,\s]/g, ""));
  return Number.isFinite(number) ? number : null;
}

export function createForecastReviewSnapshot({ forecast, target, platform = "all", sourceThrough } = {}) {
  const forecastTarget = FORECAST_TARGETS.has(target) ? target : "";
  const forecastPlatform = FORECAST_PLATFORMS.has(platform) ? platform : "";
  const forecastPeriod = normalizeForecastPeriod(forecast?.futLabels?.[0]);
  const forecastSourceThrough = normalizeForecastPeriod(sourceThrough);
  const forecastValue = finiteNumber(forecast?.predFut?.[0]);
  if (!forecastTarget || !forecastPlatform || !forecastPeriod || !Number.isFinite(forecastValue)) return null;
  const lower = finiteNumber(forecast?.lo?.[0]);
  const upper = finiteNumber(forecast?.hi?.[0]);
  return {
    comparisonKind: "forecast_actual",
    forecastPeriod,
    forecastTarget,
    forecastPlatform,
    forecastValue: String(forecastValue),
    forecastLower: Number.isFinite(lower) ? String(lower) : "",
    forecastUpper: Number.isFinite(upper) ? String(upper) : "",
    forecastSourceThrough,
  };
}

export function findForecastActualMatches(records = [], panel = null, platform = "all", activeTarget = "") {
  if (!Array.isArray(records) || !panel || !FORECAST_PLATFORMS.has(platform)) return [];
  const dates = Array.isArray(panel.dates) ? panel.dates.map(normalizeForecastPeriod) : [];
  if (!dates.length || dates.some((date) => !date)) return [];
  const dateIndexes = new Map(dates.map((date, index) => [date, index]));
  return records.flatMap((record) => {
    if (record?.toolId !== "5-18" || record.comparisonKind !== "forecast_actual" || String(record.actual || "").trim()) return [];
    if (record.forecastPlatform !== platform || !FORECAST_TARGETS.has(record.forecastTarget)) return [];
    if (activeTarget && record.forecastTarget !== activeTarget) return [];
    const predictedValue = finiteNumber(record.forecastValue);
    if (!Number.isFinite(predictedValue)) return [];
    const index = dateIndexes.get(normalizeForecastPeriod(record.forecastPeriod));
    const actualValue = index == null ? null : finiteNumber(panel.targets?.[record.forecastTarget]?.[index]);
    if (!Number.isFinite(actualValue)) return [];
    return [{
      recordId: record.id,
      reviewDate: record.reviewDate,
      action: record.action,
      period: normalizeForecastPeriod(record.forecastPeriod),
      target: record.forecastTarget,
      platform: record.forecastPlatform,
      predictedValue,
      lower: finiteNumber(record.forecastLower),
      upper: finiteNumber(record.forecastUpper),
      actualValue,
    }];
  });
}

export function assessForecastActual(record = {}) {
  if (record.comparisonKind !== "forecast_actual") return null;
  const predicted = finiteNumber(record.forecastValue);
  const actual = finiteNumber(record.actual);
  if (!Number.isFinite(predicted) || !Number.isFinite(actual)) return { state: "incomplete" };
  const lowerValue = finiteNumber(record.forecastLower);
  const upperValue = finiteNumber(record.forecastUpper);
  const hasRange = Number.isFinite(lowerValue) && Number.isFinite(upperValue);
  const lower = hasRange ? Math.min(lowerValue, upperValue) : null;
  const upper = hasRange ? Math.max(lowerValue, upperValue) : null;
  const delta = actual - predicted;
  return {
    state: hasRange ? (actual >= lower && actual <= upper ? "within_range" : "outside_range") : "point_only",
    predicted,
    actual,
    delta,
    errorPct: predicted === 0 ? null : delta / Math.abs(predicted),
    absolutePctError: predicted === 0 ? null : Math.abs(delta) / Math.abs(predicted),
    lower,
    upper,
  };
}
