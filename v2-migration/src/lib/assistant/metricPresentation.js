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
  // CTR·CVR은 보통 1~5% 대라 소수 한 자리로는 두 기간이 같은 값으로 보인다(2.64%·2.59% → 2.6%·2.6%).
  // 두 자리로 고정해 변화가 보이게 한다. ROAS·리텐션은 값이 커서 한 자리로 충분하다.
  const fine = ["ctr", "cvr"].includes(key);
  return new Intl.NumberFormat(language, money
    ? { style: "currency", currency: currency === "USD" ? "USD" : "KRW", maximumFractionDigits: currency === "USD" ? 2 : 0 }
    : fine ? { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 }
      : rate ? { style: "percent", maximumFractionDigits: 1 } : { maximumFractionDigits: 0 }).format(Number(value));
}
