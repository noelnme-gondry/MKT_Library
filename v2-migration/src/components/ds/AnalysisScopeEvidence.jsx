import { STANDARD_FIELDS } from "@/utils/csvConstants";

export default function AnalysisScopeEvidence({ scope, locale = "ko" }) {
  if (!scope?.periods?.length) return null;
  const en = locale === "en";
  const denominatorLabel = STANDARD_FIELDS[scope.denominatorKey]?.[en ? "labelEn" : "label"] || scope.denominatorKey;
  const format = (value) => Number.isFinite(value) ? value.toLocaleString(en ? "en-US" : "ko-KR", { maximumFractionDigits: 3 }) : (en ? "Unmeasured" : "미집계");
  const filters = Object.entries(scope.filters || {}).filter(([, value]) => Array.isArray(value) ? value.length : value != null && value !== "");
  return <details className="analysis-scope-evidence">
    <summary>{en ? "Actual analysis scope and denominator" : "실제 분석 범위·분모 확인"}</summary>
    <p>{en ? "Denominator" : "분모"}: {denominatorLabel || (en ? "Not declared" : "미선언")} · {en ? "Source currency" : "원본 통화"}: {scope.currency || (en ? "Not applicable / undeclared" : "해당 없음 / 미선언")}</p>
    <ul>{scope.periods.map((period) => <li key={period.id}>
      <strong>{period.id === "before" ? (en ? "Before" : "이전") : (en ? "After" : "이후")}: {period.start} ~ {period.end}</strong>
      <span> · {format(period.observations)} {scope.observationUnit === "cells" ? (en ? "aggregate cells" : "집계 셀") : (en ? "input rows" : "입력 행")} · {en ? "denominator" : "분모"} {format(period.denominator)}</span>
      {period.cost != null && <span> · {en ? "cost" : "비용"} {format(period.cost)}</span>}
      <span> · {en ? "missing/invalid input cells" : "입력 결측·비정상 셀"}: {period.quality ? `${period.quality.missing}/${period.quality.checked} (${(period.quality.ratio * 100).toFixed(1)}%)` : (en ? "Unmeasured" : "미집계")}</span>
    </li>)}</ul>
    <p>{en ? "Non-date filters" : "날짜 외 필터"}: {filters.length ? filters.map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : value}`).join(" · ") : (en ? "All" : "전체")}</p>
    <p>{en ? "These are the inputs used by this conclusion after preprocessing. Denominators can differ across tools; matching dates alone does not make the totals comparable." : "전처리 후 이 결론에 사용한 입력 기준입니다. 도구마다 분모 정의가 다를 수 있으며 날짜만 같다고 합계가 비교 가능한 것은 아닙니다."}</p>
  </details>;
}
