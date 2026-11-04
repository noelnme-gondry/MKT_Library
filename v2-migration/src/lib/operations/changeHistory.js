import { dateOrdinal } from "@/lib/analysisPeriod";
import { parseNumericStrict } from "@/utils/parseNumeric";
import { PVM_MATH } from "@/utils/pvmMath";
import { operationsTotals } from "./operationsBrief";
import { operationsEntityKey, operationsTarget, operationsUnit, matchesOperationsTarget } from "./operationsIdentity";

export const HISTORY_RULES = Object.freeze({ windowDays: 7, changeThreshold: 0.2, absentDays: 3 });
export const shiftDate = (date, days) => new Date((dateOrdinal(date) + days) * 86400000).toISOString().slice(0, 10);
const validDate = date => /^\d{4}-\d{2}-\d{2}$/.test(date || "") && dateOrdinal(date) != null;
const rangeRows = (rows, start, end) => rows.filter(row => row.date >= start && row.date <= end);
const coverage = (rows, days) => new Set(rows.map(row => row.date)).size === days;

export function compareOperationsChange(rows, { date, target, days = 7, metric = "installs" }) {
  if (!validDate(date) || !Number.isInteger(days) || days < 1 || days > 90) return { ok: false, reason: "date" };
  const selected = rows.filter(row => matchesOperationsTarget(row, target) && validDate(row.date));
  const before = { start: shiftDate(date, -days), end: shiftDate(date, -1) };
  const after = { start: date, end: shiftDate(date, days - 1) };
  const a = rangeRows(selected, before.start, before.end), b = rangeRows(selected, after.start, after.end);
  if (!coverage(a, days) || !coverage(b, days)) return { ok: false, reason: "coverage", before, after };
  const previous = operationsTotals(a, metric), current = operationsTotals(b, metric);
  if (previous.cost == null || current.cost == null || previous.results == null || current.results == null) return { ok: false, reason: "values", before, after };
  const project = values => values.map(row => ({ ...row, spend: row.cost, _entity: "target", creative_id: String(row.creative_id || "") }));
  const keys = { ch: "_entity", cr: "creative_id", resultField: metric };
  const left = project(a), right = project(b);
  const pvm = PVM_MATH.inspectFinestInputs(left, right, keys).ok ? PVM_MATH.decomposeFinest(left, right, keys) : null;
  return { ok: true, before, after, previous, current, days, pvm,
    costChange: previous.cost > 0 ? current.cost / previous.cost - 1 : null,
    cprChange: previous.cpr > 0 && current.cpr != null ? current.cpr / previous.cpr - 1 : null };
}

/** Full-history scan. Windows locate sustained changes; they are not significance tests or causal estimates. */
export function buildOperationsHistory(rows, metric = "installs", rules = HISTORY_RULES) {
  const unit = operationsUnit(rows), groups = new Map(), allDates = new Set();
  for (const row of rows) {
    if (!validDate(row.date)) continue;
    allDates.add(row.date);
    const id = operationsEntityKey(row, unit);
    if (!groups.has(id)) groups.set(id, { id, target: operationsTarget(row, unit), name: row.campaign_name || row.campaign_id || row.channel || "—", rows: [], days: new Map() });
    const group = groups.get(id); group.rows.push(row);
    if (!group.days.has(row.date)) group.days.set(row.date, []);
    group.days.get(row.date).push(row);
  }
  const dates = [...allDates].sort(), events = [];
  let scanned = 0;
  const push = (group, date, kind, extra = {}) => events.push({ id: JSON.stringify([group.id, date, kind, extra.creative || ""]), entityId: group.id, target: group.target,
    name: group.name, date, kind, source: "observed", ...extra });
  for (const group of groups.values()) {
    const daily = [...group.days].sort(([a], [b]) => a.localeCompare(b)).map(([date, values]) => ({ date, ...operationsTotals(values, metric),
      budgets: [...new Set(values.map(row => parseNumericStrict(row.daily_budget)).filter(value => value != null && value >= 0))] }));
    let lastSpend = -Infinity, lastCpr = -Infinity;
    for (let i = 0; i < daily.length; i++) {
      const day = daily[i], ordinal = dateOrdinal(day.date), prev = daily[i - 1];
      if (prev && ordinal - dateOrdinal(prev.date) === 1 && day.budgets.length === 1 && prev.budgets.length === 1 && day.budgets[0] !== prev.budgets[0]) {
        push(group, day.date, "budget_setting", { beforeValue: prev.budgets[0], afterValue: day.budgets[0] });
      }
      const n = rules.windowDays;
      if (i < n || i + n > daily.length) continue;
      const before = daily.slice(i - n, i), after = daily.slice(i, i + n);
      if (dateOrdinal(before[0].date) !== ordinal - n || dateOrdinal(after.at(-1).date) !== ordinal + n - 1) continue;
      if ([...before, ...after].some(row => row.cost == null || row.results == null)) continue;
      scanned++;
      const total = list => ({ cost: list.reduce((s, d) => s + d.cost, 0), results: list.reduce((s, d) => s + d.results, 0) });
      const a = total(before), b = total(after);
      const costChange = a.cost > 0 ? b.cost / a.cost - 1 : null;
      const cprChange = a.cost > 0 && a.results > 0 && b.results > 0 ? (b.cost / b.results) / (a.cost / a.results) - 1 : null;
      if (costChange != null && Math.abs(costChange) >= rules.changeThreshold && ordinal - lastSpend >= n) {
        push(group, day.date, "spend", { change: costChange, beforeValue: a.cost / n, afterValue: b.cost / n }); lastSpend = ordinal;
      }
      if (cprChange != null && Math.abs(cprChange) >= rules.changeThreshold && ordinal - lastCpr >= n) {
        push(group, day.date, "efficiency", { change: cprChange, beforeValue: a.cost / a.results, afterValue: b.cost / b.results }); lastCpr = ordinal;
      }
    }
    const creatives = new Map();
    for (const row of group.rows) if (row.creative_id && parseNumericStrict(row.cost) > 0) {
      const id = String(row.creative_id);
      if (!creatives.has(id)) creatives.set(id, []);
      creatives.get(id).push(row.date);
    }
    for (const [creative, observed] of creatives) {
      const seen = [...new Set(observed)].sort();
      if (seen[0] > daily[0].date) push(group, seen[0], "creative_first", { creative });
      for (let i = 0; i < seen.length; i++) {
        const next = seen[i + 1] || shiftDate(daily.at(-1).date, 1);
        if (dateOrdinal(next) - dateOrdinal(seen[i]) <= rules.absentDays) continue;
        const missing = Array.from({ length: rules.absentDays }, (_, d) => shiftDate(seen[i], d + 1));
        if (missing.every(date => group.days.has(date))) {
          push(group, missing[0], "creative_absent", { creative, confirmedThrough: missing.at(-1) });
          if (seen[i + 1]) push(group, next, "creative_return", { creative });
        }
      }
    }
  }
  return { events: events.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id)), groups, dates, scanned, rules, invalidDates: rows.filter(row => !validDate(row.date)).length };
}
