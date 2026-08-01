import { PVM_MATH } from "./pvmMath";

const DAY_MS = 86_400_000;
const MIN_DAYS_PER_PERIOD = 4;

function utcDay(value) {
  const time = new Date(`${String(value).slice(0, 10)}T00:00:00Z`).getTime();
  return Number.isFinite(time) ? time : null;
}

function isoDay(time) {
  return new Date(time).toISOString().slice(0, 10);
}

export function anomalyAttributionEligibility({ metric, mappedFields }) {
  if (!["cpa", "cpi"].includes(metric)) {
    return { eligible: false, reason: "unsupported_metric" };
  }
  const mapped = mappedFields instanceof Set ? mappedFields : new Set(mappedFields || []);
  const resultField = metric === "cpi" ? "installs" : "actions";
  const missing = ["date", "cost", resultField, "channel"].filter((field) => !mapped.has(field));
  if (missing.length) return { eligible: false, reason: "missing_fields", missing };
  return { eligible: true, resultField };
}

export function buildAttributionPeriods(anomalyDate) {
  const end = utcDay(anomalyDate);
  if (end == null) return null;
  return {
    periodA: { start: isoDay(end - 13 * DAY_MS), end: isoDay(end - 7 * DAY_MS) },
    periodB: { start: isoDay(end - 6 * DAY_MS), end: isoDay(end) },
  };
}

function inPeriod(row, period) {
  const date = String(row.date || "").slice(0, 10);
  return date >= period.start && date <= period.end;
}

function validDayCount(rows) {
  return new Set(rows.map((row) => String(row.date || "").slice(0, 10)).filter(Boolean)).size;
}

function driverFromRollup(item, level, totalAbs) {
  return {
    key: String(item.key),
    level,
    label: String(item.key || "Unknown"),
    contribution: item.contribution,
    shareOfAbsChange: totalAbs > 0 ? Math.abs(item.contribution) / totalAbs : 0,
    direction: item.contribution >= 0 ? "up" : "down",
  };
}

export function attributeAnomaly(rows, anomalyDate, metric) {
  const periods = buildAttributionPeriods(anomalyDate);
  if (!periods) return { unavailable: true, reason: "invalid_date" };
  const rowsA = rows.filter((row) => inPeriod(row, periods.periodA));
  const rowsB = rows.filter((row) => inPeriod(row, periods.periodB));
  if (validDayCount(rowsA) < MIN_DAYS_PER_PERIOD || validDayCount(rowsB) < MIN_DAYS_PER_PERIOD) {
    return { unavailable: true, reason: "insufficient_period", ...periods };
  }

  const resultField = metric === "cpi" ? "installs" : "actions";
  const normalized = (items) => items.map((row) => ({
    ...row,
    spend: row.spend ?? row.cost ?? 0,
    campaign_id: row.campaign_id ?? row.campaign_name ?? "",
    creative_id: row.creative_id ?? "",
  }));
  const keys = {
    ch: "channel",
    cmp: "campaign_id",
    cr: "creative_id",
    resultField,
  };
  const normalizedA = normalized(rowsA);
  const normalizedB = normalized(rowsB);
  const inputContract = PVM_MATH.inspectFinestInputs(normalizedA, normalizedB, keys);
  if (!inputContract.ok) return { unavailable: true, reason: "not_identified", reasonCode: inputContract.code, ...periods };
  const finest = PVM_MATH.decomposeFinest(normalizedA, normalizedB, keys);
  if (!finest) return { unavailable: true, reason: "zero_denominator", ...periods };

  const channelRows = PVM_MATH.rollup(finest.finest, (row) => row.chKey || "Unknown", finest.Result1, finest.Result2);
  const campaignRows = PVM_MATH.rollup(
    finest.finest,
    (row) => `${row.chKey || "Unknown"} › ${row.cmpKey || "Unknown"}`,
    finest.Result1,
    finest.Result2,
  );
  const creativeRows = PVM_MATH.rollup(
    finest.finest,
    (row) => `${row.chKey || "Unknown"} › ${row.cmpKey || "Unknown"} › ${row.crKey || "Unknown"}`,
    finest.Result1,
    finest.Result2,
  );
  const totalAbs = channelRows.reduce((sum, item) => sum + Math.abs(item.contribution), 0);
  const sortDrivers = (items, level) => items
    .map((item) => driverFromRollup(item, level, totalAbs))
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution) || a.key.localeCompare(b.key));
  const drivers = sortDrivers(channelRows, "channel");
  const contributionSum = channelRows.reduce((sum, item) => sum + item.contribution, 0);

  return {
    schemaVersion: 1,
    anomalyDate: String(anomalyDate).slice(0, 10),
    metric,
    ...periods,
    totalDelta: finest.deltaCpa,
    drivers,
    levels: {
      channel: drivers,
      campaign: sortDrivers(campaignRows, "campaign"),
      creative: sortDrivers(creativeRows, "creative"),
    },
    remainder: finest.deltaCpa - contributionSum,
    identityError: Math.abs(finest.deltaCpa - contributionSum),
  };
}

export function buildAttributionCache({ rows, anomalyDates, metric, mappedFields, inputSignature }) {
  const eligibility = anomalyAttributionEligibility({ metric, mappedFields });
  if (!eligibility.eligible) return { inputSignature, eligibility, byDate: {} };
  const byDate = {};
  anomalyDates.slice(0, 20).forEach((date) => {
    byDate[date] = attributeAnomaly(rows, date, metric);
  });
  return { inputSignature, eligibility, byDate };
}
