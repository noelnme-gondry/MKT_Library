// 검색 의도에 맞춘 블로그 표기층. 원고 파일을 다시 쓰지 않고도 제목·요약을
// 일괄 교정할 수 있는 SSOT — 목록, 상세, metadata, JSON-LD가 같은 값을 사용한다.
const KO_TITLES = {
  "ab-testing": "A/B 테스트 방법: 표본 크기·유의성·판정 기준",
  "ad-creative-specs-guide": "광고 소재 규격 가이드: 매체별 사이즈·세이프존",
  "ad-creative-testing": "광고 소재 테스트 방법: 적은 예산으로 몇 개까지 돌려야 할까?",
  "ad-machine-learning": "광고 머신러닝 학습 단계: CPA 급등 원인과 운영 방법",
  "ad-performance-diagnosis": "광고 성과 하락 원인: CPA·CTR 떨어질 때 4단계 진단",
  "aha-event-ad-optimization": "Aha Event로 광고 최적화하기: 설치 CPA와 리텐션 연결",
  "aha-moment-retention": "Aha Moment 찾는 법: 초기 행동과 리텐션 분석",
  "ai-era-marketer": "AI 시대 퍼포먼스 마케터 역량: 자동화 이후에도 남는 일",
  "apple-search-ads-guide": "Apple Search Ads(ASA): Exact 승격·CPT 조정",
  "aso-basics-guide": "ASO 전략: 광고비 태우기 전 스토어 전환부터 막는 법",
  "attribution-data-mismatch": "어트리뷰션 데이터 불일치 원인: 매체·GA4·MMP 전환수 비교",
  "audience-broad-vs-narrow": "브로드 타겟 vs 좁은 타겟: 광고 오디언스 선택 기준",
  "budget-marginal-efficiency": "마케팅 예산 배분: 삭감·증액·재배분의 한계 ROAS·CPA",
  "campaign-anomaly-detection": "캠페인 이상 탐지: CPA 급등·전환 급감 원인 찾기",
  "cannibalization-organic-paid": "광고 카니발라이제이션이란? 유료·오가닉 잠식 측정",
  "cohort-analysis-guide": "D1·D7·D30 리텐션 코호트 분석: 평균이 숨기는 이탈 읽는 법",
  "correlation-vs-causation": "상관관계와 인과관계 차이: 마케팅 실험으로 검증하기",
  "cpi-cpa-cpm-difference": "CPI·CPA·CPM·CPC 차이: 광고 비용 지표 읽는 법",
  "event-taxonomy-guide": "이벤트 택소노미 설계: GA4·MMP 전환 데이터 이름 규칙",
  "funnel-dropoff-analysis": "전환율(CVR) 개선: 퍼널 이탈 진단부터 A/B 검증까지",
  "ga4-data-traps": "GA4 데이터 오류처럼 보이는 숫자 차이: 집계 기준 7가지",
  "google-uac-optimization": "Google UAC 최적화 가이드: 입찰·에셋·이벤트 설정",
  "hook-3-seconds-framework": "광고 첫 3초 후킹: 영상 소재 이탈률 줄이는 방법",
  "incrementality-measurement": "증분성 측정이란? 홀드아웃·DiD로 광고 효과 검증",
  "ios-att-skan-guide": "iOS ATT·SKAN 측정 가이드: 성과가 반토막 보이는 이유",
  "ltv-cac-ratio": "LTV:CAC 비율 계산법: 3:1 기준과 흔한 오류 3가지",
  "marketing-mix-modeling": "마케팅 믹스 모델링(MMM)이란? 채널 기여도 측정법",
  "multicollinearity-mmm-guide": "MMM 전 다중공선성 점검: VIF가 높을 때 채널 기여도 해석법",
  "meta-advantage-plus-guide": "Meta Advantage+ App 최적화: OS·이벤트·입찰 설정",
  "performance-marketer-skills": "퍼포먼스 마케터 필요 역량: 실무 스킬 쌓는 순서",
  "performance-marketing-metrics": "퍼포먼스 마케팅 지표: 처음 볼 4개부터 CPA·ROAS 진단까지",
  "performance-marketing-analysis-order": "퍼포먼스 마케팅 분석 순서: 데이터에 맞는 첫 분석 고르기",
  "postback-integration-guide": "포스트백 연동 가이드: SAN·S2S·설치 0 오류 해결",
  "retargeting-reengagement-guide": "리타겟팅·재참여 캠페인 운영: UA와 분리하는 이유",
  "roas-improvement": "ROAS 개선 방법: 낮아졌을 때 예산보다 먼저 볼 4가지",
  "uplift-holdout-guide": "광고 업리프트 측정법: 홀드아웃 테스트로 순수 증가분 읽는 법",
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
  "ga4-data-traps": "GA4 Numbers Don't Match: 7 Reasons They Differ",
  "incrementality-measurement": "Incrementality: Validate Ad Lift With Holdouts and DiD",
  "marketing-mix-modeling": "Marketing Mix Modeling: Measure Channel Contribution",
  "multicollinearity-mmm-guide": "Multicollinearity Before MMM: How to Read High VIF",
  "performance-marketer-skills": "Performance Marketer Skills: What to Learn, In Order",
  "performance-marketing-metrics": "Performance Marketing Metrics: CTR, CVR, CPA, and ROAS",
  "performance-marketing-analysis-order": "Performance Marketing Analysis: Pick the Right First Method",
  "aha-moment-retention": "How to Find the Aha Moment: Early Actions and Retention",
  "apple-search-ads-guide": "Apple Search Ads Keywords: Exact Promotion and CPT Bids",
  "aso-basics-guide": "ASO Strategy: Improve Store Conversion and Keywords",
  "campaign-anomaly-detection": "Campaign Anomaly Detection: Find CPA and Conversion Drops",
  "cannibalization-organic-paid": "Ad Cannibalization: Measure Paid and Organic Overlap",
  "cohort-analysis-guide": "Cohort Analysis: Reading D1, D7, and D30 Retention Cohorts",
  "cpi-cpa-cpm-difference": "CPM vs CPC vs CPI vs CPA: Ad Cost Metrics Explained",
  "event-taxonomy-guide": "Event Taxonomy: Naming Rules for GA4 and MMP",
  "funnel-dropoff-analysis": "Conversion Rate: Diagnose Funnel Drop-off and Test Fixes",
  "google-uac-optimization": "Google UAC Optimization: What You Can Actually Control",
  "hook-3-seconds-framework": "The 3-Second Hook: Reduce Video Ad Drop-off",
  "ios-att-skan-guide": "iOS Measurement: ATT, SKAN, and Conversion Value Explained",
  "ad-creative-specs-guide": "Ad Creative Specs Guide: Platform Sizes and Safe Zones",
  "ad-creative-testing": "How Many Ad Creatives Should You Test on a Limited Budget?",
  "meta-advantage-plus-guide": "Meta Advantage+ App Optimization: OS, Events, and Bidding",
  "postback-integration-guide": "Postback Integration: Fix SAN, S2S, and Zero Installs",
  "retargeting-reengagement-guide": "Retargeting & Re-engagement: Why to Split From Acquisition",
  "roas-improvement": "How to Improve ROAS: Four Checks Before Cutting Budget",
  "uplift-holdout-guide": "Advertising Uplift: Measure Net Lift With a Holdout Test",
  "ltv-cac-ratio": "LTV:CAC Ratio Explained: How to Calculate It Correctly",
};

const TITLES = { ko: KO_TITLES, en: EN_TITLES };
const DRAFT_TITLES = {
  ko: { "adjust-vs-appsflyer": "Adjust vs AppsFlyer 비교: 모바일 MMP 선택 기준" },
  en: { "adjust-vs-appsflyer": "Adjust vs AppsFlyer: How to Choose a Mobile MMP" },
};
const DESCRIPTION_OVERRIDES = {
  ko: {
    "ad-creative-testing": "테스트 예산과 목표 CPA로 적정 소재 수를 계산하고 가설 설정부터 승자·보류·탈락 판정까지 정리합니다.",
    "cannibalization-organic-paid": "내부 카니발라이제이션과 유료·오가닉 잠식을 구분하고 측정하는 방법입니다.",
  },
  en: {
    "ad-creative-testing": "Calculate how many ad creatives your budget can support, define one hypothesis, and classify winners, holds, and losers without relying on CTR alone.",
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
// 2026-08-06: 서술형이라 검색어가 빠졌거나 뒤에 묻혔던 제목을 "키워드: 부제" 형태로
// 교체한 글. 본문은 그대로고 표기층만 바뀌었지만, 2026-07-28과 같은 성격의 편집이므로
// 같은 규칙으로 실제 편집일을 남긴다(sitemap lastmod → 재색인 유도). 로케일별로
// 교체 대상이 다르므로 KO·EN을 분리한다.
const UPDATED_2026_08_06 = {
  ko: new Set([
    "apple-search-ads-guide", "cpi-cpa-cpm-difference", "google-uac-optimization", "ios-att-skan-guide",
    "ltv-cac-ratio", "marketing-mix-modeling", "performance-marketer-skills",
  ]),
  en: new Set(["cpi-cpa-cpm-difference", "ga4-data-traps", "ltv-cac-ratio", "performance-marketer-skills"]),
};

export function getBlogSeo(locale, slug, source = {}) {
  const title = TITLES[locale]?.[slug] || DRAFT_TITLES[locale]?.[slug];
  if (!title) return null;
  const isEnglish = locale === "en";
  return {
    title,
    // 우선순위: 레지스트리 override > 원고 설명 > 자동 문구.
    // 자동 문구는 제목을 그대로 반복한 뒤 정보 없는 꼬리를 붙이는 형태라 SERP에서
    // 클릭 이유를 못 준다(전 글이 같은 문장을 공유해 중복 스니펫이 되기도 한다).
    // 원고가 직접 쓴 설명이 있으면 그쪽이 항상 낫기 때문에 폴백 순서를 그렇게 둔다.
    // 자동 문구는 설명이 아예 없는 글에만 남는 최후 수단이다.
    description: DESCRIPTION_OVERRIDES[locale]?.[slug] || source.description || (isEnglish
      ? `${title}. A practical guide to the key checks, trade-offs, and next steps.`
      : `${title}. 핵심 기준과 실무 확인 순서를 정리합니다.`),
    intent: isEnglish ? "Search answer · practical workflow" : "검색 답변 · 실무 워크플로우",
    updated: source.updated || (UPDATED_2026_08_06[locale]?.has(slug)
      ? "2026-08-06"
      : (UPDATED_2026_07_28.has(slug)
        ? "2026-07-28"
        : ((isEnglish ? UPDATED_TODAY_EN : UPDATED_TODAY).has(slug) ? "2026-07-20" : ""))),
  };
}

export function publishedBlogSeoSlugs(locale) {
  return Object.keys(TITLES[locale] || {});
}
