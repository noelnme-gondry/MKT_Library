import { addDays, dayDiff } from "./budgetPlanner/plannerStats";

const known = (value) => Number.isFinite(value) && value >= 0;
export const MIN_TREND_WEEKS = 3;
export const STABLE_SPEND_FRACTION = 0.1;

function groupBy(rows, key) {
  const grouped = new Map();
  for (const row of rows) {
    const value = key(row);
    if (!grouped.has(value)) grouped.set(value, []);
    grouped.get(value).push(row);
  }
  return grouped;
}

function total(rows, field) {
  return rows.every(row => known(row[field])) ? rows.reduce((sum, row) => sum + row[field], 0) : null;
}

// The budget is a setting, often repeated on multiple creative rows.
// A single channel-level row can also provide the setting without a campaign ID.
function dailyBudget(rows) {
  if (rows.length > 1 && rows.some(row => !row.campaign)) return null;
  let sum = 0;
  for (const campaign of groupBy(rows, row => row.campaign).values()) {
    const value = campaign[0].budget;
    if (!known(value) || campaign.some(row => row.budget !== value)) return null;
    sum += value;
  }
  return sum;
}

export function channelPerformanceHistory(rows, grain, cutoff, heldScope) {
  const empty = reason => ({reason, channels: []});
  if (heldScope) return empty("scope");
  if (!rows.length || !cutoff) return empty("history");
  if (rows.some(row => !row.channel)) return empty("channels");
  const channels = [];
  const weekly = grain === "weekly";
  for (const [name, records] of groupBy(rows, row => row.channel)) {
    const weeks = new Map();
    for (const [date, day] of groupBy(records, row => row.date)) {
      const end = weekly ? addDays(date, 6) : addDays(cutoff, -7 * Math.floor(dayDiff(date, cutoff) / 7));
      if (end > cutoff) continue;
      if (!weeks.has(end)) weeks.set(end, []);
      weeks.get(end).push({cost:total(day,"cost"), result:total(day,"result"), budget:dailyBudget(day)});
    }
    const points = [];
    for (const [end, days] of weeks) {
      if (days.length !== (weekly ? 1 : 7)) continue;
      const budget = total(days,"budget");
      points.push({end, cost:total(days,"cost"), result:total(days,"result"), budget:budget === null ? null : budget / days.length});
    }
    channels.push({name, points:points.sort((a,b) => a.end.localeCompare(b.end))});
  }
  return channels.length < 2 ? empty("channels") : {reason:null, channels:channels.sort((a,b) => a.name.localeCompare(b.name))};
}

function indexWeeks(channel) {
  const byEnd = new Map(channel.points.map(point => [point.end, point]));
  const transitions = [];
  for (const now of channel.points) {
    const prior = byEnd.get(addDays(now.end, -7));
    if (prior) transitions.push({prior, now});
  }
  return {name:channel.name, byEnd, transitions};
}

function* comparableWeeks(source, target, exposure, stableOnly) {
  for (const {prior, now} of source.transitions) {
    const before = target.byEnd.get(prior.end), after = target.byEnd.get(now.end);
    if (!known(now[exposure]) || !known(prior[exposure]) || !before || !after) continue;
    if (!(before.cost > 0 && after.cost > 0) || !known(before.result) || !known(after.result)) continue;
    if (stableOnly && Math.abs(after.cost - before.cost) > before.cost * STABLE_SPEND_FRACTION) continue;
    yield {end:now.end, previousEnd:prior.end, raised:now[exposure] > prior[exposure],
      from:prior[exposure], to:now[exposure], sourceCost:now.cost, before, after};
  }
}

function measureGroup() {
  return {weeks:0, from:0, to:0, priorCost:0, cost:0, priorResults:0, results:0};
}
function summarize(group) {
  const {weeks, priorCost, cost, priorResults, results} = group;
  const beforeCPA = priorResults > 0 ? priorCost / priorResults : null;
  const afterCPA = results > 0 ? cost / results : null;
  const cpaChange = beforeCPA !== null && afterCPA !== null ? afterCPA - beforeCPA : null;
  return {weeks, beforeCPA, afterCPA, cpaChange,
    cpaRate:beforeCPA > 0 && cpaChange !== null ? cpaChange / beforeCPA : null,
    sourceChange:weeks ? (group.to-group.from)/weeks : null,
    resultChange:weeks ? (results-priorResults)/weeks : null,
    resultRate:priorResults ? (results-priorResults)/priorResults : null,
    lostAll:priorResults > 0 && results === 0};
}

function measurePair(source, target, exposure, stableOnly) {
  const raised = measureGroup(), other = measureGroup();
  for (const event of comparableWeeks(source,target,exposure,stableOnly)) {
    const g = event.raised ? raised : other;
    g.weeks++;
    g.from += event.from;
    g.to += event.to;
    g.priorCost += event.before.cost;
    g.cost += event.after.cost;
    g.priorResults += event.before.result;
    g.results += event.after.result;
  }
  return {source:source.name, target:target.name, exposure, raised:summarize(raised), other:summarize(other)};
}

function attention(pair) {
  const g = pair.raised;
  if (!g.weeks) return -1;
  if (g.lostAll || (g.cpaChange > 0 && g.resultChange < 0)) return 2;
  if (g.cpaChange > 0 || g.resultChange < 0) return 1;
  return 0;
}

export function scanChannelPairs(channels, mode = "auto", stableOnly = false) {
  const indexed = channels.map(indexWeeks);
  const pairs = [];
  for (const source of indexed) {
    // One exposure definition per source across every target and both cohorts.
    const hasBudgetHistory = source.transitions.some(({prior,now}) => known(prior.budget) && known(now.budget));
    const exposure = mode === "cost" || !hasBudgetHistory ? "cost" : "budget";
    for (const target of indexed) {
      if (target !== source) pairs.push(measurePair(source,target,exposure,stableOnly));
    }
  }
  return pairs.sort((a,b) => attention(b) - attention(a)
    || Number(b.raised.weeks >= MIN_TREND_WEEKS) - Number(a.raised.weeks >= MIN_TREND_WEEKS)
    || Number(b.raised.lostAll) - Number(a.raised.lostAll)
    || (b.raised.cpaRate ?? 0) - (a.raised.cpaRate ?? 0)
    || b.raised.weeks - a.raised.weeks
    || a.source.localeCompare(b.source) || a.target.localeCompare(b.target));
}
export function compareChannelPerformance(source, target, exposure, stableOnly = false) {
  const events = [...comparableWeeks(indexWeeks(source),indexWeeks(target),exposure,stableOnly)];
  const group = () => ({weeks:0, fewer:0, efficiencyWeeks:0, worse:0});
  const increased = group(), other = group();
  for (const {before,after,raised} of events) {
    const bucket = raised ? increased : other;
    bucket.weeks++;
    if (after.result < before.result) bucket.fewer++;
    if (before.result > 0) {
      bucket.efficiencyWeeks++;
      if (after.cost * before.result > before.cost * after.result) bucket.worse++;
    }
  }
  return {increased, other, events};
}
