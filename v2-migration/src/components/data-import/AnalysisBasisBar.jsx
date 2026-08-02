"use client";

import { useMemo } from "react";
import { buildDataQualityReport } from "@/lib/data-import/buildDataQualityReport";
import { ANALYSIS_CONTRACTS, evaluateEligibility } from "@/lib/analysis-router/evaluateEligibility";
import { buildRecentPeriodComparison } from "@/lib/analysis-results/periodComparison";
import EvidenceStatusBadge from "@/components/ds/EvidenceStatusBadge";

const qualityCache = new WeakMap();
const comparisonCache = new WeakMap();

const COPY = {
  ko: {
    basis: "데이터 기준",
    rows: "행",
    periods: "기간",
    ready: "기본 조건 충족",
    caution: "확인 후 해석",
    unfit: "데이터 보완 필요",
    compare: "최근 비교",
    days: "일",
    periodsUnit: "기간",
    details: "데이터 확인 항목",
    noIssues: "현재 확인된 데이터 품질 문제는 없습니다.",
    missing_date: "날짜가 비어 있습니다. 기간과 연결할 수 없는 행은 제외하거나 날짜를 채우세요.",
    duplicates: "같은 날짜·차원 조합이 겹칩니다. 중복을 제거하거나 한 행으로 집계하세요.",
    invalid_values: "숫자 또는 날짜 형식이 아닙니다. 통화 기호·문자열·날짜 형식을 확인하세요.",
    period_gaps: "기간 사이 공백이 있습니다. 실제 미집행만 0으로 넣고, 누락값은 실제값으로 채우세요.",
    high_missing_rate: "핵심 지표의 결측이 많습니다. 빈칸과 0을 같은 의미로 처리하지 마세요.",
    all_zero_metric: "핵심 지표가 모두 0입니다. 매핑한 열과 단위를 다시 확인하세요.",
    outliers: "평소 범위를 크게 벗어난 값이 있습니다. 단위·통화·일시적 이벤트를 확인하세요.",
  },
  en: {
    basis: "Data basis",
    rows: "rows",
    periods: "periods",
    ready: "Core checks passed",
    caution: "Check before interpreting",
    unfit: "Data needs repair",
    compare: "Recent comparison",
    days: "days",
    periodsUnit: "periods",
    details: "Data checks",
    noIssues: "No data quality issues were detected in the current file.",
    missing_date: "Some rows have no date. Exclude rows that cannot be tied to a period, or fill the date.",
    duplicates: "The same date-and-dimension combination repeats. Remove duplicates or aggregate them into one row.",
    invalid_values: "A number or date could not be read. Check currency symbols, text values, and date format.",
    period_gaps: "There is a gap between periods. Use zero only for true no-spend periods; otherwise supply the actual value.",
    high_missing_rate: "A key metric has substantial missingness. Do not treat blanks and zero as the same thing.",
    all_zero_metric: "A key metric is zero throughout. Re-check the mapped column and its unit.",
    outliers: "Some values are far outside the usual range. Check scale, currency, and one-off events.",
  },
};

const METRIC_LABEL = {
  cost: ["비용", "Cost"], actions: ["전환", "Actions"], installs: ["설치", "Installs"],
  revenue: ["매출", "Revenue"], clicks: ["클릭", "Clicks"], impressions: ["노출", "Impressions"],
  cpa: ["CPA", "CPA"], cpi: ["CPI", "CPI"], cost_per_result: ["결과당 비용", "Cost / result"],
};

function number(value, locale, precision = 0) {
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "ko-KR", { maximumFractionDigits: precision }).format(value);
}

function formatDelta(metric, locale) {
  if (metric.changePct == null) return "—";
  const sign = metric.changePct > 0 ? "+" : "";
  return `${sign}${number(metric.changePct * 100, locale, 1)}%`;
}

function cachedQualityReport(canonicalData, metricKeys) {
  if (!canonicalData || typeof canonicalData !== "object") return buildDataQualityReport(canonicalData, { metricKeys });
  const signature = [...metricKeys].sort().join("|");
  const cache = qualityCache.get(canonicalData) || new Map();
  if (!qualityCache.has(canonicalData)) qualityCache.set(canonicalData, cache);
  if (!cache.has(signature)) cache.set(signature, buildDataQualityReport(canonicalData, { metricKeys }));
  return cache.get(signature);
}

function cachedPeriodComparison(mappedRows) {
  if (!Array.isArray(mappedRows)) return buildRecentPeriodComparison(mappedRows);
  if (!comparisonCache.has(mappedRows)) comparisonCache.set(mappedRows, buildRecentPeriodComparison(mappedRows));
  return comparisonCache.get(mappedRows);
}

export default function AnalysisBasisBar({ canonicalData, mappedRows, mapping, toolId, eligibility: providedEligibility = null, locale = "ko", showPeriodComparison = true, useMappedMetrics = true }) {
  const T = COPY[locale] || COPY.ko;
  const metricKeys = useMemo(() => (
    useMappedMetrics ? Object.values(mapping || {}).filter((key) => key && key !== "__ignore__") : []
  ), [mapping, useMappedMetrics]);
  const report = useMemo(() => cachedQualityReport(canonicalData, metricKeys), [canonicalData, metricKeys]);
  const eligibility = useMemo(() => (
    providedEligibility || (ANALYSIS_CONTRACTS[toolId] && canonicalData
      ? evaluateEligibility({ toolId, mapping, canonicalData })
      : null)
  ), [providedEligibility, toolId, mapping, canonicalData]);
  const comparison = useMemo(() => (
    showPeriodComparison ? cachedPeriodComparison(mappedRows) : { available: false }
  ), [mappedRows, showPeriodComparison]);

  if (!canonicalData?.records?.length) return null;
  const status = eligibility?.statisticalStatus;
  const isCaution = report.grade === "caution" || status === "CAUTION";
  const isUnfit = report.grade === "unfit" || status === "INSUFFICIENT_DATA";
  const label = isUnfit ? T.unfit : isCaution ? T.caution : T.ready;
  const primaryMetric = comparison.metrics?.find((metric) => ["actions", "installs", "revenue", "clicks"].includes(metric.key)) || comparison.metrics?.[0];
  const issueCount = report.issues.length;

  return (
    <section className={`analysis-basis-bar ${isUnfit ? "is-unfit" : isCaution ? "is-caution" : "is-ready"}`} aria-label={T.basis}>
      <div className="analysis-basis-bar__status">
        <span className="analysis-basis-bar__signal" aria-hidden>●</span>
        <span className="analysis-basis-bar__label">{T.basis}</span>
        <strong>{label}</strong>
        <span className="analysis-basis-bar__meta">{number(report.rowCount, locale)} {T.rows} · {number(report.periodCount, locale)} {T.periods}</span>
        {status && <EvidenceStatusBadge status={status} locale={locale} />}
      </div>

      {comparison.available && primaryMetric && (
        <div className="analysis-basis-bar__comparison">
          <span>{T.compare} · {comparison.windowSize} {comparison.cadence === "days" ? T.days : T.periodsUnit}</span>
          <strong>{METRIC_LABEL[primaryMetric.key]?.[locale === "en" ? 1 : 0] || primaryMetric.key} {formatDelta(primaryMetric, locale)}</strong>
          <span className="analysis-basis-bar__range">{comparison.recent.start} → {comparison.recent.end}</span>
        </div>
      )}

      <details className="analysis-basis-bar__details">
        <summary>{issueCount ? `${T.details} · ${issueCount}` : T.details}</summary>
        <div>
          {report.issues.length === 0 ? <p>{T.noIssues}</p> : (
            <ul>{report.issues.map((issue) => <li key={issue.code}>{T[issue.code] || issue.code}</li>)}</ul>
          )}
          {comparison.available && comparison.metrics.length > 1 && (
            <div className="analysis-basis-bar__metric-list">
              {comparison.metrics.map((metric) => (
                <span key={metric.key}>{METRIC_LABEL[metric.key]?.[locale === "en" ? 1 : 0] || metric.key} <strong>{formatDelta(metric, locale)}</strong></span>
              ))}
            </div>
          )}
        </div>
      </details>
    </section>
  );
}
