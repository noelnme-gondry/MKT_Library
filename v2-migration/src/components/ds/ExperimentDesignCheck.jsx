"use client";

export default function ExperimentDesignCheck({ locale, share, setShare, confirmed, setConfirmed, margin, setMargin, srm, equivalence }) {
  const en = locale === "en";
  const labels = {
    unconfirmed: en ? "Design not confirmed" : "설계 미확인",
    invalid: en ? "Check integer samples and planned allocation" : "정수 표본 수와 계획 배정 비율 확인",
    insufficient: en ? "Too few expected samples for this approximation" : "근사 판정에 필요한 기대 표본 부족",
    mismatch: en ? "Allocation mismatch: hold treatment decisions" : "배정 비율 이상: 효과에 따른 결정 보류",
    no_alarm: en ? "No SRM alarm; this does not validate the entire design" : "SRM 경고 없음: 전체 설계가 검증됐다는 뜻은 아님",
  };
  return <section className="callout analysis-design-check" aria-label={en ? "Experiment design check" : "실험 설계 점검"}>
    <div className="body">
      <strong>{en ? "Before acting on the result" : "결과로 행동하기 전"}</strong>
      <p>{en ? "Use distinct randomized units, not repeated impressions. Confirm a common observation window, stable tracking, and a stopping rule set before reading outcomes. SRM checks allocation, not causality." : "반복 노출이 아닌 중복 없는 무작위 배정 단위를 사용하세요. 같은 관찰 기간·일관된 추적·결과를 보기 전에 정한 종료 규칙을 확인하세요. SRM은 배정 비율 점검이며 인과 검증이 아닙니다."}</p>
      <label>{en ? "Planned Control share (%)" : "계획 Control 배정 비율 (%)"}<input type="number" min="1" max="99" value={share} onChange={(e) => setShare(e.target.value)} /></label>
      <label><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />{en ? "These are distinct assigned units and the design was specified in advance" : "중복 없는 배정 단위이며 설계를 사전에 정했습니다"}</label>
      <p role="status">{labels[srm.status]}{srm.pValue != null ? ` · p=${srm.pValue.toPrecision(4)} · α=0.001` : ""}</p>
      <label>{en ? "Optional, predeclared negligible difference (± percentage points)" : "선택: 사전 선언한 무시 가능한 차이 (± %p)"}<input type="number" min="0" max="99" step="0.1" value={margin} onChange={(e) => setMargin(e.target.value)} /></label>
      <p>{equivalence?.lowerPp != null ? `${en ? "90% interval" : "90% 구간"}: ${equivalence.lowerPp.toFixed(3)} ~ ${equivalence.upperPp.toFixed(3)} %p. ` : ""}{equivalence?.status === "within_margin"
        ? (en ? "Within the declared margin under the large-sample approximation; not proof of zero effect." : "대표본 근사에서 선언한 범위 안입니다. 효과가 0이라는 증명은 아닙니다.")
        : (en ? "Practical equivalence is not established. Do not choose the margin after seeing the result." : "실용적 동등성은 확립되지 않았습니다. 결과를 보고 허용 범위를 정하지 마세요.")}</p>
    </div>
  </section>;
}
