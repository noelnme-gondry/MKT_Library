// View/export blocks; followupInputs.js defines portable analysis options and device-only inputs.
// Core results, uncertainty, eligibility and reconciliation are never hideable.
export const FOLLOWUP_TOOL_SPECS = Object.fromEntries(Object.entries({
  "5-18-trend": [["s-trend", "추세 분해와 원장", "Trend decomposition and ledger", true]],
  "5-18-paid-organic": [["paid-organic-movement", "유입 변화 차트", "Traffic movement chart", false]],
  "5-18-cannibal": [["s-cannib-detail", "잠식 진단 근거", "Cannibalization evidence", true]],
  "5-18-mmm": [["s-mmm-weekly-performance", "주별 성과", "Weekly performance", false], ["s-audit", "모델 검증", "Model validation", true]],
  "5-18-forecast": [["s-forecast", "예측과 불확실성", "Forecast and uncertainty", true]],
  "5-23": [["s-incr-result", "순증분과 설계 검증", "Incrementality and design checks", true]],
  "5-24": [["brand-its-result", "증분 추정과 한계", "Incrementality and limitations", true]],
  "5-4": [["s-powercurve", "검정력 곡선", "Power curve", false], ["s-readout-chart", "판독 분포 차트", "Readout distribution", false], ["s-readout-sig", "판정 근거", "Decision evidence", true]],
  "5-25": [["vif-result", "VIF 진단 결과", "VIF diagnosis", true]],
  "5-26": [["asa-actions", "키워드별 조치 근거", "Keyword action evidence", true]],
  "5-27": [["aso-trend", "일별 전환 추세", "Daily conversion trend", false], ["aso-sources", "유입 소스 구성", "Traffic source composition", true], ["aso-honesty", "해석 한계", "Interpretation limits", true]],
  "5-28": [["subscription-segment-curves", "세그먼트 곡선", "Segment curves", false], ["subscription-risk-table", "위험집합과 사건 수", "Risk sets and events", true]],
  "5-29": [["segment-composition-ops", "운영 지문", "Operational patterns", false], ["segment-composition-detail", "분해 근거", "Decomposition evidence", true], ["segment-composition-causal", "인과 확인", "Causal checks", true]],
  "5-20": [["s-aha-map", "후보 지도", "Candidate map", false], ["s-aha-drill", "후보 상세 검증", "Candidate validation", true]],
  "9-6": [["s-matrix", "요소별 성과 매트릭스", "Performance matrix", false], ["s-validation", "입력 검증", "Input validation", true]],
  "9-1": [["s-content-result", "요소별 성과 근거", "Content element evidence", true]]
}).map(([toolId,blocks])=>[toolId,{
  toolId, maxLevels:0, metrics:[], periodKinds:[], exportFormats:[], defaults:{},
  commandExample:{ko:"예: 그림 제목만, 보고서 차트 제외",en:"e.g. PNG title only, Exclude report charts"},
  blocks:blocks.map(([id,ko,en,locked])=>({id,label:{ko,en},locked})),
}]));
