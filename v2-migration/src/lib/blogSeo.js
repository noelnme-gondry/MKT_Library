// 검색 의도에 맞춘 블로그 표기층. 원고 파일을 다시 쓰지 않고도 제목·요약을
// 일괄 교정할 수 있는 SSOT — 목록, 상세, metadata, JSON-LD가 같은 값을 사용한다.
const KO_TITLES = {
  "ab-testing": "A/B 테스트 방법: 표본 크기·유의성·결과 해석까지",
  "ad-creative-specs-guide": "소재가 반려·크롭되는 이유: 매체 규격 위반 진단",
  "ad-creative-testing": "광고 소재 테스트 방법: 테스트 개수·예산·판정 기준",
  "ad-machine-learning": "광고 머신러닝 학습 단계: CPA 급등 원인과 운영 방법",
  "ad-performance-diagnosis": "광고 성과 하락 원인: CPA 상승·CTR 하락 때 확인할 4단계",
  "aha-event-ad-optimization": "Aha Event로 광고 최적화하기: 설치 CPA와 리텐션 연결",
  "aha-moment-retention": "Aha Moment 찾는 법: 초기 행동과 리텐션 분석",
  "ai-era-marketer": "AI 시대 퍼포먼스 마케터 역량: 자동화 이후에도 남는 일",
  "apple-search-ads-guide": "Apple Search Ads 검색어 진단: 낭비 키워드 찾기",
  "asa-keyword-expansion": "ASA 키워드 확장: Discovery에서 Exact로 올리는 기준",
  "aso-basics-guide": "ASO란? 앱스토어 최적화 방법: 키워드·스크린샷·전환율",
  "store-conversion-drop-diagnosis": "스토어 전환율 하락: 페이지 탓인가 유입 구성 탓인가",
  "store-listing-experiment": "스토어 실험 설계: PPO·Play 등록정보 실험 판독법",
  "attribution-data-mismatch": "어트리뷰션 데이터 불일치 원인: 매체·GA4·MMP 전환수 비교",
  "audience-broad-vs-narrow": "브로드 타겟 vs 좁은 타겟: 광고 오디언스 선택 기준",
  "brand-campaign-lift": "브랜드 캠페인 효과 측정: 검색량·직접유입으로 보는 법",
  "budget-marginal-efficiency": "마케팅 예산 배분 방법: 한계 CPA·ROAS로 채널 예산 나누기",
  "budget-scaling-limit": "광고 예산 증액 기준: CPA가 오르기 전 한계점 찾는 법",
  "campaign-anomaly-detection": "캠페인 이상 탐지: CPA 급등·전환 급감 원인 찾기",
  "cannibalization-organic-paid": "광고 카니발라이제이션이란? 유료·오가닉 잠식 측정",
  "cohort-analysis-guide": "D1·D7·D30 리텐션 코호트 분석: 평균이 숨기는 이탈 읽는 법",
  "content-element-analysis": "광고 소재 성과 분석: 후킹·길이·형식 중 뭐가 효과 있었나",
  "correlation-vs-causation": "상관관계와 인과관계 차이: 마케팅 실험으로 검증하기",
  "cpi-cpa-cpm-difference": "CPI·CPA·CPM·CPC 차이와 계산법: 어떤 지표를 봐야 할까",
  "creative-attribute-regression": "썸네일·제목을 A/B 없이 비교하는 법",
  "event-taxonomy-guide": "이벤트 택소노미(텍소노미)·SDK 오류 진단: 이름 충돌·누락",
  "funnel-dropoff-analysis": "전환율 개선 방법: CVR이 낮을 때 퍼널에서 원인 찾는 법",
  "ga4-data-traps": "GA4 데이터 오류처럼 보이는 숫자 차이: 집계 기준 7가지",
  "google-uac-optimization": "Google UAC 성과가 흔들릴 때: 학습·입찰 원인 진단",
  "hook-3-seconds-framework": "광고 첫 3초 후킹: 영상 소재 이탈률 줄이는 방법",
  "incrementality-measurement": "증분성 측정이란? 홀드아웃·DiD로 광고 효과 검증",
  "ios-att-skan-guide": "iOS ATT·SKAN 측정 가이드: 성과가 반토막 보이는 이유",
  "ltv-cac-ratio": "LTV:CAC 비율 계산법: 3:1 기준과 흔한 오류 3가지",
  "marketing-mix-modeling": "마케팅 믹스 모델링(MMM)이란? 채널 기여도 측정법",
  "multicollinearity-mmm-guide": "MMM 전 다중공선성 점검: VIF가 높을 때 채널 기여도 해석법",
  "meta-advantage-plus-guide": "Meta Advantage+ 성과 진단: iOS·안드로이드 차이 읽기",
  "offline-ad-online-impact": "TV·오프라인 광고의 온라인 효과 측정법",
  "performance-marketer-skills": "퍼포먼스 마케터 필요 역량: 실무 스킬 쌓는 순서",
  "performance-marketing-metrics": "퍼포먼스 마케팅 지표 총정리: CTR·CVR·CPI·CPA·ROAS 보는 순서",
  "performance-marketing-analysis-order": "퍼포먼스 마케팅 분석 순서: 데이터에 맞는 첫 분석 고르기",
  "postback-integration-guide": "포스트백 오류 진단: 설치 0·전환 누락 원인 찾기",
  "retargeting-reengagement-guide": "리타겟팅 성과가 좋아 보이는 이유: UA 혼입 진단",
  "roas-improvement": "ROAS 하락 원인과 개선 방법: 예산 줄이기 전 볼 4가지",
  "uplift-holdout-guide": "광고 업리프트 측정법: 홀드아웃 테스트로 순수 증가분 읽는 법",
  "skan4-migration-guide": "SKAN 4 전환 실무: 창 3개를 어떤 순서로 켜나",
  "skan-conversion-value-schema": "SKAN 컨버전 밸류 설계: 64칸에 뭘 담을까",
  "skan-vs-mmp-attribution": "SKAN 어트리뷰션과 MMP 숫자가 다른 이유",
};

const EN_TITLES = {
  "ab-testing": "A/B Testing: Sample Size, Significance, and Reading Results",
  "ad-machine-learning": "Ad Machine Learning: Why CPA Spikes and How to Operate",
  "ad-performance-diagnosis": "Ad Performance Drop: Why CPA Rises and CTR Falls",
  "aha-event-ad-optimization": "Aha Event Ad Optimization: Connect CPA to Retention",
  "ai-era-marketer": "The AI-Era Performance Marketer: Skills That Still Matter",
  "attribution-data-mismatch": "Attribution Data Mismatch: Media vs GA4 vs MMP",
  "audience-broad-vs-narrow": "Broad vs Narrow Targeting: How to Choose an Ad Audience",
  "budget-marginal-efficiency": "Marketing Budget Allocation: Split Channels by Marginal CPA and ROAS",
  "correlation-vs-causation": "Correlation vs Causation: Verify Lift With Experiments",
  "ga4-data-traps": "GA4 Numbers Don't Match: 7 Reasons They Differ",
  "incrementality-measurement": "Incrementality: Validate Ad Lift With Holdouts and DiD",
  "marketing-mix-modeling": "Marketing Mix Modeling: Measure Channel Contribution",
  "multicollinearity-mmm-guide": "Multicollinearity Before MMM: How to Read High VIF",
  "performance-marketer-skills": "Performance Marketer Skills: What to Learn, In Order",
  "performance-marketing-metrics": "Performance Marketing Metrics: Read CTR, CVR, CPA, and ROAS in Order",
  "performance-marketing-analysis-order": "Performance Marketing Analysis: Pick the Right First Method",
  "aha-moment-retention": "How to Find the Aha Moment: Early Actions and Retention",
  "apple-search-ads-guide": "Apple Search Ads Terms: Find Wasted Keywords",
  "asa-keyword-expansion": "ASA Keywords: When to Promote to Exact Match",
  "brand-campaign-lift": "Measuring Brand Campaign Lift Without Clicks",
  "budget-scaling-limit": "Ad Budget Scaling: Find the Limit Before CPA Rises",
  "content-element-analysis": "Ad Creative Performance Analysis: Hook, Length, or Format?",
  "creative-attribute-regression": "Compare Thumbnails and Titles Without A/B Tests",
  "offline-ad-online-impact": "Measuring TV and Offline Ad Impact Online",
  "aso-basics-guide": "App Store Optimization (ASO): Keywords, Screenshots, Conversion",
  "store-conversion-drop-diagnosis": "Store Conversion Dropped: Page Problem or Traffic Mix?",
  "store-listing-experiment": "Store Listing Experiments: Designing and Reading PPO Tests",
  "campaign-anomaly-detection": "Campaign Anomaly Detection: Find CPA and Conversion Drops",
  "cannibalization-organic-paid": "Ad Cannibalization: Measure Paid and Organic Overlap",
  "cohort-analysis-guide": "Cohort Analysis: Reading D1, D7, and D30 Retention Cohorts",
  "cpi-cpa-cpm-difference": "CPM vs CPC vs CPI vs CPA: Which Cost Metric to Use?",
  "event-taxonomy-guide": "Event Taxonomy & SDK Errors: Names, Gaps, and QA",
  "funnel-dropoff-analysis": "Conversion Rate Optimization: Find the Funnel Step That Leaks",
  "google-uac-optimization": "When Google UAC Slips: Diagnose Learning and Bids",
  "hook-3-seconds-framework": "The 3-Second Hook: Reduce Video Ad Drop-off",
  "ios-att-skan-guide": "iOS Measurement: ATT, SKAN, and Conversion Value Explained",
  "ad-creative-specs-guide": "Why Creatives Get Rejected or Cropped by Networks",
  "ad-creative-testing": "Ad Creative Testing: How Many to Run, and How to Judge",
  "meta-advantage-plus-guide": "Meta Advantage+ Diagnosis: Reading iOS vs Android",
  "postback-integration-guide": "Postback Errors: Diagnose Zero Installs and Lost Events",
  "retargeting-reengagement-guide": "Why Retargeting Looks Better Than It Is",
  "roas-improvement": "ROAS Dropped: Causes and Fixes Before You Cut Budget",
  "uplift-holdout-guide": "Advertising Uplift: Measure Net Lift With a Holdout Test",
  "ltv-cac-ratio": "LTV:CAC Ratio Explained: How to Calculate It Correctly",
  "skan4-migration-guide": "SKAN 4 Strategy: Which SKAdNetwork 4.0 Window to Open",
  "skan-conversion-value-schema": "SKAN Conversion Value Schema: What Fits in 64 Slots",
  "skan-vs-mmp-attribution": "Why SKAN Attribution and MMP Numbers Disagree",
};

const TITLES = { ko: KO_TITLES, en: EN_TITLES };

// 화면 h1은 SERP 제목과 역할이 다르다. 제목은 검색 결과 목록에서 질의와 겹쳐야 하니
// "키워드: 부제" 형태로 검색어를 앞에 세우고, h1은 그 페이지에 도착한 사람이 읽는
// 첫 문장이라 질문형이 자연스럽다. 둘을 한 값으로 묶으면 둘 중 하나가 반드시 어색해진다.
//
// 맵은 성기게 둔다 — 제목과 h1이 같아도 되는 글이 대부분이고, 여기 없는 slug는
// 제목을 그대로 쓴다. 즉 "h1을 따로 적었다"는 것 자체가 의도의 표식이다.
const KO_H1 = {
  "ab-testing": "A/B 테스트, 표본 크기부터 판정까지",
  "ad-creative-testing": "광고 소재는 한 번에 몇 개까지 테스트해야 할까?",
  "ad-performance-diagnosis": "광고 CPA가 상승했을 때 원인 찾는 순서",
  "aso-basics-guide": "앱스토어 최적화(ASO), 무엇부터 손대야 할까?",
  "budget-marginal-efficiency": "채널별 마케팅 예산은 어떻게 나눠야 할까?",
  "budget-scaling-limit": "광고 예산은 얼마나 올려도 될까?",
  "content-element-analysis": "어떤 소재 요소가 성과를 만들었을까?",
  "funnel-dropoff-analysis": "전환율이 낮을 때 어디부터 개선해야 할까?",
  "performance-marketing-metrics": "퍼포먼스 마케팅 지표, 어떤 순서로 봐야 할까?",
  "roas-improvement": "ROAS가 떨어졌을 때 무엇부터 봐야 할까?",
};
const EN_H1 = {
  "ab-testing": "A/B Testing, From Sample Size to Decision",
  "ad-creative-testing": "How Many Ad Creatives Should You Test at Once?",
  "ad-performance-diagnosis": "How to Find Why Your Ad CPA Went Up",
  "aso-basics-guide": "App Store Optimization: Where Should You Start?",
  "budget-marginal-efficiency": "How Should You Split Budget Across Channels?",
  "budget-scaling-limit": "How Much Can You Scale Ad Budget?",
  "content-element-analysis": "Which Creative Element Actually Drove Performance?",
  "funnel-dropoff-analysis": "Where Should You Fix a Low Conversion Rate?",
  "performance-marketing-metrics": "Which Marketing Metric Should You Read First?",
  "roas-improvement": "What Should You Check When ROAS Falls?",
};
const H1 = { ko: KO_H1, en: EN_H1 };
const DRAFT_TITLES = {
  ko: { "adjust-vs-appsflyer": "Adjust vs AppsFlyer 비교: 모바일 MMP 선택 기준" },
  en: { "adjust-vs-appsflyer": "Adjust vs AppsFlyer: How to Choose a Mobile MMP" },
};
const DESCRIPTION_OVERRIDES = {
  ko: {
    "aso-basics-guide": "ASO 전략은 검색 노출과 스토어 전환을 함께 고칩니다. 아이콘·스크린샷·평점부터 키워드까지 순서대로.",
    "ad-creative-testing": "테스트 예산과 목표 CPA로 적정 소재 수를 계산하고 가설 설정부터 승자·보류·탈락 판정까지 정리합니다.",
    "cannibalization-organic-paid": "내부 카니발라이제이션과 유료·오가닉 잠식을 구분하고 측정하는 방법입니다.",
    "cpi-cpa-cpm-difference": "CPM 2,000원·CTR 1%면 CPC는 200원. 네 지표 계산식과 CPC 상승을 경매·소재로 가르는 법.",
    "performance-marketing-metrics": "CTR·CVR·CPA·ROAS를 보는 순서와, CPA·ROAS가 흔들릴 때 문제 위치를 찾는 방법을 정리합니다.",
  },
  en: {
    "aso-basics-guide": "An ASO strategy fixes both search visibility and the store conversion after an ad click. Icon, screenshots, ratings, then keywords — in order.",
    "ad-creative-testing": "Calculate how many ad creatives your budget can support, define one hypothesis, and classify winners, holds, and losers without relying on CTR alone.",
    "cannibalization-organic-paid": "Measure internal cannibalisation and separate paid impact from organic demand.",
    "cpi-cpa-cpm-difference": "At a 1% CTR, CPC equals CPM divided by 10. Compare all four formulas, then separate auction pressure from creative response when CPC rises.",
    "performance-marketing-metrics": "Review CTR, CVR, CPA, and ROAS in order to locate whether a performance problem sits before or after conversion.",
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

// 2026-08-14: 같은 주제 가이드(/guide/*)와 제목 프레이밍까지 겹쳐 한 쿼리에 두 URL이
// 붙던 글을 진단·원인 프레이밍으로 교체했다(역할 분리 — 글은 "왜/무엇", 가이드는
// "어떻게"). 본문은 그대로고 표기층만 바뀐 2026-08-06과 같은 성격의 편집이다.
const UPDATED_2026_08_14 = new Set([
  "ad-creative-specs-guide", "apple-search-ads-guide", "event-taxonomy-guide", "google-uac-optimization",
  "meta-advantage-plus-guide", "postback-integration-guide", "retargeting-reengagement-guide",
]);
// 2026-09-08: 검색어 재편. 제목을 "분석가가 붙인 이름"에서 "검색자가 치는 말"로
// 옮기고(예: 콘텐츠 요소 분석 → 광고 소재 성과 분석), 같은 작업에서 h1을 질문형으로
// 분리하고 seoAnswer를 새 핵심어에 맞춰 다시 썼다. 본문 구조도 함께 바뀐 글이 있어
// 2026-08-06(표기층만) 보다 편집 폭이 크다.
const UPDATED_2026_09_08 = new Set([
  "ab-testing", "ad-creative-testing", "ad-performance-diagnosis", "aso-basics-guide",
  "budget-marginal-efficiency", "budget-scaling-limit", "content-element-analysis",
  "funnel-dropoff-analysis", "performance-marketing-metrics", "roas-improvement",
]);
const UPDATED_2026_08_26 = new Set([
  "cpi-cpa-cpm-difference", "performance-marketing-metrics",
]);

export function getBlogSeo(locale, slug, source = {}) {
  const title = TITLES[locale]?.[slug] || DRAFT_TITLES[locale]?.[slug];
  if (!title) return null;
  const isEnglish = locale === "en";
  return {
    title,
    // 화면 제목. 따로 적지 않았으면 SERP 제목을 그대로 쓴다.
    h1: H1[locale]?.[slug] || title,
    // 우선순위: 레지스트리 override > 원고 설명 > 자동 문구.
    // 자동 문구는 제목을 그대로 반복한 뒤 정보 없는 꼬리를 붙이는 형태라 SERP에서
    // 클릭 이유를 못 준다(전 글이 같은 문장을 공유해 중복 스니펫이 되기도 한다).
    // 원고가 직접 쓴 설명이 있으면 그쪽이 항상 낫기 때문에 폴백 순서를 그렇게 둔다.
    // 자동 문구는 설명이 아예 없는 글에만 남는 최후 수단이다.
    description: DESCRIPTION_OVERRIDES[locale]?.[slug] || source.description || (isEnglish
      ? `${title}. A practical guide to the key checks, trade-offs, and next steps.`
      : `${title}. 핵심 기준과 실무 확인 순서를 정리합니다.`),
    intent: isEnglish ? "Search answer · practical workflow" : "검색 답변 · 실무 워크플로우",
    updated: source.updated || (UPDATED_2026_09_08.has(slug)
      ? "2026-09-08"
      : UPDATED_2026_08_26.has(slug)
      ? "2026-08-26"
      : UPDATED_2026_08_14.has(slug)
      ? "2026-08-14"
      : UPDATED_2026_08_06[locale]?.has(slug)
      ? "2026-08-06"
      : (UPDATED_2026_07_28.has(slug)
        ? "2026-07-28"
        : ((isEnglish ? UPDATED_TODAY_EN : UPDATED_TODAY).has(slug) ? "2026-07-20" : ""))),
  };
}

export function publishedBlogSeoSlugs(locale) {
  return Object.keys(TITLES[locale] || {});
}
