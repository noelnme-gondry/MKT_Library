// 검색 의도에 맞춘 블로그 표기층. 원고 파일을 다시 쓰지 않고도 제목·요약을
// 일괄 교정할 수 있는 SSOT — 목록, 상세, metadata, JSON-LD가 같은 값을 사용한다.
const KO_TITLES = {
  "ab-testing": "A/B 테스트 방법: 표본 크기·유의성·판정 기준",
  "ad-creative-specs-guide": "광고 소재 규격 가이드: 매체별 사이즈·세이프존",
  "ad-machine-learning": "광고 머신러닝 학습 단계: CPA 급등 원인과 운영 방법",
  "ad-performance-diagnosis": "광고 성과 하락 원인: CPA·CTR 떨어질 때 4단계 진단",
  "aha-event-ad-optimization": "Aha Event로 광고 최적화하기: 설치 CPA와 리텐션 연결",
  "aha-moment-retention": "Aha Moment 찾는 법: 초기 행동과 리텐션 분석",
  "ai-era-marketer": "AI 시대 퍼포먼스 마케터 역량: 자동화 이후에도 남는 일",
  "apple-search-ads-guide": "Apple Search Ads, 캠페인 왜 4개로 쪼개나 — 구조부터",
  "aso-basics-guide": "ASO 전략: 광고비 태우기 전 스토어 전환부터 막는 법",
  "attribution-data-mismatch": "어트리뷰션 데이터 불일치 원인: 매체·GA4·MMP 전환수 비교",
  "audience-broad-vs-narrow": "브로드 타겟 vs 좁은 타겟: 광고 오디언스 선택 기준",
  "budget-marginal-efficiency": "마케팅 예산 배분: 삭감·증액·재배분의 한계 ROAS·CPA",
  "campaign-anomaly-detection": "캠페인 이상 탐지: CPA 급등·전환 급감 원인 찾기",
  "cannibalization-organic-paid": "광고 카니발라이제이션이란? 유료·오가닉 잠식 측정",
  "cohort-analysis-guide": "D1·D7·D30 리텐션 코호트 분석: 평균이 숨기는 이탈 읽는 법",
  "correlation-vs-causation": "상관관계와 인과관계 차이: 마케팅 실험으로 검증하기",
  "cpi-cpa-cpm-difference": "CPI·CPA·CPM·CPC 차이: 광고 지표 계산과 선택 기준",
  "event-taxonomy-guide": "이벤트 택소노미 설계: GA4·MMP 전환 데이터 이름 규칙",
  "funnel-dropoff-analysis": "전환율(CVR) 개선: 퍼널 이탈 진단부터 A/B 검증까지",
  "ga4-data-traps": "GA4 데이터 오류처럼 보이는 숫자 차이: 집계 기준 7가지",
  "google-uac-optimization": "Google UAC(앱 캠페인) 최적화, 뭘 건드릴 수 있나",
  "hook-3-seconds-framework": "광고 첫 3초 후킹: 영상 소재 이탈률 줄이는 방법",
  "incrementality-measurement": "증분성 측정이란? 홀드아웃·DiD로 광고 효과 검증",
  "ios-att-skan-guide": "iOS 성과가 반토막으로 '보이는' 이유 — ATT·SKAN 측정 정리",
  "ltv-cac-ratio": "LTV:CAC 3:1이면 안심? 그 계산, 대부분 틀리게 하고 있어요",
  "marketing-mix-modeling": "라스트클릭이 브랜드검색만 칭찬할 때 — 채널 기여도, MMM으로 재는 법",
  "meta-advantage-plus-guide": "Meta Advantage+ App 최적화: OS·이벤트·입찰 설정",
  "performance-marketer-skills": "퍼포먼스 마케터 스킬, 툴 이름부터 외우면 순서가 틀렸어요",
  "performance-marketing-metrics": "퍼포먼스 마케팅 지표: 처음 볼 4개부터 CPA·ROAS 진단까지",
  "postback-integration-guide": "포스트백 연동 가이드: SAN·S2S·설치 0 오류 해결",
  "retargeting-reengagement-guide": "리타겟팅·재참여 캠페인 운영: UA와 분리하는 이유",
};

const EN_TITLES = {
  "ab-testing": "A/B Testing: Sample Size, Significance, and Decision Rules",
  "ad-machine-learning": "Ad Machine Learning: Why CPA Spikes and How to Operate",
  "ad-performance-diagnosis": "Ad Performance Drop: Diagnose CPA and CTR in 4 Steps",
  "aha-event-ad-optimization": "Aha Event Ad Optimization: Connect CPA to Retention",
  "ai-era-marketer": "The AI-Era Performance Marketer: Skills That Still Matter",
  "attribution-data-mismatch": "Attribution Data Mismatch: Media vs GA4 vs MMP",
  "audience-broad-vs-narrow": "Broad vs Narrow Targeting: How to Choose an Ad Audience",
  "budget-marginal-efficiency": "Marketing Budget Allocation: Marginal ROAS and CPA",
  "correlation-vs-causation": "Correlation vs Causation: Verify Lift With Experiments",
  "ga4-data-traps": "GA4 Data Traps: Why the Numbers Differ",
  "incrementality-measurement": "Incrementality: Validate Ad Lift With Holdouts and DiD",
  "marketing-mix-modeling": "Marketing Mix Modeling: Measure Channel Contribution",
  "performance-marketer-skills": "Performance Marketer Skills: Operations to Causality",
  "performance-marketing-metrics": "Performance Marketing Metrics: CTR, CVR, CPA, and ROAS",
  "aha-moment-retention": "How to Find the Aha Moment: Early Actions and Retention",
  "apple-search-ads-guide": "Apple Search Ads: Campaign Structure and Targeting",
  "aso-basics-guide": "ASO Strategy: Improve Store Conversion and Keywords",
  "campaign-anomaly-detection": "Campaign Anomaly Detection: Find CPA and Conversion Drops",
  "cannibalization-organic-paid": "Ad Cannibalization: Measure Paid and Organic Overlap",
  "cohort-analysis-guide": "Cohort Analysis: Reading D1, D7, and D30 Retention Cohorts",
  "cpi-cpa-cpm-difference": "CPI vs CPA vs CPM vs CPC: Ad Metric Math and Which to Choose",
  "event-taxonomy-guide": "Event Taxonomy: Naming Rules for GA4 and MMP",
  "funnel-dropoff-analysis": "Conversion Rate: Diagnose Funnel Drop-off and Test Fixes",
  "google-uac-optimization": "Google UAC Optimization: What You Can Actually Control",
  "hook-3-seconds-framework": "The 3-Second Hook: Reduce Video Ad Drop-off",
  "ios-att-skan-guide": "iOS Measurement: ATT, SKAN, and Conversion Value Explained",
  "ad-creative-specs-guide": "Ad Creative Specs Guide: Platform Sizes and Safe Zones",
  "meta-advantage-plus-guide": "Meta Advantage+ App Optimization: OS, Events, and Bidding",
  "postback-integration-guide": "Postback Integration: Fix SAN, S2S, and Zero Installs",
  "retargeting-reengagement-guide": "Retargeting & Re-engagement: Why to Split From Acquisition",
  "ltv-cac-ratio": "LTV:CAC 3:1 and Safe? Most People Compute It Wrong",
};

const TITLES = { ko: KO_TITLES, en: EN_TITLES };
const DRAFT_TITLES = {
  ko: { "adjust-vs-appsflyer": "Adjust vs AppsFlyer 비교: 모바일 MMP 선택 기준" },
  en: { "adjust-vs-appsflyer": "Adjust vs AppsFlyer: How to Choose a Mobile MMP" },
};
const DESCRIPTION_OVERRIDES = {
  ko: {
    "cannibalization-organic-paid": "내부 카니발라이제이션과 유료·오가닉 잠식을 구분하고 측정하는 방법입니다.",
  },
  en: {
    "cannibalization-organic-paid": "Measure internal cannibalisation and separate paid impact from organic demand.",
  },
};
const UPDATED_TODAY = new Set([
  "ad-performance-diagnosis", "apple-search-ads-guide", "aso-basics-guide", "cohort-analysis-guide",
  "funnel-dropoff-analysis", "google-uac-optimization", "ios-att-skan-guide",
  "ltv-cac-ratio", "marketing-mix-modeling", "performance-marketer-skills", "performance-marketing-metrics",
]);
const UPDATED_TODAY_EN = new Set(["ad-performance-diagnosis", "marketing-mix-modeling"]);
// 2026-07-28: Search Console 노출어 감사 후, 제목/설명에 검색 의도를 명시적으로
// 복구한 글만 실제 편집일로 갱신한다. 단순 메타 재생성에 날짜를 쓰지 않는다.
const UPDATED_2026_07_28 = new Set([
  "ad-performance-diagnosis", "aso-basics-guide", "attribution-data-mismatch", "budget-marginal-efficiency",
  "campaign-anomaly-detection", "cannibalization-organic-paid", "cohort-analysis-guide", "ga4-data-traps",
]);

export function getBlogSeo(locale, slug, source = {}) {
  const title = TITLES[locale]?.[slug] || DRAFT_TITLES[locale]?.[slug];
  if (!title) return null;
  const isEnglish = locale === "en";
  return {
    title,
    // 검색 메타는 제목을 중심으로 짧게 유지한다. 본문의 직접 답변은
    // blogEditorial 레지스트리에서 별도로 관리해 메타·CTA와 역할을 분리한다.
    description: DESCRIPTION_OVERRIDES[locale]?.[slug] || (isEnglish
      ? `${title}. A practical guide to the key checks, trade-offs, and next steps.`
      : `${title}. 핵심 기준과 실무 확인 순서를 정리합니다.`),
    intent: isEnglish ? "Search answer · practical workflow" : "검색 답변 · 실무 워크플로우",
    updated: source.updated || (UPDATED_2026_07_28.has(slug)
      ? "2026-07-28"
      : ((isEnglish ? UPDATED_TODAY_EN : UPDATED_TODAY).has(slug) ? "2026-07-20" : "")),
  };
}

export function publishedBlogSeoSlugs(locale) {
  return Object.keys(TITLES[locale] || {});
}
