// Action survival / drop-off engine. This is deliberately an episode-level,
// non-parametric engine: it estimates observed survival timing, not individual
// drop-off probabilities or causal effects.
import { _Z975, chi2Cdf } from "./statPrimitives";

const EVENT_VALUES = new Map([
  [0, 0], [1, 1], ["0", 0], ["1", 1],
]);
const UTC_DAY_MS = 24 * 60 * 60 * 1000;
const DATE_PERIOD_DAYS = { day: 1, week: 7 };

function finiteNumber(value) {
  if (typeof value === "string" && value.trim() === "") return null;
  const number = typeof value === "string" ? Number(value.replaceAll(",", "").trim()) : Number(value);
  return Number.isFinite(number) ? number : null;
}

function eventValue(value) {
  if (typeof value === "string") return EVENT_VALUES.get(value.trim()) ?? null;
  return EVENT_VALUES.get(value) ?? null;
}

function safeProbability(value) {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : null;
}

function rowValue(row, key, fallback) {
  if (Object.prototype.hasOwnProperty.call(row || {}, key)) return row[key];
  return fallback ? row?.[fallback] : undefined;
}

function hasValue(value) {
  return value != null && String(value).trim() !== "";
}

/**
 * Parses a calendar date into a UTC midnight timestamp. Date-only values are
 * deliberately read as calendar components rather than through local time, so
 * a viewer's timezone cannot move an episode into the previous or next day.
 */
export function parseSubscriptionUtcDate(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
  }
  if (!hasValue(value)) return null;
  const match = String(value).trim().match(/^(\d{4})(?:[./-]?)(\d{2})(?:[./-]?)(\d{2})(?:$|[T\s])/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  if (year < 2000 || year > 2100 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return timestamp;
}

/**
 * Converts elapsed UTC calendar days to the discrete analysis period. A
 * partial week/month belongs to the renewal interval it occurs in; zero-day
 * events remain zero rather than being silently moved to the first period.
 */
export function subscriptionDatePeriods(startDate, endDate, timeUnit = "month") {
  const start = parseSubscriptionUtcDate(startDate);
  const end = parseSubscriptionUtcDate(endDate);
  if (start == null || end == null || end < start) return null;
  const elapsedDays = (end - start) / UTC_DAY_MS;
  if (elapsedDays === 0) return 0;
  if (timeUnit === "month") {
    const startDateUtc = new Date(start);
    const endDateUtc = new Date(end);
    const elapsedMonths = (endDateUtc.getUTCFullYear() - startDateUtc.getUTCFullYear()) * 12
      + endDateUtc.getUTCMonth() - startDateUtc.getUTCMonth();
    const monthEnd = (year, month) => new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const addClampedMonths = (months) => {
      const monthIndex = startDateUtc.getUTCMonth() + months;
      const year = startDateUtc.getUTCFullYear() + Math.floor(monthIndex / 12);
      const month = (monthIndex % 12 + 12) % 12;
      return Date.UTC(year, month, Math.min(startDateUtc.getUTCDate(), monthEnd(year, month)));
    };
    // A calendar renewal on the last day of a shorter month is one full month
    // (Jan 31 → Feb 28), unlike an average-day approximation.
    const wholeMonths = addClampedMonths(elapsedMonths) <= end ? elapsedMonths : elapsedMonths - 1;
    return wholeMonths + (addClampedMonths(wholeMonths) === end ? 0 : 1);
  }
  const daysPerPeriod = DATE_PERIOD_DAYS[timeUnit];
  if (!daysPerPeriod) return null;
  return Math.ceil(elapsedDays / daysPerPeriod);
}

/**
 * Validates records without silently turning invalid values into zero. The
 * returned rows use one stable internal contract shared by every calculation.
 */
export function normalizeSurvivalRows(rows = [], options = {}) {
  const timeKey = options.timeKey || "tenure_periods";
  const eventKey = options.eventKey || "event_observed";
  const entryKey = options.entryKey || "entry_period";
  const validRows = [];
  const excludedRows = [];
  const exclusionsByReason = {};

  (Array.isArray(rows) ? rows : []).forEach((row, index) => {
    const time = finiteNumber(rowValue(row, timeKey, "tenure"));
    const event = eventValue(rowValue(row, eventKey, "event"));
    const hasEntry = rowValue(row, entryKey, "entry") != null && String(rowValue(row, entryKey, "entry")).trim() !== "";
    const entry = hasEntry ? finiteNumber(rowValue(row, entryKey, "entry")) : 0;
    let reason = null;
    if (!(time >= 0)) reason = "invalid_tenure";
    else if (event == null) reason = "invalid_event_observed";
    else if (!(entry >= 0) || entry > time) reason = "invalid_entry_period";
    if (reason) {
      excludedRows.push({ index, row, reason });
      exclusionsByReason[reason] = (exclusionsByReason[reason] || 0) + 1;
      return;
    }
    validRows.push({
      time,
      event,
      entry,
      segment: rowValue(row, options.segmentKey || "segment"),
      cac: finiteNumber(rowValue(row, options.cacKey || "cac")),
      source: row,
    });
  });

  const eventCount = validRows.filter((row) => row.event === 1).length;
  return {
    validRows,
    excludedRows,
    exclusionsByReason,
    timeUnit: options.timeUnit || "month",
    eventCount,
    censoredCount: validRows.length - eventCount,
    leftTruncatedCount: validRows.filter((row) => row.entry > 0).length,
  };
}

/**
 * Date-input adapter for one row per subscription episode. A churn date means
 * the event is observed; without one, the row is censored at its row-level or
 * explicitly supplied observation end date. Invalid dates remain excluded
 * with a reason—never converted to a zero-duration episode.
 */
export function normalizeDateSurvivalRows(rows = [], options = {}) {
  const startKey = options.startKey || "subscription_start_date";
  const churnKey = options.churnKey || "churn_date";
  const observationEndKey = options.observationEndKey || "observation_end_date";
  const entryKey = options.entryKey || "entry_period";
  const validRows = [];
  const excludedRows = [];
  const exclusionsByReason = {};
  const globalObservationEnd = hasValue(options.observationEndDate)
    ? parseSubscriptionUtcDate(options.observationEndDate)
    : null;

  (Array.isArray(rows) ? rows : []).forEach((row, index) => {
    const startRaw = rowValue(row, startKey, "start_date");
    const churnRaw = rowValue(row, churnKey);
    const rowObservationRaw = rowValue(row, observationEndKey);
    const start = parseSubscriptionUtcDate(startRaw);
    const hasChurn = hasValue(churnRaw);
    const churn = hasChurn ? parseSubscriptionUtcDate(churnRaw) : null;
    const hasRowObservationEnd = hasValue(rowObservationRaw);
    const rowObservationEnd = hasRowObservationEnd ? parseSubscriptionUtcDate(rowObservationRaw) : null;
    const end = hasChurn ? churn : rowObservationEnd ?? globalObservationEnd;
    const entryRaw = rowValue(row, entryKey, "entry");
    const entry = hasValue(entryRaw) ? finiteNumber(entryRaw) : 0;
    let reason = null;
    if (start == null) reason = "invalid_subscription_start_date";
    else if (hasChurn && churn == null) reason = "invalid_churn_date";
    else if (hasRowObservationEnd && rowObservationEnd == null) reason = "invalid_observation_end_date";
    else if (!hasChurn && end == null) reason = "missing_observation_end_date";
    else if (hasChurn && globalObservationEnd != null && churn > globalObservationEnd) reason = "churn_after_observation_end_date";
    else if (hasChurn && rowObservationEnd != null && churn > rowObservationEnd) reason = "churn_after_observation_end_date";
    else if (end == null || end < start) reason = "end_before_subscription_start";
    const time = reason ? null : subscriptionDatePeriods(start, end, options.timeUnit || "month"); // timestamps are accepted by the UTC parser.
    if (!reason && time == null) reason = "invalid_date_period";
    if (!reason && (!(entry >= 0) || entry > time)) reason = "invalid_entry_period";
    if (reason) {
      excludedRows.push({ index, row, reason });
      exclusionsByReason[reason] = (exclusionsByReason[reason] || 0) + 1;
      return;
    }
    validRows.push({
      time,
      event: hasChurn ? 1 : 0,
      entry,
      segment: rowValue(row, options.segmentKey || "segment"),
      cac: finiteNumber(rowValue(row, options.cacKey || "cac")),
      source: row,
    });
  });

  const eventCount = validRows.filter((row) => row.event === 1).length;
  return {
    validRows,
    excludedRows,
    exclusionsByReason,
    timeUnit: options.timeUnit || "month",
    inputMode: "dates",
    eventCount,
    censoredCount: validRows.length - eventCount,
    leftTruncatedCount: validRows.filter((row) => row.entry > 0).length,
  };
}

function confidenceInterval(survival, greenwood) {
  if (survival === 1) return { low: 1, high: 1 };
  if (survival === 0) return { low: 0, high: 0 };
  if (!(greenwood >= 0) || !Number.isFinite(greenwood)) return { low: 0, high: 1 };
  const logSurvival = Math.log(survival);
  const standardError = Math.sqrt(greenwood) / Math.abs(logSurvival);
  const transformed = Math.log(-logSurvival);
  // log(-log S) decreases as S increases, hence the signs are reversed when
  // converting the interval back to the survival scale.
  return {
    low: safeProbability(Math.exp(-Math.exp(transformed + _Z975 * standardError))),
    high: safeProbability(Math.exp(-Math.exp(transformed - _Z975 * standardError))),
  };
}

/** Kaplan–Meier table. At a tied time events are applied before censoring. */
export function kaplanMeier(rows = []) {
  const usable = (Array.isArray(rows) ? rows : []).filter((row) => Number.isFinite(row?.time)
    && row.time >= 0
    && (row.event === 0 || row.event === 1)
    && Number.isFinite(row.entry ?? 0)
    && (row.entry ?? 0) >= 0
    && (row.entry ?? 0) <= row.time);
  const times = [...new Set(usable.map((row) => row.time))].sort((left, right) => left - right);
  let survival = 1;
  let greenwood = 0;
  return times.map((time) => {
    const atRisk = usable.filter((row) => row.entry <= time && row.time >= time).length;
    const events = usable.filter((row) => row.time === time && row.event === 1).length;
    const censored = usable.filter((row) => row.time === time && row.event === 0).length;
    const priorSurvival = survival;
    if (atRisk > 0 && events > 0) {
      survival *= 1 - events / atRisk;
      // At n=d the product becomes zero; the log-log CI is a boundary value.
      if (events < atRisk) greenwood += events / (atRisk * (atRisk - events));
      else greenwood = Infinity;
    }
    const ci = confidenceInterval(survival, greenwood);
    return {
      time,
      atRisk,
      events,
      censored,
      priorSurvival,
      survival: safeProbability(survival),
      greenwood,
      ciLow: ci.low,
      ciHigh: ci.high,
    };
  });
}

export function discreteHazard(kmTable = []) {
  const rows = (Array.isArray(kmTable) ? kmTable : []).map((row) => ({
    ...row,
    hazard: row.atRisk > 0 ? safeProbability(row.events / row.atRisk) : null,
  }));
  const estimable = rows.filter((row) => row.hazard != null);
  const maxHazard = estimable.length
    ? estimable.reduce((best, row) => row.hazard > best.hazard ? row : best, estimable[0])
    : null;
  return { rows, maxHazard, hasSmallRiskSet: Boolean(maxHazard && maxHazard.atRisk < 5) };
}

export function medianSurvival(kmTable = []) {
  const row = (Array.isArray(kmTable) ? kmTable : []).find((point) => point.survival != null && point.survival <= 0.5);
  return row ? row.time : null;
}

function survivalAt(kmTable, time) {
  let survival = 1;
  for (const point of kmTable || []) {
    if (point.time > time) break;
    survival = point.survival;
  }
  return survival;
}

/** Area under the right-continuous KM curve, bounded to observed support. */
export function restrictedMeanSurvival(kmTable = [], horizon) {
  const points = Array.isArray(kmTable) ? kmTable : [];
  const tau = finiteNumber(horizon);
  if (!(tau >= 0) || !points.length) return null;
  const maxObserved = points[points.length - 1].time;
  if (tau > maxObserved) return null;
  let area = 0;
  let start = 0;
  let survival = 1;
  for (const point of points) {
    if (point.time >= tau) break;
    area += Math.max(0, point.time - start) * survival;
    survival = point.survival;
    start = point.time;
  }
  area += Math.max(0, tau - start) * survival;
  return area;
}

function invertMatrix(matrix) {
  const size = matrix.length;
  const augmented = matrix.map((row, index) => [...row, ...Array.from({ length: size }, (_, column) => column === index ? 1 : 0)]);
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) pivot = row;
    const magnitude = Math.abs(augmented[pivot][column]);
    if (!(magnitude > Number.EPSILON * 100)) return null;
    [augmented[column], augmented[pivot]] = [augmented[pivot], augmented[column]];
    const divisor = augmented[column][column];
    for (let index = 0; index < size * 2; index += 1) augmented[column][index] /= divisor;
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = augmented[row][column];
      for (let index = 0; index < size * 2; index += 1) augmented[row][index] -= factor * augmented[column][index];
    }
  }
  return augmented.map((row) => row.slice(size));
}

/**
 * Standard log-rank score test, with the final group omitted to obtain a
 * full-rank covariance matrix. It is a difference signal, not a causal claim.
 */
export function logRankTest(groups = []) {
  const usable = (Array.isArray(groups) ? groups : []).map((group, index) => ({
    name: String(group?.name ?? index),
    rows: Array.isArray(group?.rows) ? group.rows : [],
  })).filter((group) => group.rows.length > 0);
  if (usable.length < 2) return { ok: false, reason: "two_groups_required" };
  if (usable.some((group) => group.rows.every((row) => row.event !== 1))) return { ok: false, reason: "group_without_events" };
  const times = [...new Set(usable.flatMap((group) => group.rows.filter((row) => row.event === 1).map((row) => row.time)))].sort((left, right) => left - right);
  const count = usable.length;
  const observed = Array(count).fill(0);
  const expected = Array(count).fill(0);
  const covariance = Array.from({ length: count }, () => Array(count).fill(0));
  times.forEach((time) => {
    const atRisk = usable.map((group) => group.rows.filter((row) => row.entry <= time && row.time >= time).length);
    const events = usable.map((group) => group.rows.filter((row) => row.time === time && row.event === 1).length);
    const n = atRisk.reduce((sum, value) => sum + value, 0);
    const d = events.reduce((sum, value) => sum + value, 0);
    if (!(n > 0) || !(d > 0)) return;
    for (let i = 0; i < count; i += 1) {
      observed[i] += events[i];
      expected[i] += atRisk[i] * d / n;
    }
    if (n <= 1 || d >= n) return;
    const factor = d * (n - d) / (n * n * (n - 1));
    for (let i = 0; i < count; i += 1) for (let j = 0; j < count; j += 1) {
      covariance[i][j] += i === j ? atRisk[i] * (n - atRisk[i]) * factor : -atRisk[i] * atRisk[j] * factor;
    }
  });
  const dimension = count - 1;
  const inverse = invertMatrix(covariance.slice(0, dimension).map((row) => row.slice(0, dimension)));
  if (!inverse) return { ok: false, reason: "covariance_not_estimable", groups: usable.map((group, index) => ({ name: group.name, observed: observed[index], expected: expected[index] })) };
  const score = observed.slice(0, dimension).map((value, index) => value - expected[index]);
  const chiSquare = score.reduce((sum, value, row) => sum + value * inverse[row].reduce((inner, inverseValue, column) => inner + inverseValue * score[column], 0), 0);
  const boundedChiSquare = Math.max(0, chiSquare);
  return {
    ok: true,
    method: "log_rank",
    df: dimension,
    chiSquare: boundedChiSquare,
    pValue: safeProbability(1 - chi2Cdf(boundedChiSquare, dimension)),
    groups: usable.map((group, index) => ({ name: group.name, observed: observed[index], expected: expected[index] })),
  };
}

/** Observed-horizon value only. No extrapolation beyond the KM support. */
export function survivalBasedLtv({ survival, arpu, margin, discountRate = 0, horizon } = {}) {
  const table = Array.isArray(survival) ? survival : [];
  const revenue = finiteNumber(arpu);
  const grossMargin = finiteNumber(margin);
  const rate = finiteNumber(discountRate);
  const tau = finiteNumber(horizon);
  if (!table.length || !(revenue >= 0) || !(grossMargin >= 0 && grossMargin <= 1) || !(rate >= 0) || !(tau >= 0)) return null;
  const periods = Math.floor(tau);
  if (periods > table[table.length - 1].time) return null;
  let value = 0;
  for (let time = 0; time < periods; time += 1) value += survivalAt(table, time) * revenue * grossMargin / (1 + rate) ** time;
  return value;
}

/**
 * Keep CAC economics tied to the same observed horizon as survival LTV. A
 * missing or partial CAC field is deliberately not averaged: mixing only the
 * populated rows would make the displayed LTV:CAC look more complete than it
 * is. Payback counts completed billing periods, so an immediate first-period
 * contribution is reported as period 1 rather than a misleading zero period.
 */
export function observedHorizonUnitEconomics({ survival, arpu, margin, discountRate = 0, horizon, cac } = {}) {
  const ltv = survivalBasedLtv({ survival, arpu, margin, discountRate, horizon });
  const acquisitionCost = finiteNumber(cac);
  if (ltv == null) return { status: "unavailable", reason: "ltv_unavailable", ltv: null, cac: null, ltvCac: null, paybackPeriod: null };
  if (acquisitionCost == null || acquisitionCost < 0) return { status: "unavailable", reason: "cac_unavailable", ltv, cac: null, ltvCac: null, paybackPeriod: null };
  if (acquisitionCost === 0) return { status: "unavailable", reason: "zero_cac", ltv, cac: 0, ltvCac: null, paybackPeriod: null };

  const table = Array.isArray(survival) ? survival : [];
  const revenue = finiteNumber(arpu);
  const grossMargin = finiteNumber(margin);
  const rate = finiteNumber(discountRate);
  const tau = finiteNumber(horizon);
  let cumulativeValue = 0;
  let paybackPeriod = null;
  const periods = Math.floor(tau);
  for (let time = 0; time < periods; time += 1) {
    cumulativeValue += survivalAt(table, time) * revenue * grossMargin / (1 + rate) ** time;
    if (paybackPeriod == null && cumulativeValue >= acquisitionCost) paybackPeriod = time + 1;
  }
  return {
    status: paybackPeriod == null ? "not_reached" : "available",
    reason: paybackPeriod == null ? "payback_not_reached" : null,
    ltv,
    cac: acquisitionCost,
    ltvCac: ltv / acquisitionCost,
    paybackPeriod,
  };
}

export function survivalEvidence({ normalized, kmTable, horizon } = {}) {
  const validRows = normalized?.validRows?.length || 0;
  const events = normalized?.eventCount || 0;
  const censored = normalized?.censoredCount ?? Math.max(0, validRows - events);
  const tau = finiteNumber(horizon);
  if (!validRows) return { status: "INSUFFICIENT_DATA", reason: "no_valid_rows" };
  if (!events) return { status: "ABSTAIN", reason: "no_observed_events" };
  if (!(tau >= 0) || !kmTable?.length) return { status: "INSUFFICIENT_DATA", reason: "horizon_unavailable" };
  const tail = [...kmTable].reverse().find((row) => row.time <= tau) || null;
  if (!tail) return { status: "INSUFFICIENT_DATA", reason: "horizon_unavailable" };
  if (validRows < 10 || events < 3 || tail.atRisk < 5) return { status: "CAUTION", reason: "sparse_risk_set", atRisk: tail.atRisk };
  if (!censored) return { status: "CAUTION", reason: "no_censored_rows", atRisk: tail.atRisk };
  return { status: "READY", reason: null, atRisk: tail.atRisk };
}
