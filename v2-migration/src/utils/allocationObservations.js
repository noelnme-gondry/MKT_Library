import { calcChannelHistorySummary, getRowGroupKey } from "./budgetAllocTool";
import { parseNumericStrict } from "./parseNumeric";

const DAY_MS = 86400000;
const VALUE_FIELDS = ["cost", "installs", "actions", "revenue_d7", "pu_d7"];
const day = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return null;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value ? parsed / DAY_MS : null;
};

export function allocationCadence(csvData, selected = "auto") {
  if (selected !== "auto") return selected;
  const dateHeader = Object.entries(csvData?.mapping || {}).find(([, field]) => field === "date")?.[0] || "";
  return /^(?:iso[ _-]?)?week(?:[ _-]?start)?$|주시작|주간/i.test(dateHeader) ? "weekly" : "daily";
}

export function allocationSnapshotDate(rows, explicit = "") {
  if (day(explicit) != null) return explicit;
  const dates = [...new Set(rows.map(row => row.snapshot_date).filter(value => day(value) != null))];
  return dates.length === 1 ? dates[0] : "";
}

/** Weekly rows remain one observation each. Never expand them into seven pseudo-observations. */
export function prepareAllocationObservations(rows, { cadence = "daily", asOfDate = "", matureRevenue = true, groupByPlatform = true, metric = "actions", unit = "channel", range = {} } = {}) {
  const periodDays = cadence === "weekly" ? 7 : 1;
  const snapshot = allocationSnapshotDate(rows, asOfDate);
  const asOf = day(snapshot);
  const excluded = [];
  const prepared = [];
  const groupKey = row => getRowGroupKey(groupByPlatform ? row : { ...row, platform: "" }, unit);
  const overlapping = new Set();
  if (periodDays === 7) {
    const datesByGroup = new Map();
    for (const row of rows) {
      const key = groupKey(row), date = day(row.date);
      if (date == null) continue;
      if (!datesByGroup.has(key)) datesByGroup.set(key, new Set());
      datesByGroup.get(key).add(date);
    }
    for (const [key, values] of datesByGroup) {
      const dates = [...values].sort((a, b) => a - b);
      if (dates.some((date, index) => index > 0 && date - dates[index - 1] < 7)) overlapping.add(key);
    }
  }
  for (const row of rows) {
    const start = day(row.date);
    const end = start == null ? null : start + periodDays - 1;
    const complete = asOf == null || end == null ? null : end < asOf;
    const mature = asOf == null || end == null ? null : end + 7 < asOf;
    const cost = parseNumericStrict(row.cost), result = parseNumericStrict(row[metric]);
    const partialSelection = periodDays === 7 && ((day(range.start) != null && start < day(range.start)) || (day(range.end) != null && end > day(range.end)));
    const reason = start == null ? "INVALID_PERIOD_DATE" : overlapping.has(groupKey(row)) ? "OVERLAPPING_PERIODS" : partialSelection ? "PARTIAL_SELECTED_PERIOD" : complete === false ? "INCOMPLETE_PERIOD" : metric === "revenue_d7" && matureRevenue && mature !== true ? (mature === false ? "IMMATURE_D7" : "D7_AS_OF_MISSING") : cost == null || result == null || cost < 0 || result < 0 ? "INVALID_MEASUREMENT" : null;
    if (reason) { excluded.push({ date: row.date, reason }); continue; }
    const next = { ...row, allocationPeriodDays: periodDays, allocationRevenueMature: mature };
    if (!groupByPlatform) next.platform = "";
    for (const field of VALUE_FIELDS) {
      const value = parseNumericStrict(row[field]);
      next[field] = value == null ? null : value / periodDays;
    }
    if (matureRevenue && mature !== true) { next.revenue_d7 = null; next.pu_d7 = null; }
    prepared.push(next);
  }
  return { rows: prepared, excluded, cadence, periodDays, asOfDate: snapshot, maturityKnown: asOf != null };
}

/** Complete weekly aggregates are averaged as weeks, not divided by calendar days twice. */
export function allocationHistory(rows, unit, channel, metric, { recentDays = 7 } = {}) {
  if (!rows.some(row => row.allocationPeriodDays === 7)) {
    const history = calcChannelHistorySummary(rows, unit, channel, metric, { recentDays });
    const latest = Math.max(...rows.map(row => day(row.date)).filter(value => value != null));
    const relevant = rows.filter(row => getRowGroupKey(row, unit) === channel && day(row.date) > latest - recentDays);
    return history && relevant.some(row => row.revenue_d7 == null) ? { ...history, totalRevenue: null, avgROAS: null } : history;
  }
  const maxDate = Math.max(...rows.map(row => day(row.date)).filter(value => value != null));
  const windowRows = rows.filter(row => getRowGroupKey(row, unit) === channel && day(row.date) > maxDate - recentDays);
  if (!windowRows.length) return null;
  const periods = new Set(windowRows.map(row => row.date)).size;
  const sums = Object.fromEntries(VALUE_FIELDS.map(field => [field, windowRows.reduce((sum, row) => sum + (Number(row[field]) || 0), 0)]));
  const average = field => sums[field] / periods;
  const results = average(metric);
  const cost = average("cost");
  const revenueKnown = windowRows.every(row => row.revenue_d7 != null);
  return {
    rowCount: windowRows.length, observedDays: periods * 7, periodCount: periods,
    latestCost: windowRows.filter(row => day(row.date) === maxDate).reduce((sum, row) => sum + (Number(row.cost) || 0), 0),
    totalCost: cost, totalResults: results, totalInstalls: average("installs"), totalActions: average("actions"),
    totalRevenue: revenueKnown ? average("revenue_d7") : null, totalPu: average("pu_d7"),
    avgCPR: results > 0 ? cost / results : null,
    avgCPI: sums.installs > 0 ? sums.cost / sums.installs : null,
    avgCPA: sums.actions > 0 ? sums.cost / sums.actions : null,
    avgROAS: revenueKnown && sums.cost > 0 ? sums.revenue_d7 / sums.cost : null,
    windowCost: sums.cost * 7, windowResults: (sums[metric] || 0) * 7,
  };
}
