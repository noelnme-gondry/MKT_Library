import { parseNumericStrict } from "@/utils/parseNumeric";
import { parseDateValue } from "@/lib/data-import/normalizeValues";
import { isSummaryRow } from "@/lib/data-import/buildCanonicalDataset";
import { sourceCurrencyOf } from "@/utils/format";

export const MAX_ALERT_RULES = 20;
export const HISTORY_DAYS = 366;
export const ALERT_WINDOWS = [3, 7, 14, 28];
const dayMs = 86400000;
export const shiftDay = (date, amount) => new Date(Date.parse(`${date}T00:00:00Z`) + amount * dayMs).toISOString().slice(0, 10);
export const sourceHeader = (data, role) => {
  const matches = Object.entries(data?.mapping || {}).filter(([, value]) => value === role);
  return matches.length === 1 ? matches[0][0] : "";
};
const fingerprint = data => JSON.stringify([...(data?.headers || [])].sort());
const short = value => typeof value === "string" && value.length <= 250;
const validDay = value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && parseDateValue(value)?.isoDate === value;

// Backup imports reconstruct an allowlisted shape; never trust a stored verdict.
export function sanitizeAlertRules(input) {
  if (input == null) return [];
  if (!Array.isArray(input) || input.length > MAX_ALERT_RULES) throw new Error("ALERT_RULE_INVALID");
  const ids = new Set();
  return input.map(rule => {
    if (!rule || !short(rule.id) || !rule.id || ids.has(rule.id) || !short(rule.name) || !rule.name.trim()
      || !["cpr", "sum", "mean"].includes(rule.metric) || !["previous", "target"].includes(rule.comparison)
      || !["up", "down"].includes(rule.direction) || !ALERT_WINDOWS.includes(rule.days)
      || !Number.isFinite(rule.percent) || rule.percent < 0 || rule.percent > (rule.direction === "down" ? 100 : 10000)
      || !Number.isFinite(rule.target) || rule.target <= 0 || !short(rule.channel)
      || !short(rule.dateHeader) || !short(rule.channelHeader) || !short(rule.valueHeader) || !short(rule.denominatorHeader)
      || !["actions", "installs"].includes(rule.basis) || !["KRW", "USD"].includes(rule.currency)
      || typeof rule.schema !== "string" || rule.schema.length > 100000) throw new Error("ALERT_RULE_INVALID");
    ids.add(rule.id);
    const history = rule.history || [];
    if (!Array.isArray(history) || history.length > HISTORY_DAYS || history.some(point => !validDay(point.date)
      || !Number.isFinite(point.n) || point.n < 0 || !Number.isFinite(point.d) || point.d < 0)
      || new Set(history.map(point => point.date)).size !== history.length) throw new Error("ALERT_HISTORY_INVALID");
    return { id: rule.id, name: rule.name.trim().slice(0, 120), enabled: rule.enabled !== false,
      metric: rule.metric, comparison: rule.comparison, direction: rule.direction, days: rule.days,
      percent: rule.percent, target: rule.target, channel: rule.channel, dateHeader: rule.dateHeader,
      channelHeader: rule.channelHeader, valueHeader: rule.valueHeader, denominatorHeader: rule.denominatorHeader,
      basis: rule.basis, currency: rule.currency, schema: rule.schema,
      history: history.map(({ date, n, d }) => ({ date, n, d })).sort((a, b) => a.date.localeCompare(b.date)),
      checkedAt: Number.isFinite(rule.checkedAt) ? rule.checkedAt : null,
      end: validDay(rule.end) ? rule.end : null,
      // A backup contains observations, not a transferable validation approval.
      issue: rule.issue === null ? null : ["columns", "currency", "dates", "numbers", "scope", "coverage", "denominator"].includes(rule.issue) ? rule.issue : "unconfirmed" };
  });
}

export function bindAlertRule(draft, data, id) {
  const rule = { ...draft, id, enabled: true, schema: fingerprint(data), currency: sourceCurrencyOf(data),
    dateHeader: sourceHeader(data, "date"), channelHeader: sourceHeader(data, "channel"),
    valueHeader: draft.metric === "cpr" ? sourceHeader(data, "cost") : draft.valueHeader,
    denominatorHeader: draft.metric === "cpr" ? sourceHeader(data, draft.basis) : "",
    history: [], checkedAt: null, end: null, issue: "unconfirmed" };
  if (!rule.dateHeader || !rule.valueHeader || (rule.metric === "cpr" && !rule.denominatorHeader)
    || (rule.channel && !rule.channelHeader)) throw new Error("ALERT_MAPPING_REQUIRED");
  return sanitizeAlertRules([rule])[0];
}

export function collectAlertDays(rule, data) {
  if (fingerprint(data) !== rule.schema || sourceHeader(data, "date") !== rule.dateHeader
    || (rule.channelHeader && sourceHeader(data, "channel") !== rule.channelHeader)
    || (rule.metric === "cpr" && (sourceHeader(data, "cost") !== rule.valueHeader || sourceHeader(data, rule.basis) !== rule.denominatorHeader))) return { issue: "columns" };
  if (sourceCurrencyOf(data) !== rule.currency) return { issue: "currency" };
  const days = new Map();
  let start = null, end = null, issue = null;
  const invalidDays = new Set();
  for (const row of data.raw || []) {
    if (isSummaryRow(row, data)) continue;
    const parsed = parseDateValue(row[rule.dateHeader]);
    if (!parsed || parsed.ambiguous || parsed.grain !== "day") return { issue: "dates" };
    const date = parsed.isoDate;
    start = !start || date < start ? date : start;
    end = !end || date > end ? date : end;
    if (rule.channel && String(row[rule.channelHeader] ?? "").trim() !== rule.channel) continue;
    const n = parseNumericStrict(row[rule.valueHeader]);
    const d = rule.metric === "cpr" ? parseNumericStrict(row[rule.denominatorHeader]) : 1;
    if (n === null || d === null || n < 0 || d < 0) { issue = "numbers"; invalidDays.add(date); continue; }
    const point = days.get(date) || { date, n: 0, d: 0 };
    point.n += n; point.d += d;
    if (!Number.isFinite(point.n) || !Number.isFinite(point.d)) { issue = "numbers"; invalidDays.add(date); continue; }
    days.set(date, point);
  }
  invalidDays.forEach(date => days.delete(date));
  if (issue) return { issue, start, end, days: [...days.values()] };
  if (!end || !days.size) return { issue: "scope", start, end, days: [] };
  return { issue: null, start, end, days: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)) };
}

export function pointValue(rule, points) {
  const n = points.reduce((total, point) => total + point.n, 0);
  const d = points.reduce((total, point) => total + point.d, 0);
  return rule.metric === "sum" ? n : d > 0 ? n / d : null;
}

export function evaluateAlert(rule) {
  if (rule.issue) return { status: "unavailable", issue: rule.issue };
  if (!rule.end) return { status: "unavailable", issue: "unconfirmed" };
  const currentStart = shiftDay(rule.end, 1 - rule.days);
  const previousEnd = shiftDay(currentStart, -1), previousStart = shiftDay(currentStart, -rule.days);
  const take = (start, end) => rule.history.filter(point => point.date >= start && point.date <= end);
  const current = take(currentStart, rule.end), previous = take(previousStart, previousEnd);
  const periods = { currentStart, currentEnd: rule.end, previousStart, previousEnd };
  if (current.length !== rule.days || (rule.comparison === "previous" && previous.length !== rule.days)) return { ...periods, status: "unavailable", issue: "coverage" };
  const value = pointValue(rule, current), reference = rule.comparison === "target" ? rule.target : pointValue(rule, previous);
  if (value === null || reference === null || reference <= 0) return { ...periods, status: "unavailable", issue: "denominator" };
  if (!Number.isFinite(value) || !Number.isFinite(reference)) return { ...periods, status: "unavailable", issue: "numbers" };
  const change = (value / reference - 1) * 100;
  const threshold = reference * (1 + (rule.direction === "up" ? 1 : -1) * rule.percent / 100);
  if (!Number.isFinite(change) || !Number.isFinite(threshold)) return { ...periods, status: "unavailable", issue: "numbers" };
  const roundoff = Number.EPSILON * 8 * Math.max(1, Math.abs(value), Math.abs(threshold));
  const met = rule.direction === "up" ? value >= threshold - roundoff : value <= threshold + roundoff;
  return { ...periods, status: met ? "triggered" : "clear", value, reference, change, threshold };
}

export function applyAlertDays(rule, collected, now = Date.now()) {
  if (collected.issue && !(collected.start && collected.end && ["scope", "numbers"].includes(collected.issue))) return { ...rule, issue: collected.issue, checkedAt: now };
  // A new file replaces its entire interval, including absent dates/channels.
  // Do not combine a partial replacement with stale observations in that interval.
  const history = [...rule.history.filter(point => point.date < collected.start || point.date > collected.end), ...collected.days]
    .sort((a, b) => a.date.localeCompare(b.date));
  const end = collected.end;
  return { ...rule, history: history.filter(point => point.date >= shiftDay(history.at(-1)?.date || end, 1 - HISTORY_DAYS)).slice(-HISTORY_DAYS), end, issue: collected.issue, checkedAt: now };
}

export function checkAlert(rule, data, now = Date.now()) {
  return applyAlertDays(rule, collectAlertDays(rule, data), now);
}
export const sameAlertSeries = (left, right) => Boolean(left && right) && ["schema", "currency", "metric", "basis", "channel", "dateHeader", "channelHeader", "valueHeader", "denominatorHeader"].every(key => left[key] === right[key]);
