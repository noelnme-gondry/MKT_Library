// Published in both languages. The slug also identifies the originating guide in GA.
const guides = [
  ["viz", "시각화", "Visualization", "두 주의 지출과 설치를 맞춰 보고 CPI가 오른 날짜를 차트에서 찾습니다.", "Compare the two weeks of spend and installs, then trace the CPI increase on the daily chart."],
  ["scorecard", "스코어카드", "Scorecard", "관측일 수가 같은 두 주를 골라 설치 증가와 비용 효율 하락을 한 장에서 대조합니다.", "Compare two equally observed weeks and read the change in volume alongside its cost."],
  ["seasonality", "시즈널리티", "Seasonality", "서로 규모가 다른 두 해의 11월 설치 수를 연평균과 비교합니다.", "Compare November installs with each year's own average, even though the second year is larger."],
  ["pacing", "페이싱", "Pacing", "월초부터 마지막 관측일까지의 지출로 월말 착지액과 남은 일예산을 점검합니다.", "Read spend through the last observed day, then compare the month-end projection with your budget."],
  ["anomaly", "이상탐지", "Anomaly detection", "하루 지출이 직전 기준선에서 얼마나 벗어났는지 날짜와 방향을 함께 살핍니다.", "Read daily spend against its trailing baseline and identify dates to check in the change log."],
  ["ltv", "LTV와 ROAS", "LTV and ROAS", "채널별 설치 획득비와 누적 매출을 비교하고 회수 추정에 필요한 가정을 살핍니다.", "Compare channel-level acquisition cost with cumulative revenue and inspect the payback assumptions."],
  ["cohort", "코호트 분석", "Cohort analysis", "D7과 D14 복귀율을 각 시점까지 관측 가능한 설치 수로 나눠 확인합니다.", "Read D7 and D14 retention with the installs eligible to reach each age."],
  ["funnel", "퍼널 진단", "Funnel diagnosis", "지난주와 이번 주의 단계별 분모를 맞춰 먼저 조사할 전환 단계를 고릅니다.", "Compare the two weeks stage by stage and select the first transition to investigate."],
  ["segment", "세그먼트", "Segment", "채널과 국가를 교차해 단가가 높은 셀과 지출 영향이 큰 셀을 구분합니다.", "Cross channel with country, then compare the most expensive install with the largest spend exposure."],
];
export const DASHBOARD_GUIDES = Object.fromEntries(guides.map(([tab, ko, en, koPreview, enPreview]) => [
  `dashboard-${tab}-guide`,
  { tab, ko: { label: ko, action: `${ko} 탭에서 예시 확인하기`, preview: koPreview }, en: { action: `Open the ${en} example`, preview: enPreview } },
]));
export function mapDashboardGuides(select) {
  return Object.fromEntries(Object.entries(DASHBOARD_GUIDES).map(([slug, guide]) => [slug, select(guide)]));
}
