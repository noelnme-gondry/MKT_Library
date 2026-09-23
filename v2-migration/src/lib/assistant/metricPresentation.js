export function metricChangeTone(metric, change) {
  if (!Number.isFinite(change) || change === 0) return "neutral";
  const key = String(metric).toLowerCase();
  const lowerIsBetter = ["cpa", "cpi", "cpr", "cac"].includes(key);
  const higherIsBetter = ["roas", "revenue", "actions", "installs", "conversions", "act", "inst", "rev", "profit", "ret", "cvr"].includes(key);
  if (!lowerIsBetter && !higherIsBetter) return "neutral";
  return (lowerIsBetter ? change < 0 : change > 0) ? "improved" : "worsened";
}

// 원본 통화의 단위만 표시하며 환산하지 않는다.
export function formatComparisonMetric(metric, value, locale = "ko", currency = "KRW") {
  if (value == null || value === "" || !Number.isFinite(Number(value))) return "—";
  const key = String(metric).toLowerCase();
  const language = locale === "en" ? "en-US" : "ko-KR";
  const money = ["cost", "spend", "cpa", "cpi", "cpr", "cac", "rev", "revenue", "profit"].includes(key);
  const rate = ["roas", "ctr", "cvr", "ret"].includes(key);
  return new Intl.NumberFormat(language, money
    ? { style: "currency", currency: currency === "USD" ? "USD" : "KRW", maximumFractionDigits: currency === "USD" ? 2 : 0 }
    : rate ? { style: "percent", maximumFractionDigits: 1 } : { maximumFractionDigits: 0 }).format(Number(value));
}
