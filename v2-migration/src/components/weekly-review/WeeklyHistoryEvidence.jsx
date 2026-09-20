"use client";
import { SIGNIFICANCE_CONFIG } from "@/lib/weekly-review/significance";
import { formatReviewMetric } from "@/lib/weekly-review/workspaceEvidence";

export function baselineExplanation(baseline, locale = "ko") {
  const en = locale === "en";
  if (baseline?.known) return en ? "Historical variation is included in this review." : "과거 변동 폭을 이번 검토에 반영했습니다.";
  if (baseline?.reason === "no_variation") return en
    ? "The saved values are identical, so the usual variation cannot be estimated."
    : "저장된 지표값이 모두 같아 평소 변동 폭을 추정할 수 없습니다.";
  return en
    ? `The usual variation is unknown. At least ${SIGNIFICANCE_CONFIG.minBaselineWeeks} comparable periods with varying values are needed.`
    : `평소 변동 폭은 아직 모릅니다. 값의 변화가 있는 비교 가능한 기간이 최소 ${SIGNIFICANCE_CONFIG.minBaselineWeeks}개 필요합니다.`;
}

export default function WeeklyHistoryEvidence({ review, metric, currency, locale = "ko" }) {
  const en = locale === "en";
  // summarizeBaseline과 같은 유효값·최근 기간 창. 새로운 통계 계산은 하지 않는다.
  const used = (review.historySeries || []).filter(point => Number.isFinite(point.metrics[metric]))
    .slice(-SIGNIFICANCE_CONFIG.lookbackWeeks);
  return <section data-information-section="" className="wr-settings">
    <header data-information-heading="">{en ? `History used in this review · ${used.length} periods` : `이번 판정에 쓴 이력 · ${used.length}개 기간`}</header>
    <div className="wr-card">
      <p>{baselineExplanation(review.routing?.kpi?.baseline, locale)}</p>
      <p className="wr-note">{en
        ? "Only earlier, non-overlapping periods of the same length and currency are included. Metrics use the current conversion basis. This is a check of uploaded history, not automatic monitoring."
        : "같은 통화·기간 길이의 과거 기록 중 겹치지 않는 기간만 사용합니다. 지표는 현재 전환 기준으로 계산합니다. 업로드한 이력을 비교하며 자동 감시는 하지 않습니다."}</p>
      {used.length > 0 && <div className="table-wrap"><table className="data">
        <caption>{en ? "Values used to assess historical variation" : "평소 변동 폭 비교에 사용한 값"}</caption>
        <thead><tr><th scope="col">{en ? "Period" : "기간"}</th><th scope="col">{metric.toUpperCase()}</th></tr></thead>
        <tbody>{used.map(point => <tr key={`${point.period.start}/${point.period.end}`}>
          <th scope="row">{point.period.start} ~ {point.period.end}</th>
          <td className="num">{formatReviewMetric(point.metrics[metric], metric, currency, locale)}</td>
        </tr>)}</tbody>
      </table></div>}
    </div>
  </section>;
}
