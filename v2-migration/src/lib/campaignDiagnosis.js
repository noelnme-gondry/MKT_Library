// Unified CSV diagnosis. No row with unreported outcomes may enter the CPA denominator as zero.
import { decomposePlannerPvm } from "./budgetPlanner/plannerPvm";
import { PLANNER_CONFIG } from "./budgetPlanner/plannerConfig";
import { addDays, dayDiff, dowOf, isIsoDate } from "./budgetPlanner/plannerStats";
import { CANNIBAL_STATS } from "@/utils/responseMath";
import { CREATIVE_CONFIG } from "@/utils/creativeConfig";
import { channelPerformanceHistory } from "./channelPerformance";
import { diagnosisBudget } from "./campaignDiagnosisBudget";

const groupBy = (rows, keyOf) => {
  const groups = new Map();
  for (const row of rows) {
    const key = keyOf(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return groups;
};
const known = (value) => Number.isFinite(value) && value >= 0;
const difference = (a, b) => (a != null && b != null ? b - a : null);
function total(rows, field) {
  return rows.length && rows.every((row) => known(row[field])) ? rows.reduce((n, row) => n + row[field], 0) : null;
}

function totals(rows) {
  const cost = total(rows, "cost");
  const result = total(rows, "result");
  const paired = rows.filter((row) => known(row.result) && known(row.cost));
  const knownCost = paired.reduce((n, r) => n + r.cost, 0);
  return {
    cost,
    result,
    cpa: cost != null && result > 0 ? cost / result : null,
    knownCost,
    knownResult: total(paired, "result"),
    coverage: cost > 0 ? knownCost / cost : null,
    zeroCost: paired.reduce((n, r) => n + (r.result === 0 ? r.cost : 0), 0),
  };
}

const inPeriod = (date, period) => period.start != null && date >= period.start && date <= period.end;
const visibleDates = (rows) => [...new Set(rows.map((r) => r.date))].sort();
function periodsFor(rows, grain, selected) {
  const dates = visibleDates(rows);
  const last = dates.at(-1);
  const weekly = grain === "weekly";
  if (selected) {
    function observed(range) {
      const start = range?.start, end = range?.end;
      const length = start && end ? dayDiff(start, end) + 1 : 0;
      return { start, end, observedDays: dates.filter(date => inPeriod(date, range)).length,
        expectedDays: weekly ? length / 7 : length };
    }
    return { previous: observed(selected.previous), current: observed(selected.current) };
  }
  const start = last ? (weekly ? last : addDays(last, -((dowOf(last) + 6) % 7))) : null;
  const end = last ? (weekly ? addDays(last, 6) : last) : null;
  function period(offset) {
    const p = {
      start: start && addDays(start, offset),
      end: end && addDays(end, offset),
      observedDays: 0,
      expectedDays: !start ? 0 : weekly ? 1 : dayDiff(start, end) + 1,
    };
    p.observedDays = dates.filter((date) => inPeriod(date, p)).length;
    return p;
  }
  return { previous: period(-7), current: period(0) };
}

// A configured budget can be repeated on creative rows. Only a single agreed
// value at the same campaign, market and date can establish a change.
function actionEvidence(rows, current, grain) {
  const budgetChanges = [];
  const changeReviews = [];
  const step = grain === "weekly" ? 7 : 1;
  for (const rs of groupBy(rows, (r) => JSON.stringify([r.market, r.campaign])).values()) {
    const days = groupBy(rs, (r) => r.date);
    const configured = (date) => {
      const values = [...new Set((days.get(date) || []).map((r) => r.budget).filter(known))];
      return values.length === 1 ? values[0] : null;
    };
    for (const [date, dayRows] of days) {
      if (!inPeriod(date, current)) continue;
      const from = configured(addDays(date, -step)),
        to = configured(date);
      const campaign = rs[0].campaign || null,
        market = rs[0].market || null;
      const changed = from != null && to != null && from !== to;
      if (changed) budgetChanges.push({ date, campaign, market, from, to });
      if (!changed && !dayRows.some((r) => r.change)) continue;
      // Compare identical weekdays since the change, up to a week on each side.
      const length = grain === "weekly" ? 7 : Math.min(7, dayDiff(date, current.end) + 1);
      const measure = (start) => {
        const end = addDays(start, length - 1);
        const slice = rs.filter((r) => r.date >= start && r.date <= end);
        return {
          start,
          end,
          ...totals(slice),
          complete: visibleDates(slice).length === (grain === "weekly" ? 1 : length),
          creatives: new Set(slice.map((r) => r.creative).filter(Boolean)),
        };
      };
      const before = measure(addDays(date, -7)),
        after = measure(date);
      const complete = before.complete && after.complete;
      const deltaCost = complete ? difference(before.cost, after.cost) : null;
      const deltaResult = complete ? difference(before.result, after.result) : null;
      const membership = new Set([...before.creatives, ...after.creatives]);
      const coincidesWithCreativeChange =
        before.creatives.size > 0 &&
        after.creatives.size > 0 &&
        [...membership].some((id) => !before.creatives.has(id) || !after.creatives.has(id));
      const windowStats = (w) => ({ start: w.start, end: w.end, cost: w.cost, result: w.result, cpa: w.cpa });
      changeReviews.push({
        date,
        campaign,
        market,
        before: windowStats(before),
        after: windowStats(after),
        deltaCost,
        deltaResult,
        incrementalCpa: deltaCost > 0 && deltaResult > 0 ? deltaCost / deltaResult : null,
        coincidesWithCreativeChange,
      });
    }
  }
  return { budgetChanges, changeReviews };
}

function entity(name, rows, periods, targetCpa, comparable, grain) {
  const points = [...groupBy(rows, (r) => r.date)]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, rs]) => {
      const { cost, result, cpa } = totals(rs);
      return {
        date,
        cost,
        result,
        cpa,
        period: inPeriod(date, periods.current)
          ? "current"
          : inPeriod(date, periods.previous)
            ? "previous"
            : "history",
      };
    });
  const previousRows = rows.filter((r) => inPeriod(r.date, periods.previous));
  const previous = totals(previousRows);
  const currentRows = rows.filter((r) => inPeriod(r.date, periods.current));
  const current = totals(currentRows);
  comparable =
    comparable &&
    visibleDates(previousRows).length === periods.previous.expectedDays &&
    visibleDates(currentRows).length === periods.current.expectedDays;
  const deltaCost = comparable ? difference(previous.cost, current.cost) : null;
  const deltaResult = comparable ? difference(previous.result, current.result) : null;
  const deltaCpa = comparable ? difference(previous.cpa, current.cpa) : null;
  const incrementalCpa = deltaCost > 0 && deltaResult > 0 ? deltaCost / deltaResult : null;
  const action =
    deltaCost == null ? "unavailable" : deltaCost > 0 ? "increase" : deltaCost < 0 ? "decrease" : "stable";
  let effect = "unassessed";
  if (action === "increase" && deltaResult != null) {
    if (deltaResult <= 0) effect = "no_result_gain";
    else if (targetCpa > 0) effect = incrementalCpa <= targetCpa ? "within_target" : "above_target";
  }
  const changes = [
    ...new Set(
      currentRows.filter((r) => r.change).map((r) => [r.date, r.campaign, r.change].filter(Boolean).join(" · ")),
    ),
  ];
  return {
    name,
    previous,
    current,
    points,
    deltaCost,
    deltaResult,
    deltaCpa,
    incrementalCpa,
    action,
    effect,
    changes,
    comparable,
    ...actionEvidence(rows, periods.current, grain),
  };
}

function mixRate(previousRows, currentRows, enabled) {
  const base = {
    status: "insufficient",
    mix: null,
    rate: null,
    entry: null,
    exit: null,
    delta: null,
    excludedCost: null,
    excludedPreviousCost: null,
    baselineCpa: null,
    currentCpa: null,
    contributions: [],
    drivers: [],
    improvers: [],
    residual: null,
  };
  if (!enabled) return base;
  const key = (r) => JSON.stringify([r.channel, r.campaign]);
  const incomplete = new Set(
    [...previousRows, ...currentRows].filter((r) => !known(r.result) || !known(r.cost)).map(key),
  );
  const excludedCost = (rows) => rows.filter((r) => incomplete.has(key(r))).reduce((n, r) => n + (r.cost ?? 0), 0);
  const adapt = (rows) =>
    rows
      .filter((r) => !incomplete.has(key(r)))
      .map((row) => ({ ...row, channel: row.channel || row.campaign || "—", campaign_name: row.campaign }));
  const decomp = decomposePlannerPvm(adapt(previousRows), adapt(currentRows), {
    levels: ["channel", "campaign_name"],
    finestLevel: "campaign_name",
    groupLevel: "channel",
    cfg: PLANNER_CONFIG,
  });
  if (!decomp.ok) return base;
  const d = decomp.totals;
  // The planner groups results at the channel node after computing once at the
  // finest level. Its signed contributions reconcile even for entering groups.
  const contributions = decomp.groups
    .map((group) => ({
      name: JSON.parse(group.key)[0],
      contribution: group.contribution,
      mix: group.betweenMix + group.withinMix,
      rate: group.budget + group.market + group.creative,
      entry: group.entry,
      exit: group.exit,
    }))
    .sort((a, b) => b.contribution - a.contribution || a.name.localeCompare(b.name));
  const tolerance = 1e-10 * Math.max(1, decomp.CPA1, decomp.CPA2);
  const drivers = contributions.filter((row) => row.contribution > tolerance).slice(0, 3);
  const improvers = contributions
    .filter((row) => row.contribution < -tolerance)
    .sort((a, b) => a.contribution - b.contribution || a.name.localeCompare(b.name))
    .slice(0, 3);
  return {
    status: "ready",
    mix: d.betweenMix + d.withinMix,
    rate: d.budget + d.market + d.creative,
    entry: d.entry,
    exit: d.exit,
    delta: decomp.deltaCpa,
    contributions,
    drivers,
    improvers,
    residual: decomp.deltaCpa - contributions.reduce((sum, row) => sum + row.contribution, 0),
    scope: incomplete.size || decomp.excluded.length ? "subset" : "all",
    excludedCost: decomp.excluded.reduce((s, r) => s + r.costR, excludedCost(currentRows)),
    excludedPreviousCost: decomp.excluded.reduce((s, r) => s + r.costB, excludedCost(previousRows)),
    baselineCpa: decomp.CPA1,
    currentCpa: decomp.CPA2,
  };
}

function organicHistory(rows) {
  return [...groupBy(rows, (r) => r.date)]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, rs]) => {
      let organic = 0;
      let conflict = false;
      for (const marketRows of groupBy(rs, (r) => r.market || "").values()) {
        const values = [...new Set(marketRows.map((r) => r.organic).filter(known))];
        if (values.length !== 1) organic = null;
        if (values.length > 1) conflict = true;
        if (organic !== null) organic += values[0];
      }
      return {
        date,
        organic,
        conflict,
        markets: [...new Set(rs.map((r) => r.market || ""))].sort(),
        ...totals(rs),
      };
    });
}

// Fixed lags on week-over-week differences. Match calendar dates exactly so a
// missing date never silently shortens a lag or changes the weekday mix.
function laggedOrganic(points, grain) {
  const dates = new Map(points.map((p) => [p.date, p]));
  return (grain === "weekly" ? [0, 7] : [0, 1, 7]).map((days) => {
    const spend = [],
      organic = [];
    for (const p of points) {
      const prior = dates.get(addDays(p.date, -7));
      const next = dates.get(addDays(p.date, days));
      const priorNext = dates.get(addDays(p.date, days - 7));
      if (
        !prior ||
        !next ||
        !priorNext ||
        [prior.cost, p.cost, priorNext.organic, next.organic].some((v) => v == null)
      )
        continue;
      if (new Set([p, prior, next, priorNext].map((q) => JSON.stringify(q.markets))).size !== 1) continue;
      spend.push(p.cost - prior.cost);
      organic.push(next.organic - priorNext.organic);
    }
    const correlation = spend.length >= 14 ? CANNIBAL_STATS.pearson(spend, organic) : null;
    return { days, n: spend.length, correlation: Number.isFinite(correlation) ? correlation : null };
  });
}

function organicPanel(rows, periods, comparable, exclusive, grain) {
  const points = organicHistory(rows);
  const prior = points.filter((p) => inPeriod(p.date, periods.previous));
  const now = points.filter((p) => inPeriod(p.date, periods.current));
  const previous = total(prior, "organic");
  const current = total(now, "organic");
  const paidDelta = comparable ? difference(total(prior, "result"), total(now, "result")) : null;
  const sameMarkets = new Set([...prior, ...now].map((p) => JSON.stringify(p.markets))).size === 1;
  const organicDelta = comparable && sameMarkets ? difference(previous, current) : null;
  const priorOffset = periods.current.start && periods.previous.start ? dayDiff(periods.previous.start, periods.current.start) : 7;
  const priorWindow = {
    start: periods.previous.start && addDays(periods.previous.start, -priorOffset),
    end: periods.previous.end && addDays(periods.previous.end, -priorOffset),
  };
  const earlier = points.filter((p) => inPeriod(p.date, priorWindow));
  const sameEarlierMarkets = new Set([...earlier, ...prior].map((p) => JSON.stringify(p.markets))).size === 1;
  const previouslyObserved = earlier.length === periods.previous.expectedDays && sameEarlierMarkets;
  const previousOrganicChange = previouslyObserved ? difference(total(earlier, "organic"), previous) : null;
  const costDelta = comparable ? difference(total(prior, "cost"), total(now, "cost")) : null;
  return {
    costDelta,
    organicDelta,
    previousOrganicChange,
    costUpOrganicDown: costDelta > 0 && organicDelta < 0,
    lags: laggedOrganic(points, grain),
    status: organicDelta == null ? "insufficient" : "ready",
    previous,
    current,
    paidDelta,
    totalDelta: exclusive && paidDelta != null && organicDelta != null ? paidDelta + organicDelta : null,
    exclusive,
    points,
    sameMarkets,
    conflict: [...prior, ...now].some((p) => p.conflict),
  };
}

function sustainedCtrDrop(previousRows, currentRows) {
  const prior = groupBy(previousRows, (r) => r.date);
  let run = 0,
    last = null;
  for (const [date, rs] of [...groupBy(currentRows, (r) => r.date)].sort(([a], [b]) => a.localeCompare(b))) {
    const baseline = prior.get(addDays(date, -7)) || [];
    const before = total(baseline, "clicks") / total(baseline, "impressions");
    const after = total(rs, "clicks") / total(rs, "impressions");
    if (last && addDays(last, 1) !== date) run = 0;
    run =
      Number.isFinite(before) &&
      Number.isFinite(after) &&
      before > 0 &&
      after <= before * (1 - CREATIVE_CONFIG.fatigue.dropPct)
        ? run + 1
        : 0;
    if (run >= CREATIVE_CONFIG.fatigueRisk.confirmDays) return true;
    last = date;
  }
  return false;
}

function creativePanel(rows, periods, comparable, grain) {
  const result = { status: "insufficient", entered: [], exited: [], continuing: [], fatigue: [] };
  const selected = rows.filter((r) => inPeriod(r.date, periods.previous) || inPeriod(r.date, periods.current));
  if (!comparable || !selected.length || selected.some((r) => !r.creative)) return result;
  result.status = "ready";
  for (const rs of groupBy(selected, (r) => JSON.stringify([r.channel, r.campaign, r.creative])).values()) {
    const prev = rs.filter((r) => inPeriod(r.date, periods.previous));
    const curr = rs.filter((r) => inPeriod(r.date, periods.current));
    const row = {
      name: rs[0].creative,
      channel: rs[0].channel,
      campaign: rs[0].campaign,
      previous: totals(prev),
      current: totals(curr),
    };
    const group = !prev.length ? "entered" : !curr.length ? "exited" : "continuing";
    result[group].push(row);
    if (group !== "continuing" || grain !== "daily") continue;
    const impsA = total(prev, "impressions"),
      impsB = total(curr, "impressions");
    const clicksA = total(prev, "clicks"),
      clicksB = total(curr, "clicks");
    const enough =
      visibleDates(prev).length >= 5 &&
      visibleDates(curr).length >= 5 &&
      Math.min(impsA, impsB) >= CREATIVE_CONFIG.minImpressions &&
      clicksA > 0 &&
      clicksB > 0;
    const spendRatio = row.current.cost / row.previous.cost;
    const ctrDrop = clicksA > 0 && clicksB != null ? 1 - clicksB / impsB / (clicksA / impsA) : null;
    const freq = (slice) => {
      const values = slice.map((r) => r.frequency);
      return values.length && values.every((v) => known(v) && v > 0)
        ? values.reduce((a, b) => a + b, 0) / values.length
        : null;
    };
    if (
      enough &&
      spendRatio >= 0.8 &&
      spendRatio <= 1.2 &&
      ctrDrop >= CREATIVE_CONFIG.fatigue.dropPct &&
      row.previous.cpa > 0 &&
      row.current.cpa > row.previous.cpa &&
      sustainedCtrDrop(prev, curr)
    ) {
      result.fatigue.push({
        ...row,
        previousCtr: clicksA / impsA,
        currentCtr: clicksB / impsB,
        previousFrequency: freq(prev),
        currentFrequency: freq(curr),
      });
    }
  }
  return result;
}

export function analyzeDiagnosis(input, options = {}) {
  const inputRows = Array.isArray(input) ? input : [];
  // Currency supplied for an unlabelled report only. Never treat a declaration as an exchange rate.
  const selected = inputRows.filter(
    (r) =>
      (!options.market || r.market === options.market) && (!options.platform || r.platform === options.platform),
  );
  const currencies = new Set(selected.map((r) => r.currency || options.currency || null));
  const currency = currencies.size === 1 ? [...currencies][0] : null;
  const grain = options.grain || "daily";
  const invalid =
    selected.some(
      (r) =>
        !isIsoDate(r.date) ||
        addDays(r.date, 0) !== r.date ||
        (r.cost != null && !known(r.cost)) ||
        (r.result != null && !known(r.result)),
    ) ||
    (grain !== "daily" && grain !== "weekly") ||
    (grain === "weekly" && new Set(selected.map((r) => dowOf(r.date))).size > 1);
  const mixed = currencies.size > 1;
  const rows = invalid || mixed ? [] : options.periods?.current.end ? selected.filter(row => row.date <= options.periods.current.end) : selected;
  const periods = periodsFor(rows, grain, options.periods);
  const prior = rows.filter((r) => inPeriod(r.date, periods.previous));
  const now = rows.filter((r) => inPeriod(r.date, periods.current));
  const previous = totals(prior),
    current = totals(now);
  const comparable = periods.previous.end < periods.current.start && periods.previous.expectedDays === periods.current.expectedDays && Object.values(periods).every((p) => p.expectedDays > 0 && p.observedDays === p.expectedDays);
  const channels = [...groupBy(rows, (r) => r.channel || r.campaign || "—")]
    .map(([name, rs]) => {
      const ch = entity(name, rs, periods, options.targetCpa, comparable, grain);
      ch.campaigns = [
        ...groupBy(
          rs.filter((r) => r.campaign),
          (r) => r.campaign,
        ),
      ].map(([n, c]) => entity(n, c, periods, options.targetCpa, comparable, grain));
      return ch;
    })
    .sort((a, b) => (b.current.cost || 0) - (a.current.cost || 0) || a.name.localeCompare(b.name));
  const warnings = [];
  if (invalid) warnings.push("invalid_input");
  if (mixed) warnings.push("mixed_currency");
  if (rows.length && !comparable) warnings.push("incomplete_period");
  if ([...prior, ...now].some((r) => !known(r.cost) || !known(r.result))) warnings.push("missing_metrics");
  const heldScope =
    options.supplementalScopeHeld === true ||
    ["market", "platform"].some((key) => new Set(rows.map((r) => r[key] || "")).size > 1);
  const organic = organicPanel(
    heldScope ? [] : rows,
    periods,
    comparable,
    options.organicExclusive === true,
    grain,
  );
  const channelPerformance = channelPerformanceHistory(rows, grain, periods.current.end, heldScope);
  if (heldScope) {
    organic.reason = "mixed_scope";
    organic.lags = [];
  }
  const status = invalid
    ? "invalid"
    : mixed
      ? "mixed"
      : !rows.length
        ? "empty"
        : comparable
          ? "ready"
          : "insufficient";
  return {
    status,
    currency,
    grain,
    periods,
    previous,
    current,
    channels,
    warnings,
    pvm: mixRate(prior, now, comparable),
    organic,
    creative: creativePanel(rows, periods, comparable, grain),
    channelPerformance,
    budget: diagnosisBudget(channels, current, {
      ...options,
      grain,
      currency,
      complete: comparable,
      days: periods.current.expectedDays,
    }),
  };
}
