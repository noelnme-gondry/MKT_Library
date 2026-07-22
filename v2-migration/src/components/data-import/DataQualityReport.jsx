"use client";
import { buildDataQualityReport } from "@/lib/data-import/buildDataQualityReport";

const COPY = {
  ko: {
    ready: "분석 가능", caution: "주의해서 해석", unfit: "분석 부적합", rows: "유효 행", periods: "관측 기간",
    exploratory: "탐색용 MMM", decision: "의사결정용 MMM",
    missing_date: "날짜 누락", duplicates: "중복 그레인", invalid_values: "형식 오류", period_gaps: "기간 공백", high_missing_rate: "결측률 높음", all_zero_metric: "전 기간 0", outliers: "이상치",
    detail: "세부 데이터 품질 정보",
  },
  en: {
    ready: "Ready", caution: "Use with caution", unfit: "Not suitable", rows: "Valid rows", periods: "Periods",
    exploratory: "Exploratory MMM", decision: "Decision-ready MMM",
    missing_date: "Missing dates", duplicates: "Duplicate grain", invalid_values: "Invalid values", period_gaps: "Period gaps", high_missing_rate: "High missingness", all_zero_metric: "All zeros", outliers: "Outliers",
    detail: "Data quality details",
  },
};

function QualityHint({ text, label }) {
  if (!text) return null;
  return <span className="data-confidence-hint" role="img" tabIndex={0} aria-label={label} data-tooltip={text}>ⓘ</span>;
}

export default function DataQualityReport({ canonicalData, metricKeys, eligibility, locale = "ko" }) {
  const T = COPY[locale] || COPY.ko;
  const report = buildDataQualityReport(canonicalData, { metricKeys });
  const tone = report.grade === "ready" ? "#5ad19a" : report.grade === "caution" ? "#f7b955" : "#f0917e";
  const issueDetail = report.issues.map((issue) => `${T[issue.code]} ${issue.count}건`).join(" · ");
  const confidenceDetail = eligibility?.reasonDetails?.join(" ");
  return (
    <section className="required-banner data-quality-report" style={{ borderLeftColor: tone, marginTop: "14px" }}>
      <strong>◉ {T[report.grade]}</strong>
      <span style={{ color: "var(--text-muted)", marginLeft: "8px", fontSize: "12px" }}>{T.rows} {report.rowCount.toLocaleString()} · {T.periods} {report.periodCount.toLocaleString()}</span>
      {eligibility?.confidenceTier && eligibility.confidenceTier !== "standard" && (
        <span className={`data-confidence-tier ${eligibility.confidenceTier}`}>
          {T[eligibility.confidenceTier]}
          <QualityHint text={confidenceDetail} label={T.detail} />
        </span>
      )}
      {report.issues.length > 0 && <QualityHint text={issueDetail} label={T.detail} />}
    </section>
  );
}
