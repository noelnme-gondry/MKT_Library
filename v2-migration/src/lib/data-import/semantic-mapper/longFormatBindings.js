const normalized = (value) => String(value || "").normalize("NFKC").trim().toLowerCase().replace(/[\s_-]+/g, "_");
const ROLE_BY_METRIC_VALUE = {
  spend: "media_spend", cost: "media_spend", expense: "media_spend", 광고비: "media_spend", 비용: "media_spend",
  impressions: "media_impressions", impression: "media_impressions", 노출: "media_impressions",
  clicks: "media_clicks", click: "media_clicks", taps: "media_clicks", 클릭: "media_clicks",
  installs: "outcome_installs", install: "outcome_installs", 설치: "outcome_installs",
  revenue: "outcome_revenue", sales: "outcome_revenue", 매출: "outcome_revenue",
};

export function detectLongFormatBindings({ headers = [], rows = [], representation } = {}) {
  if (representation !== "long") return [];
  const metricColumn = headers.find((header) => /^(metric|measure|지표|항목)$/i.test(String(header).trim()));
  const valueColumn = headers.find((header) => /^(value|values|값|수치)$/i.test(String(header).trim()));
  if (!metricColumn || !valueColumn) return [];
  const values = [...new Set(rows.slice(0, 500).map((row) => String(row?.[metricColumn] || "").trim()).filter(Boolean))];
  return values.flatMap((value) => {
    const canonicalKey = ROLE_BY_METRIC_VALUE[normalized(value)];
    return canonicalKey ? [{ metricColumn, valueColumn, when: { equals: value }, canonicalKey, decision: "SUGGEST" }] : [];
  });
}
