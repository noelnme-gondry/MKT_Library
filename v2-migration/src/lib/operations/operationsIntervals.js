import { parseDateValue } from "@/lib/data-import/normalizeValues";
import { dateOrdinal, periodDays, previousPeriod } from "@/lib/analysisPeriod";
import { operationsEntityKey } from "./operationsIdentity";
import { operationsTotals, prepareOperationsBrief } from "./operationsBrief";
import { fitAllocationChannel } from "@/utils/allocationModels";
import { allocConfidence } from "@/utils/allocationConfidence";

const DAY = 86400000;
const iso = ordinal => new Date(ordinal * DAY).toISOString().slice(0, 10);
const units = { day: 1, week: 7, month: 30 };
export function operationsInterval(date, grain) {
  const ordinal = dateOrdinal(date);
  if (ordinal == null) return { start: "", end: "" };
  if (grain === "week") {
    const weekday = new Date(ordinal * DAY).getUTCDay();
    const start = ordinal - (weekday + 6) % 7;
    return { start: iso(start), end: iso(start + 6) };
  }
  if (grain === "month") {
    const d = new Date(ordinal * DAY);
    return { start: `${date.slice(0, 7)}-01`, end: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10) };
  }
  return { start: date, end: date };
}

// An explicit week/month date label is evidence of grain; date spacing alone is not.
export function operationsSourceRows(rows) {
  return rows.map(row => {
    const parsed = parseDateValue(row.date);
    if (!parsed) return { ...row, periodEnd: "", sourceGrain: "unknown" };
    const interval = operationsInterval(parsed.isoDate, parsed.grain);
    return { ...row, date: interval.start, periodEnd: interval.end, sourceGrain: parsed.grain };
  });
}
export function operationsSourceGrain(rows) {
  const grains = [...new Set(rows.map(row => row.sourceGrain))];
  return grains.length === 1 && units[grains[0]] ? grains[0] : "unknown";
}
export function operationsPeriods(rows, filter = {}, windowDays = 7) {
  const grain = operationsSourceGrain(rows), dates = [...new Set(rows.map(row => row.date).filter(date => dateOrdinal(date) != null))].sort();
  const end = rows.map(row => row.periodEnd).filter(Boolean).sort().at(-1) || "";
  const current = filter.dateStart && filter.dateEnd ? { start: filter.dateStart, end: filter.dateEnd }
    : grain === "day" && end ? { start: iso(dateOrdinal(end) - windowDays + 1), end } : operationsInterval(dates.at(-1), grain);
  const previous = filter.compareEnabled ? { start: filter.comparisonStart, end: filter.comparisonEnd }
    : grain === "month" && current.start ? operationsInterval(iso(dateOrdinal(current.start) - 1), "month") : previousPeriod(current) || { start: "", end: "" };
  const recentDates = new Set(dates.filter(date => date >= current.start && date <= current.end));
  const prevDates = new Set(dates.filter(date => date >= previous.start && date <= previous.end));
  return { current, previous, custom: Boolean(filter.compareEnabled), dates, recentDates, prevDates, sourceGrain: grain };
}
const inside = (row, range) => row.date >= range.start && row.periodEnd <= range.end;
function coveredDays(rows) {
  const intervals = [...new Map(rows.map(row => [row.date, row.periodEnd])).entries()].sort(([a], [b]) => a.localeCompare(b));
  let last = -Infinity, total = 0;
  for (const [start, end] of intervals) { const a = dateOrdinal(start), b = dateOrdinal(end); if (a == null || b == null) continue; total += Math.max(0, b - Math.max(a, last + 1) + 1); last = Math.max(last, b); }
  return total;
}

export function prepareOperationsIntervals({ rows, periods, metric, mappedFields, grain = "auto" }) {
  const sourceGrain = operationsSourceGrain(rows), selectedGrain = grain === "auto" ? sourceGrain : grain;
  const displayDays = units[selectedGrain] || 1;
  const validPeriods = [periods.current, periods.previous].every(range => periodDays(range) > 0);
  const split = validPeriods && [periods.current, periods.previous].some(range => rows.some(row => row.date <= range.end && row.periodEnd >= range.start && !inside(row, range)));
  const comparisonAvailable = validPeriods && !split && periods.previous.end < periods.current.start && sourceGrain !== "unknown";
  const currentAvailable = periodDays(periods.current) > 0 && sourceGrain !== "unknown" && !rows.some(row => row.date <= periods.current.end && row.periodEnd >= periods.current.start && !inside(row, periods.current));
  const brief = prepareOperationsBrief({ rows, periods, metric, mappedFields });
  const holds = [];
  if (!validPeriods || split || periods.previous.end >= periods.current.start) holds.push({ reason: "interval" });
  if (sourceGrain === "unknown" || units[selectedGrain] < units[sourceGrain]) holds.push({ reason: "grain" });
  if (new Set(rows.map(row => row.country || "")).size > 1) holds.push({ reason: "countries" });
  if (!brief.campaigns.length) holds.push({ reason: "empty" });
  const history = rows.filter(row => row.periodEnd <= periods.current.end);
  const models = new Map(), currentSpends = {};
  const unavailable = { cost: null, results: null, cpr: null };
  const campaigns = brief.campaigns.map(source => {
    const campaign = comparisonAvailable ? source : { ...source, current: unavailable, previous: unavailable, changePct: null, pvm: null, stages: null };
    const own = history.filter(row => operationsEntityKey(row, brief.unit) === campaign.id), buckets = new Map();
    const current = own.filter(row => inside(row, periods.current));
    if (coveredDays(current) !== periodDays(periods.current)) holds.push({ id: campaign.id, reason: "cadence" });
    if (campaign.current.cost != null && periodDays(periods.current) > 0) currentSpends[campaign.id] = campaign.current.cost / periodDays(periods.current);
    for (const row of own) {
      const range = operationsInterval(row.date, selectedGrain);
      if (!inside(row, range)) continue;
      if (!buckets.has(range.start)) buckets.set(range.start, { ...range, rows: [] });
      buckets.get(range.start).rows.push(row);
    }
    const complete = [...buckets.values()].filter(bucket => coveredDays(bucket.rows) === periodDays(bucket));
    const trend = complete.map(bucket => {
      const total = operationsTotals(bucket.rows, metric), days = periodDays(bucket);
      return { date: bucket.start, end: bucket.end, cost: total.cost == null ? null : total.cost / days, results: total.results == null ? null : total.results / days, cpr: total.cpr, rawCost: total.cost, rawResults: total.results };
    });
    const totals = own.map(row => operationsTotals([row], metric));
    const invalid = totals.some(value => value.cost == null || value.results == null);
    const zero = trend.some(value => value.cost > 0 && value.results === 0);
    const model = invalid || zero || holds.some(hold => ["grain", "interval"].includes(hold.reason)) ? null : fitAllocationChannel(trend.filter(row => row.cost > 0 && row.results > 0).map(row => ({ x: row.cost, y: row.cpr, date: row.date })), { regimeMode: "auto", weightMode: "exponential", halfLifeDays: 14, periodDays: displayDays });
    if (invalid) holds.push({ id: campaign.id, reason: "missing" });
    else if (zero) holds.push({ id: campaign.id, reason: "outcomes" });
    else if (!model || allocConfidence(model)?.level === "low") holds.push({ id: campaign.id, reason: "confidence" });
    else models.set(campaign.id, model);
    return { ...campaign, trend, displayDays, grain: selectedGrain, incompleteIntervals: buckets.size - complete.length };
  });
  const creatives = brief.creatives.map(creative => {
    const own = history.filter(row => operationsEntityKey(row, brief.unit) === creative.campaignId && String(row.creative_id || "") === creative.creative);
    const current = own.filter(row => inside(row, periods.current));
    return { ...creative, ...(!comparisonAvailable ? { ...unavailable, vsEstablishedPct: null } : {}), days: coveredDays(current), observationCount: new Set(current.map(row => row.date)).size,
      performanceStart: current.map(row => row.date).sort()[0], performanceEnd: current.map(row => row.periodEnd).sort().at(-1), firstEnd: own.find(row => row.date === creative.firstDate)?.periodEnd };
  });
  creatives.sort((a, b) => Number(b.isNew) - Number(a.isNew) || (b.cost ?? 0) - (a.cost ?? 0));
  return { ...brief, ...(!comparisonAvailable ? { current: unavailable, previous: unavailable } : {}), campaigns, creatives, models, currentSpends, budgetHolds: holds, sourceGrain, grain: selectedGrain, displayDays, comparisonAvailable, currentAvailable };
}
