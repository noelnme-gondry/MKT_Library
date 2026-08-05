function asDate(value) {
  const text = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return "";
  const [year, month, day] = text.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? text : "";
}

function addDays(dateText, days) {
  const date = new Date(`${dateText}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function comparisonWindowDays(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 60 ? parsed : 7;
}

function metricKind(metric) {
  const text = String(metric ?? "").normalize("NFKC").toUpperCase();
  if (/(^|[^A-Z])CPA([^A-Z]|$)/.test(text)) return "cpa";
  if (/(^|[^A-Z])CPI([^A-Z]|$)/.test(text)) return "cpi";
  if (/(^|[^A-Z])ROAS([^A-Z]|$)/.test(text)) return "roas";
  return "";
}

function finite(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function currencySuffix(baseline) {
  const text = String(baseline ?? "");
  if (text.includes("원")) return "원";
  if (text.includes("₩")) return "₩";
  return "";
}

function formatActual(metric, value, baseline) {
  const decimals = Math.abs(value) < 10 ? 2 : 0;
  const number = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: decimals }).format(value);
  if (String(baseline ?? "").includes("$")) return `${metric || "Metric"} $${number}`;
  const suffix = currencySuffix(baseline);
  return `${metric || "Metric"} ${suffix === "₩" ? "₩" : ""}${number}${suffix === "원" ? "원" : ""}`;
}

export function latestDecisionDataDate(canonicalData = {}) {
  return (canonicalData?.records || []).reduce((latest, row) => {
    const date = asDate(row?.date);
    return date && (!latest || date > latest) ? date : latest;
  }, "");
}

// 결정의 기준일 이후가 아니라, 사용자가 약속한 검토일 이후의 같은 길이 기간만
// 후보로 쓴다. 따라서 오래된 CSV의 마지막 N일을 '현재 성과'로 오인하지 않는다.
export function buildComparableDecisionActual(record = {}, { canonicalData, today } = {}) {
  const baselineDate = asDate(record.baselineDate ?? record.baseline_date);
  const reviewDate = asDate(record.reviewDate ?? record.review_date);
  const normalizedToday = asDate(today);
  const windowDays = comparisonWindowDays(record.comparisonWindowDays ?? record.comparison_window_days);
  const kind = metricKind(record.metric);
  const comparisonStart = reviewDate || "";
  const comparisonEnd = comparisonStart ? addDays(comparisonStart, windowDays - 1) : "";
  const latestDataDate = latestDecisionDataDate(canonicalData);

  if (!baselineDate) return { state: "missing_baseline_date", windowDays, latestDataDate };
  if (!reviewDate) return { state: "missing_review_date", windowDays, latestDataDate };
  if (!kind) return { state: "unsupported_metric", windowDays, latestDataDate, comparisonStart, comparisonEnd };
  if (!normalizedToday || reviewDate > normalizedToday) {
    return { state: "not_due", windowDays, latestDataDate, comparisonStart, comparisonEnd };
  }
  if (!latestDataDate || latestDataDate < comparisonStart) {
    return { state: "waiting_for_data", windowDays, latestDataDate, comparisonStart, comparisonEnd };
  }

  const rows = (canonicalData?.records || []).filter((row) => {
    const date = asDate(row?.date);
    return date && date >= comparisonStart && date <= comparisonEnd;
  });
  const observedDates = new Set(rows.map((row) => asDate(row.date)).filter(Boolean));
  if (observedDates.size < windowDays || latestDataDate < comparisonEnd) {
    return { state: "incomplete_window", windowDays, latestDataDate, comparisonStart, comparisonEnd, observedDays: observedDates.size };
  }

  const totals = rows.reduce((sum, row) => {
    const metrics = row?.metrics || {};
    sum.cost += finite(metrics.cost);
    sum.actions += finite(metrics.actions);
    sum.installs += finite(metrics.installs);
    sum.revenue += finite(metrics.revenue_d7) || finite(metrics.revenue_d0) || finite(metrics.revenue_d1);
    return sum;
  }, { cost: 0, actions: 0, installs: 0, revenue: 0 });
  const denominator = kind === "cpa" ? totals.actions : kind === "cpi" ? totals.installs : totals.cost;
  const numerator = kind === "roas" ? totals.revenue : totals.cost;
  if (!(denominator > 0) || !(numerator >= 0)) {
    return { state: "missing_metric_values", windowDays, latestDataDate, comparisonStart, comparisonEnd };
  }
  const value = numerator / denominator;
  if (!Number.isFinite(value)) return { state: "missing_metric_values", windowDays, latestDataDate, comparisonStart, comparisonEnd };
  return {
    state: "ready",
    value,
    actual: formatActual(record.metric, value, record.baseline),
    windowDays,
    latestDataDate,
    comparisonStart,
    comparisonEnd,
    observedDays: observedDates.size,
  };
}
