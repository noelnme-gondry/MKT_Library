const VALID_AGGREGATIONS = new Set(["sum", "mean", "weighted_mean", "ratio", "last", "custom"]);

function clean(value) {
  return value == null ? "" : String(value).trim();
}

export function buildMetricContract({
  key,
  label = "",
  numerator = "",
  denominator = "",
  unit = "",
  currency = "",
  timeBasis = "calendar",
  aggregation = "custom",
  zeroDenominatorPolicy = "undefined",
} = {}) {
  const metric = {
    key: clean(key),
    label: clean(label || key),
    numerator: clean(numerator),
    denominator: clean(denominator),
    unit: clean(unit),
    currency: clean(currency),
    timeBasis: clean(timeBasis),
    aggregation: clean(aggregation),
    zeroDenominatorPolicy: clean(zeroDenominatorPolicy),
  };
  const errors = [];
  if (!metric.key) errors.push("missing_key");
  if (!metric.label) errors.push("missing_label");
  if (!VALID_AGGREGATIONS.has(metric.aggregation)) errors.push("invalid_aggregation");
  if (!metric.timeBasis) errors.push("missing_time_basis");
  if (!metric.zeroDenominatorPolicy) errors.push("missing_zero_denominator_policy");
  return { ...metric, valid: errors.length === 0, errors };
}

export function buildMetricContracts(metrics = []) {
  const list = Array.isArray(metrics) ? metrics : [];
  const contracts = list.map(buildMetricContract);
  const keys = new Set();
  const duplicateKeys = [];
  for (const metric of contracts) {
    if (keys.has(metric.key)) duplicateKeys.push(metric.key);
    keys.add(metric.key);
  }
  return {
    contracts,
    valid: contracts.every((metric) => metric.valid) && duplicateKeys.length === 0,
    duplicateKeys,
  };
}

export const METRIC_AGGREGATIONS = [...VALID_AGGREGATIONS];
