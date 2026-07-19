// 검색 의도에 맞춘 블로그 표기층. 원고 파일을 다시 쓰지 않고도 제목·요약을
// 일괄 교정할 수 있는 SSOT — 목록, 상세, metadata, JSON-LD가 같은 값을 사용한다.
const KO_TITLES = {
  "ab-testing": "A/B 테스트 방법: 표본 크기·유의성·판정 기준",
  "ad-creative-specs-guide": "광고 소재 규격 가이드: 매체별 사이즈·세이프존",
  "ad-machine-learning": "광고 머신러닝 학습 단계: CPA 급등 원인과 운영 방법",
  "ad-performance-drop": "광고 성과 하락 원인 4단계 진단: CPA 급등·전환 감소",
  "aha-moment-retention": "Aha Moment 찾는 법: 초기 행동과 리텐션 분석",
  "ai-era-marketer": "AI 시대 퍼포먼스 마케터 역량: 자동화 이후에도 남는 일",
  "apple-search-ads-guide": "Apple Search Ads 운영 가이드: 키워드·예산·성과 측정",
  "aso-basics-guide": "ASO 기초 가이드: 앱스토어 검색 노출과 전환율 개선",
  "attribution-data-mismatch": "어트리뷰션 데이터 불일치 원인: 매체·GA4·MMP 전환수 비교",
  "audience-broad-vs-narrow": "브로드 타겟 vs 좁은 타겟: 광고 오디언스 선택 기준",
  "campaign-anomaly-detection": "캠페인 이상 탐지: CPA 급등·전환 급감 원인 찾기",
  "campaign-saturation-signals": "캠페인 포화도 진단: 한계 CPA와 예산 증액 기준",
  "cannibalization-organic-paid": "광고 카니발라이제이션이란? 유료·오가닉 잠식 측정",
  "cohort-analysis-guide": "코호트 분석이란? 리텐션·LTV 읽는 방법",
  "correlation-vs-causation": "상관관계와 인과관계 차이: 마케팅 실험으로 검증하기",
  "cpa-reduction": "CPA 낮추는 방법: 소재·퍼널·예산 원인별 진단",
  "cpi-cpa-cpm-difference": "CPI·CPA·CPM·CPC 차이: 광고 지표 계산과 선택 기준",
  "creative-fatigue": "광고 소재 피로도 진단: 교체 시점과 CTR 하락 신호",
  "ctr-improvement": "CTR 개선 방법: 광고 클릭률 하락 원인과 소재 점검",
  "cvr-optimization": "전환율(CVR) 개선 방법: 퍼널별 이탈 원인 점검",
  "event-taxonomy-guide": "이벤트 택소노미 설계: GA4·MMP 전환 데이터 이름 규칙",
  "funnel-dropoff-analysis": "전환 퍼널 분석: 이탈 구간과 CVR 개선 순서",
  "ga4-data-traps": "GA4 데이터 오류처럼 보이는 숫자 차이: 집계 기준 7가지",
  "google-uac-optimization": "Google UAC 최적화: 앱 캠페인에서 조정할 수 있는 항목",
  "hook-3-seconds-framework": "광고 첫 3초 후킹: 영상 소재 이탈률 줄이는 방법",
  "incrementality-measurement": "증분성 측정이란? 홀드아웃·DiD로 광고 효과 검증",
  "ios-att-skan-guide": "iOS ATT·SKAN 광고 측정: 앱 마케팅 전환 데이터 읽기",
  "junior-metrics-guide": "퍼포먼스 마케팅 지표 4가지: CTR·CVR·CPA·ROAS 읽기",
  "ltv-cac-ratio": "LTV:CAC 계산법: 적정 비율과 페이백 기간",
  "marketing-budget-allocation": "마케팅 예산 배분 방법: 한계 CPA·응답곡선으로 최적화",
  "marketing-mix-modeling": "마케팅 믹스 모델링(MMM)이란? 채널 기여도·예측 방법",
  "meta-advantage-plus-guide": "Meta Advantage+ App 최적화: OS·이벤트·입찰 설정",
  "performance-marketer-skills": "퍼포먼스 마케터 스킬 로드맵: 운영·분석·인과추론",
  "performance-marketing-metrics": "퍼포먼스 마케팅 지표 정리: CPI·CPA·ROAS·LTV 연결",
  "postback-integration-guide": "포스트백 연동 가이드: SAN·S2S·설치 0 오류 해결",
  "retargeting-reengagement-guide": "리타겟팅·재참여 캠페인 운영: UA와 분리하는 이유",
  "roas-improvement": "ROAS 개선 방법: 한계 ROAS와 예산 재배분 기준",
  "scaling-pitfalls": "광고 캠페인 스케일업 실패 원인: 예산 증액·포화도 진단",
};

const EN_TITLES = {
  "ab-testing": "A/B Testing: Sample Size, Significance, and Decision Rules",
  "ad-machine-learning": "Ad Machine Learning: Why CPA Spikes and How to Operate",
  "ad-performance-drop": "Ad Performance Drop: A 4-Step CPA and Conversion Diagnosis",
  "ai-era-marketer": "The AI-Era Performance Marketer: Skills That Still Matter",
  "attribution-data-mismatch": "Attribution Data Mismatch: Comparing Media, GA4, and MMP Conversions",
  "audience-broad-vs-narrow": "Broad vs Narrow Targeting: How to Choose an Ad Audience",
  "correlation-vs-causation": "Correlation vs Causation in Marketing: How Experiments Verify Lift",
  "cpa-reduction": "How to Lower CPA: Diagnose Creative, Funnel, and Budget Causes",
  "creative-fatigue": "Creative Fatigue: CTR Drop Signals and When to Refresh Ads",
  "ga4-data-traps": "GA4 Data Traps: Seven Aggregation Rules Behind Different Numbers",
  "incrementality-measurement": "Incrementality Measurement: Validate Ad Lift with Holdouts and DiD",
  "junior-metrics-guide": "Performance Marketing Metrics: CTR, CVR, CPA, and ROAS Explained",
  "marketing-budget-allocation": "Marketing Budget Allocation: Optimize with Marginal CPA and Response Curves",
  "marketing-mix-modeling": "Marketing Mix Modeling (MMM): Channel Contribution and Forecasting",
  "performance-marketer-skills": "Performance Marketer Skills Roadmap: Operations, Analytics, and Causality",
  "performance-marketing-metrics": "Performance Marketing Metrics: Connect CPI, CPA, ROAS, and LTV",
  "roas-improvement": "How to Improve ROAS: Marginal ROAS and Budget Reallocation",
  "scaling-pitfalls": "Why Ad Campaign Scaling Fails: Budget Increases and Saturation",
};

const TITLES = { ko: KO_TITLES, en: EN_TITLES };

export function getBlogSeo(locale, slug, source = {}) {
  const title = TITLES[locale]?.[slug];
  if (!title) return null;
  const isEnglish = locale === "en";
  const suffix = isEnglish
    ? " Start by fixing the date range and conversion definition, then validate the recommendation in the linked analysis tool."
    : " 먼저 기준 기간과 전환 정의를 고정한 뒤, 연결된 분석 도구에서 결과를 검증하세요.";
  return {
    title,
    // 기존 원고의 설명도 보존하되 검색자가 바로 실행할 다음 행동을 덧붙인다.
    description: `${source.description || title}${suffix}`,
    answer: `${source.description || title}${suffix}`,
    intent: isEnglish ? "Search answer · practical workflow" : "검색 답변 · 실무 워크플로우",
  };
}

export function publishedBlogSeoSlugs(locale) {
  return Object.keys(TITLES[locale] || {});
}
