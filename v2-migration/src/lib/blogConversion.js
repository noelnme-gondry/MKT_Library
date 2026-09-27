// Editorial promises describe the next screen, not a guaranteed business outcome.
// The same copy is used at article entry, beside the example, and in the reading bar.
const C = (ko, en, noteKo = "", noteEn = "") => ({ ko: { action: ko, note: noteKo }, en: { action: en, note: noteEn } });
export const BLOG_CONVERSION = {
  "weekly-marketing-report-template": C("주간 보고서 샘플 열기", "Open a weekly report example"),
  "cac-payback-period": C("획득 비용 비교해 보기", "Compare acquisition costs", "설치당 비용 예시입니다. 구매 고객 CAC와 회수 기간은 별도 데이터가 필요합니다.", "This example uses cost per install. Customer CAC and payback need separate data."),
  "marketing-report-sheets-bigquery": C("정리한 데이터로 보고서 보기", "See a report from prepared data"),
  "ab-testing": C("A/B 테스트 결과 읽어보기", "Read an A/B test result"),
  "ad-creative-testing": C("소재별 성과 비교해 보기", "Compare creative performance", "테스트 개수를 자동으로 정하지 않습니다. 집행한 소재의 성과와 피로 신호를 보는 예시입니다.", "This example compares delivered creatives and fatigue signals; it does not choose your test size."),
  "ad-machine-learning": C("성과가 달라진 채널 찾기", "Find which channel changed"),
  "ad-performance-diagnosis": C("비용 상승을 채널별로 나눠보기", "Break down a cost increase"),
  "aha-event-ad-optimization": C("전환과 함께 나타난 행동 찾기", "Explore behaviors linked to conversion"),
  "aha-moment-retention": C("핵심 행동 후보 비교해 보기", "Compare candidate key behaviors"),
  "apple-search-ads-guide": C("검색어 조정 후보 살펴보기", "Inspect search-term candidates", "전환 집계가 끝났는지 확인하기 전에는 조정을 보류합니다.", "Adjustment recommendations stay on hold until conversion maturity is confirmed."),
  "asa-keyword-expansion": C("확장할 검색어 후보 살펴보기", "Explore keyword expansion candidates"),
  "aso-basics-guide": C("스토어 전환 하락 나눠보기", "Break down a store conversion drop"),
  "audience-broad-vs-narrow": C("두 타겟의 차이 비교해 보기", "Compare two audience results"),
  "brand-campaign-lift": C("캠페인 전후 변화 살펴보기", "Inspect a campaign's before and after"),
  "budget-marginal-efficiency": C("예산 배분 샘플 열기", "Open a budget allocation example", "아래 그림은 배분 전 포화 점검입니다. 샘플에서는 채널별 배분안을 확인합니다.", "The preview checks saturation before allocation. The example opens channel budget recommendations."),
  "budget-scaling-limit": C("증액 판단이 보류되는 예시 보기", "See why a scaling decision is withheld"),
  "campaign-anomaly-detection": C("성과가 바뀐 구간 살펴보기", "Inspect a performance change"),
  "cannibalization-organic-paid": C("광고·자연 유입 함께 비교하기", "Compare paid and organic traffic"),
  "cohort-analysis-guide": C("기간별 성과 비교해 보기", "Compare performance across periods", "첫 화면은 기간별 운영 지표입니다. 코호트 해석에는 사용자별 관측 기간을 맞춰야 합니다.", "The first view compares operating metrics. Cohort interpretation needs aligned user observation windows."),
  "content-element-analysis": C("성과와 관련된 소재 요소 찾기", "Explore elements linked to performance"),
  "correlation-vs-causation": C("대조군이 있는 결과 읽어보기", "Read a result with a control group"),
  "cpi-cpa-cpm-difference": C("비용·클릭·설치 함께 보기", "Compare spend, clicks and installs"),
  "creative-attribute-regression": C("소재 요소별 차이 살펴보기", "Inspect creative attribute differences"),
  "funnel-dropoff-analysis": C("단계별 건수 비교해 보기", "Compare funnel stage counts"),
  "google-uac-optimization": C("교체를 검토할 소재 살펴보기", "Inspect creatives worth reviewing"),
  "hook-3-seconds-framework": C("소재별 반응 비교해 보기", "Compare responses across creatives", "클릭·전환 예시입니다. 첫 3초의 시청 이탈을 직접 측정한 결과는 아닙니다.", "This example uses clicks and conversions, not measured drop-off in the first three seconds."),
  "incrementality-measurement": C("대조군과 증분 결과 비교하기", "Compare an incrementality result"),
  "ltv-cac-ratio": C("획득 지표부터 비교해 보기", "Start with acquisition metrics", "설치 기준 운영 지표 예시입니다. 실제 LTV/CAC에는 고객 매출과 획득 비용이 필요합니다.", "This example uses install-based metrics. Actual LTV/CAC needs customer revenue and acquisition costs."),
  "marketing-mix-modeling": C("채널 기여도 샘플 열기", "Open a channel contribution example", "아래 그림은 MMM 전 공선성 점검입니다. 샘플 결과에서도 식별 조건을 함께 확인하세요.", "The preview checks collinearity before MMM. Inspect identification limits in the example result."),
  "meta-advantage-plus-guide": C("소재 성과와 피로 신호 보기", "Inspect creative performance and fatigue"),
  "multicollinearity-mmm-guide": C("함께 움직이는 채널 찾기", "Find channels that move together"),
  "offline-ad-online-impact": C("집행 전후 변화 비교해 보기", "Compare changes around a campaign"),
  "performance-marketer-skills": C("실무 분석 한 번 해보기", "Try an operating analysis"),
  "performance-marketing-analysis-order": C("운영 지표부터 살펴보기", "Start with operating metrics"),
  "performance-marketing-metrics": C("지출부터 전환까지 함께 보기", "Follow spend through to conversion"),
  "retargeting-reengagement-guide": C("추가 지출의 효율 살펴보기", "Inspect the efficiency of extra spend"),
  "roas-improvement": C("예산을 옮길 채널 살펴보기", "Explore where to move budget", "설치 기준 포화 점검과 예산 배분 예시입니다. ROAS 판단에는 매출 데이터가 필요합니다.", "The preview checks saturation; the sample opens allocation using installs. Judging ROAS requires revenue data."),
  "store-conversion-drop-diagnosis": C("유입 구성과 전환 변화 나눠보기", "Separate traffic mix and conversion changes"),
  "store-listing-experiment": C("스토어 A/B 결과 비교해 보기", "Compare a store A/B result"),
  "uplift-holdout-guide": C("홀드아웃 결과 읽어보기", "Read a holdout result"),
};

export function blogConversionFor(slug, locale = "ko") {
  return BLOG_CONVERSION[slug]?.[locale === "en" ? "en" : "ko"] || null;
}

export const blogExampleFormId = slug => `blog-example-${slug}`;
