"use client";
import { buildDataQualityReport } from "@/lib/data-import/buildDataQualityReport";

const COPY = {
  ko: { ready: "분석 가능", caution: "주의해서 해석", unfit: "분석 부적합", rows: "유효 행", periods: "관측 기간", missing_date: "날짜 누락", duplicates: "중복 그레인", invalid_values: "형식 오류" },
  en: { ready: "Ready", caution: "Use with caution", unfit: "Not suitable", rows: "Valid rows", periods: "Periods", missing_date: "Missing dates", duplicates: "Duplicate grain", invalid_values: "Invalid values" },
};

export default function DataQualityReport({ canonicalData, locale = "ko" }) {
  const T = COPY[locale] || COPY.ko;
  const report = buildDataQualityReport(canonicalData);
  const tone = report.grade === "ready" ? "#5ad19a" : report.grade === "caution" ? "#f7b955" : "#f0917e";
  return (
    <section className="required-banner" style={{ borderLeftColor: tone, marginTop: "14px" }}>
      <strong>◉ {T[report.grade]}</strong>
      <span style={{ color: "var(--text-muted)", marginLeft: "8px", fontSize: "12px" }}>{T.rows} {report.rowCount.toLocaleString()} · {T.periods} {report.periodCount.toLocaleString()}</span>
      {report.issues.length > 0 && <p style={{ margin: "6px 0 0", fontSize: "12px" }}>{report.issues.map((issue) => `${T[issue.code]} ${issue.count}건`).join(" · ")}</p>}
    </section>
  );
}
