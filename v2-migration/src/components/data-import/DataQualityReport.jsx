"use client";
import AnalysisBasisBar from "@/components/data-import/AnalysisBasisBar";

// 업로드 단계와 결과 카드가 같은 건강검사 기준·문구를 쓴다. 업로드 중에는
// 관측 기간 비교를 감추고, 매핑/결측을 먼저 고치게 한다.
export default function DataQualityReport({ canonicalData, mappedRows, mapping, toolId, eligibility, locale = "ko" }) {
  return <AnalysisBasisBar
    canonicalData={canonicalData}
    mappedRows={mappedRows}
    mapping={mapping}
    toolId={toolId}
    eligibility={eligibility}
    locale={locale}
    showPeriodComparison={false}
    useMappedMetrics={false}
  />;
}
