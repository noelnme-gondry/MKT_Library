import { SAT_CONFIG, SAT_MATH, satActiveVerdict, satBuildPoints } from "@/utils/satMath";
import { csvBody } from "@/utils/download";

// Same selected input, disjoint chronological halves. No random split or causal claim.
export function splitObservationPeriods(rows) {
  const valid = rows.filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(String(row.date)) && Number.isFinite(Date.parse(row.date)));
  const dates = [...new Set(valid.map((row) => row.date))].sort();
  const split = Math.floor(dates.length / 2);
  return [dates.slice(0, split), dates.slice(split)].map((periodDates) => {
    const included = new Set(periodDates);
    return { start: periodDates[0] || "", end: periodDates.at(-1) || "", rows: valid.filter((row) => included.has(row.date)) };
  });
}

export function comparePeriodDirections(before, after) {
  return [...new Set([...before.keys(), ...after.keys()])].sort().map((name) => {
    const a = before.get(name), b = after.get(name);
    const comparable = a?.direction && b?.direction && Number.isFinite(a.min) && Number.isFinite(b.min)
      && Math.max(a.min, b.min) < Math.min(a.max, b.max);
    return { name, before: a || {}, after: b || {}, status: !comparable ? "unavailable" : a.direction === b.direction ? "stable" : "changed" };
  });
}

export function saturationPeriodSensitivity(rows, { grain, metricField, revField, metric }) {
  const periods = splitObservationPeriods(rows);
  const results = periods.map((period) => new Map([...satBuildPoints(period.rows, grain, metricField, revField)].map(([name, points]) => {
    const result = SAT_MATH.analyzeEntity(points, SAT_CONFIG);
    return [name, { direction: satActiveVerdict(result, metric), n: result.n, min: result.xMin, max: result.xMax }];
  })));
  return { periods: periods.map(({ start, end }) => ({ start, end })), rows: comparePeriodDirections(...results) };
}

export function periodSensitivityCsv(result) {
  return csvBody(["entity", "status", "before_start", "before_end", "after_start", "after_end", "before_direction", "after_direction", "before_n", "after_n", "before_min_daily_spend", "before_max_daily_spend", "after_min_daily_spend", "after_max_daily_spend"], result.rows.map((row) => [row.name, row.status, result.periods[0].start, result.periods[0].end, result.periods[1].start, result.periods[1].end, row.before.direction, row.after.direction, row.before.n, row.after.n, row.before.min, row.before.max, row.after.min, row.after.max]));
}
