import { DERIVED_METRICS, computeMetrics } from "@/utils/metrics/metricRegistry";
import { parseNumericStrict } from "@/utils/parseNumeric";
import { dateOrdinal } from "@/lib/analysisPeriod";

// 지표 목록·분자/분모 의존성은 기존 레지스트리에서 파생한다. 매출·고객 단위는
// 이 운영 CSV 근거 화면의 범위가 아니다. 계산기는 변경하지 않는다.
const INPUT_KEYS = new Set(["cost", "denom", "impressions", "clicks"]);
const METRICS = DERIVED_METRICS.filter(metric => metric.deps.every(key => INPUT_KEYS.has(key)));

function sourceHeaders(mapping, field) {
  const entries = Object.entries(mapping);
  const direct = entries.filter(([, key]) => key === field).map(([header]) => header);
  return field === "cost" && !direct.length
    ? entries.filter(([, key]) => key === "spend").map(([header]) => header) : direct;
}

function completeInput(rows, mapping, key) {
  const headers = sourceHeaders(mapping, key);
  let invalidCount = 0, total = 0;
  for (const row of rows) {
    const value = parseNumericStrict(row[key]);
    if (value == null || value < 0) invalidCount++;
    else total += value;
  }
  const reason = !headers.length ? "unmapped" : headers.length > 1 ? "conflict"
    : !rows.length ? "empty" : invalidCount || !Number.isFinite(total) ? "invalid" : null;
  return { key, headers, invalidCount, reason, total: reason ? null : total };
}

export function operationsInputEvidence({ rows, mapping = {}, period, metric = "installs" }) {
  const inPeriod = rows.filter(row => dateOrdinal(row.date) != null && row.date >= period.start && row.date <= period.end);
  const invalidDateCount = rows.filter(row => dateOrdinal(row.date) == null).length;
  const fieldFor = key => key === "denom" ? metric : key;
  const fields = [...new Set(METRICS.flatMap(item => item.deps.map(fieldFor)))];
  const inputs = fields.map(key => {
    const input = completeInput(inPeriod, mapping, key);
    return invalidDateCount ? { ...input, total: null, reason: "invalid_dates" } : input;
  });
  const byKey = Object.fromEntries(inputs.map(input => [input.key, input]));
  const aggregate = Object.fromEntries([...INPUT_KEYS].map(key => [key, byKey[fieldFor(key)].total]));
  const values = computeMetrics(aggregate, METRICS);
  const metrics = METRICS.map(item => {
    const dependencies = item.deps.map(key => byKey[fieldFor(key)]);
    const reason = invalidDateCount ? "invalid_dates" : dependencies.find(input => input.reason)?.reason
      || (values[item.id] == null ? dependencies.at(-1).total === 0 ? "zero_denominator" : "invalid" : null);
    return { id: item.id, unit: item.unit, dependencies, reason, value: reason ? null : values[item.id] };
  });
  return { inputs, metrics, invalidDateCount, observations: inPeriod.length, period, metric };
}
