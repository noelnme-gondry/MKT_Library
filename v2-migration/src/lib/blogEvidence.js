import { blogDashboardTab } from "./blogInsightRegistry";

// Each link names the decision the reader can make at an existing result section.
// Sections can be absent when the sample is insufficient or a user changes views.
const evidence = (id, ko, en, resultSelector) => ({ id, ko, en, resultSelector });
const byTool = {
  "5-21": evidence("s-pvm-campaigns", "캠페인별 단가와 기여 비교", "Compare cost and contribution by campaign"),
  "5-29": evidence("tool-core-figure-composition-mix-rate", "물량 이동과 내부 변화 구분", "Separate volume shifts from within-campaign changes"),
  "5-28": evidence("subscription-risk-table", "이탈 위험이 높은 구간의 남은 인원 확인", "Check the risk set in the high-hazard period"),
  "5-4": evidence("s-readout-mass", "실험안별 전환율·보정 p값 비교", "Compare each arm’s conversion and adjusted p-value"),
  "9-6": evidence("s-fatigue", "피로 신호가 잡힌 소재 확인", "Inspect creatives with fatigue signals"),
  "5-20": evidence("s-aha-drill", "후보 행동의 기준 횟수와 표본 확인", "Check the threshold and sample for a candidate behavior"),
  "5-26": evidence("asa-maturity", "키워드 조치 전 전환 집계 확인", "Check conversion completeness before adjusting bids"),
  "5-27": evidence("aso-sources", "유입 소스별 구성과 전환 변화 비교", "Compare mix and conversion by traffic source"),
  "5-24": evidence("brand-its-result", "실제 성과와 사전 추세 예측 비교", "Compare actual outcomes with the pre-campaign projection"),
  "5-3": evidence("s-table", "예산 조정안의 지출 범위 확인", "Check spending limits on the proposed changes"),
  "5-22": evidence("s-sat-summary", "한계효율을 추정할 수 있는지 확인", "Check whether marginal efficiency is estimable"),
  "5-18-paid-organic": evidence("paid-organic-movement", "주별 유료·자연 유입 방향 대조", "Compare paid and organic movements by week"),
  "9-1": evidence("s-content-result", "다음 실험에서 바꿀 요소 고르기", "Select one element to vary in the next experiment"),
  "5-23": evidence("tool-core-figure-holdout-lift", "노출군과 홀드아웃의 전환율 차이 확인", "Inspect the conversion gap against holdout"),
  "5-18-mmm": evidence("s-mmm-webr-challenger", "예산 이동 전 모형의 검증 오차 확인", "Inspect model validation error before reallocating"),
  "5-25": evidence("tool-core-figure-vif-by-entity", "채널별 지출 중복과 판정 기준 확인", "Inspect channel VIFs and interpretation thresholds"),
};
const byDashboardTab = {
  viz: evidence("s-charts", "두 주의 설치당 비용과 일별 추이 확인", "Inspect the two weeks of cost per install and the daily trend"),
  cohort: evidence("s-retention", "경과일별 복귀율과 분모 확인", "Inspect retention and its denominator by cohort age", "#wide-ret-curve"),
  ltv: evidence("s-table", "채널별 회수기간과 실측 범위 비교", "Compare payback and observation horizons by channel", "tbody tr"),
  funnel: evidence("s-funnel-wow", "지난주보다 전환율이 떨어진 단계 확인", "Find stages that declined week over week", "tbody tr"),
};
export function blogEvidenceFor(slug, toolId) {
  return toolId === "5-2" ? byDashboardTab[blogDashboardTab(slug)] : byTool[toolId];
}
