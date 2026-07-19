// 검색 의도에 맞춘 블로그 표기층. 원고 파일을 다시 쓰지 않고도 제목·요약을
// 일괄 교정할 수 있는 SSOT — 목록, 상세, metadata, JSON-LD가 같은 값을 사용한다.
const KO_TITLES = {
  "ab-testing": "A/B 테스트 방법: 표본 크기·유의성·판정 기준",
  "ad-creative-specs-guide": "광고 소재 규격 가이드: 매체별 사이즈·세이프존",
  "ad-machine-learning": "광고 머신러닝 학습 단계: CPA 급등 원인과 운영 방법",
  "ad-performance-drop": "광고 성과가 반토막 났을 때, 소재부터 만지면 원인 놓쳐요",
  "aha-moment-retention": "Aha Moment 찾는 법: 초기 행동과 리텐션 분석",
  "ai-era-marketer": "AI 시대 퍼포먼스 마케터 역량: 자동화 이후에도 남는 일",
  "apple-search-ads-guide": "Apple Search Ads, 캠페인 왜 4개로 쪼개나 — 구조부터",
  "aso-basics-guide": "광고비 태우기 전에, 스토어에서 새는 설치부터 막으세요 — ASO 기초",
  "attribution-data-mismatch": "어트리뷰션 데이터 불일치 원인: 매체·GA4·MMP 전환수 비교",
  "audience-broad-vs-narrow": "브로드 타겟 vs 좁은 타겟: 광고 오디언스 선택 기준",
  "campaign-anomaly-detection": "캠페인 이상 탐지: CPA 급등·전환 급감 원인 찾기",
  "campaign-saturation-signals": "캠페인 포화도 진단: 한계 CPA와 예산 증액 기준",
  "cannibalization-organic-paid": "광고 카니발라이제이션이란? 유료·오가닉 잠식 측정",
  "cohort-analysis-guide": "리텐션 30%라는데 매출은 왜 안 오를까 — 코호트로 쪼개면 보여요",
  "correlation-vs-causation": "상관관계와 인과관계 차이: 마케팅 실험으로 검증하기",
  "cpa-reduction": "CPA 낮추는 방법: 소재·퍼널·예산 원인별 진단",
  "cpi-cpa-cpm-difference": "CPI·CPA·CPM·CPC 차이: 광고 지표 계산과 선택 기준",
  "creative-fatigue": "광고 소재 피로도 진단: 교체 시점과 CTR 하락 신호",
  "ctr-improvement": "같은 소재인데 CTR이 반토막 — 소재 말고 여기가 문제일 수 있어요",
  "cvr-optimization": "전환율(CVR) 개선 방법: 퍼널별 이탈 원인 점검",
  "event-taxonomy-guide": "이벤트 택소노미 설계: GA4·MMP 전환 데이터 이름 규칙",
  "funnel-dropoff-analysis": "전환 퍼널 어디서 새는지 찾는 법",
  "ga4-data-traps": "GA4 데이터 오류처럼 보이는 숫자 차이: 집계 기준 7가지",
  "google-uac-optimization": "Google UAC(앱 캠페인) 최적화, 뭘 건드릴 수 있나",
  "hook-3-seconds-framework": "광고 첫 3초 후킹: 영상 소재 이탈률 줄이는 방법",
  "incrementality-measurement": "증분성 측정이란? 홀드아웃·DiD로 광고 효과 검증",
  "ios-att-skan-guide": "iOS 성과가 반토막으로 '보이는' 이유 — ATT·SKAN 측정 정리",
  "junior-metrics-guide": "퍼포먼스 마케팅 지표 4가지: CTR·CVR·CPA·ROAS 읽기",
  "ltv-cac-ratio": "LTV:CAC 3:1이면 안심? 그 계산, 대부분 틀리게 하고 있어요",
  "marketing-budget-allocation": "마케팅 예산 배분 방법: 한계 CPA·응답곡선으로 최적화",
  "marketing-mix-modeling": "라스트클릭이 브랜드검색만 칭찬할 때 — 채널 기여도, MMM으로 재는 법",
  "meta-advantage-plus-guide": "Meta Advantage+ App 최적화: OS·이벤트·입찰 설정",
  "performance-marketer-skills": "퍼포먼스 마케터 스킬, 툴 이름부터 외우면 순서가 틀렸어요",
  "performance-marketing-metrics": "퍼포먼스 마케팅 지표, 따로 외우지 말고 '연결해서' 읽으세요",
  "postback-integration-guide": "포스트백 연동 가이드: SAN·S2S·설치 0 오류 해결",
  "retargeting-reengagement-guide": "리타겟팅·재참여 캠페인 운영: UA와 분리하는 이유",
  "roas-improvement": "ROAS 개선 방법: 한계 ROAS와 예산 재배분 기준",
  "scaling-pitfalls": "광고 캠페인 스케일업 실패 원인: 예산 증액·포화도 진단",
};

const EN_TITLES = {
  "ab-testing": "A/B Testing: Sample Size, Significance, and Decision Rules",
  "ad-machine-learning": "Ad Machine Learning: Why CPA Spikes and How to Operate",
  "ad-performance-drop": "Ad Performance Cut in Half? Touching Creative First Means Missing the Cause",
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
  "marketing-mix-modeling": "When Last-Click Only Praises Brand Search — Measuring Channel Contribution with MMM",
  "performance-marketer-skills": "Performance Marketer Skills Roadmap: Operations, Analytics, and Causality",
  "performance-marketing-metrics": "Performance Marketing Metrics: Connect CPI, CPA, ROAS, and LTV",
  "roas-improvement": "How to Improve ROAS: Marginal ROAS and Budget Reallocation",
  "scaling-pitfalls": "Why Ad Campaign Scaling Fails: Budget Increases and Saturation",
};

const TITLES = { ko: KO_TITLES, en: EN_TITLES };
const UPDATED_TODAY = new Set([
  "ad-performance-drop", "apple-search-ads-guide", "aso-basics-guide", "cohort-analysis-guide",
  "ctr-improvement", "funnel-dropoff-analysis", "google-uac-optimization", "ios-att-skan-guide",
  "ltv-cac-ratio", "marketing-mix-modeling", "performance-marketer-skills", "performance-marketing-metrics",
]);
const UPDATED_TODAY_EN = new Set(["ad-performance-drop", "marketing-mix-modeling"]);

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
    updated: (isEnglish ? UPDATED_TODAY_EN : UPDATED_TODAY).has(slug) ? "2026-07-20" : "",
  };
}

export function publishedBlogSeoSlugs(locale) {
  return Object.keys(TITLES[locale] || {});
}
