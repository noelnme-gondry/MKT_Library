const METRIC_PRIORITY = ["cost", "actions", "installs", "revenue", "clicks", "impressions"];

function parseNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const normalized = String(value ?? "").replace(/[,$₩\s]/g, "");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDate(value) {
  if (!value) return null;
  const timestamp = Date.parse(String(value));
  return Number.isFinite(timestamp) ? timestamp : null;
}

function aggregatePeriod(rows, metricKeys) {
  const totals = Object.fromEntries(metricKeys.map((key) => [key, 0]));
  rows.forEach((row) => {
    metricKeys.forEach((key) => {
      const value = parseNumber(row[key]);
      if (value != null) totals[key] += value;
    });
  });
  return totals;
}

function delta(current, previous) {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return { current, previous, change: null, changePct: null };
  const change = current - previous;
  return { current, previous, change, changePct: previous === 0 ? null : change / Math.abs(previous) };
}

function cadenceLabel(sortedPeriods) {
  if (sortedPeriods.length < 2) return "periods";
  const gaps = sortedPeriods.slice(1).map((item, index) => item.timestamp - sortedPeriods[index].timestamp).filter((gap) => gap > 0).sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)] || 0;
  return median <= 2 * 86400000 ? "days" : "periods";
}

// 최근 동일 길이의 두 구간을 비교하는 공통 관측 요약. 수치만 집계하며 인과효과는
// 주장하지 않는다. Dashboard의 필터형 WoW 판정과 달리, 다른 도구 결과 카드에서
// 바로 읽을 수 있는 가벼운 기준선으로 쓴다.
export function buildRecentPeriodComparison(mappedRows = {}) {
  const rows = Array.isArray(mappedRows) ? mappedRows : [];
  const metricKeys = METRIC_PRIORITY.filter((key) => rows.some((row) => parseNumber(row?.[key]) != null));
  if (!metricKeys.length) return { available: false, reason: "no_metrics" };

  const byPeriod = new Map();
  rows.forEach((row) => {
    const timestamp = parseDate(row?.date);
    if (timestamp == null) return;
    const date = new Date(timestamp).toISOString().slice(0, 10);
    if (!byPeriod.has(date)) byPeriod.set(date, { date, timestamp: Date.parse(`${date}T00:00:00Z`), rows: [] });
    byPeriod.get(date).rows.push(row);
  });
  const periods = [...byPeriod.values()].sort((a, b) => a.timestamp - b.timestamp);
  if (periods.length < 4) return { available: false, reason: "not_enough_periods", periodCount: periods.length };

  const windowSize = periods.length >= 14 ? 7 : Math.floor(periods.length / 2);
  const previous = periods.slice(-(windowSize * 2), -windowSize);
  const recent = periods.slice(-windowSize);
  if (previous.length !== windowSize || recent.length !== windowSize) return { available: false, reason: "not_enough_periods", periodCount: periods.length };

  const previousTotals = aggregatePeriod(previous.flatMap((period) => period.rows), metricKeys);
  const recentTotals = aggregatePeriod(recent.flatMap((period) => period.rows), metricKeys);
  const resultKey = ["actions", "installs", "clicks", "impressions"].find((key) => metricKeys.includes(key));
  const metrics = [];
  if (metricKeys.includes("cost")) metrics.push({ key: "cost", ...delta(recentTotals.cost, previousTotals.cost) });
  if (resultKey) metrics.push({ key: resultKey, ...delta(recentTotals[resultKey], previousTotals[resultKey]) });
  if (metricKeys.includes("cost") && resultKey && previousTotals[resultKey] > 0 && recentTotals[resultKey] > 0) {
    metrics.push({ key: resultKey === "installs" ? "cpi" : resultKey === "actions" ? "cpa" : "cost_per_result", ...delta(recentTotals.cost / recentTotals[resultKey], previousTotals.cost / previousTotals[resultKey]) });
  }
  if (metricKeys.includes("revenue")) metrics.push({ key: "revenue", ...delta(recentTotals.revenue, previousTotals.revenue) });

  return {
    available: metrics.length > 0,
    periodCount: periods.length,
    cadence: cadenceLabel(periods),
    windowSize,
    previous: { start: previous[0].date, end: previous.at(-1).date },
    recent: { start: recent[0].date, end: recent.at(-1).date },
    metrics: metrics.slice(0, 3),
  };
}
