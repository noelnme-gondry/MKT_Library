// 도구/SOP 페이지별 SEO keywords 메타 (네이버는 구글보다 meta keywords·description
// 텍스트 매칭에 민감 — AGENTS.md §1). 하드코딩 전체 표 대신 "그룹(SOP)/항목(분석 도구)"
// 최소 단위로만 매핑하고, generateMetadata가 전역 브랜드 키워드와 합쳐 최종 keywords를
// 조립한다(§12.19 자동생성 원칙 — 표류 방지).
//
// 분석 도구(5-x·9-x)는 서로 완전히 다른 기능이라 항목별로, SOP(01~04·08)는 그룹
// 내 항목들이 같은 주제군이라 그룹별로 매핑한다.

// 모든 페이지에 공통으로 붙는 짧은 브랜드/카테고리 키워드.
export const PAGE_KEYWORDS_BASE = "퍼포먼스 마케팅, 마케팅 데이터 분석, 무료 마케팅 툴, 데이터 드리븐";

// 분석 도구 (5-x, 9-x) — 항목(item) 단위.
export const ITEM_KEYWORDS = {
  "5-2": "운영 대시보드, 마케팅 대시보드 무료, 캠페인 스코어카드, 페이싱 분석, 이상탐지, 코호트 분석, 퍼널 분석",
  "5-21": "캠페인 성과 변동, PVM 분해, 믹스효과, 효율효과, CPA 상승 원인, 성과 변동 진단",
  "5-22": "캠페인 포화도, 한계 CPA, 한계 ROAS, 응답곡선, 캠페인 최적화, 예산 스케일업",
  "5-3": "마케팅 예산 배분, 예산 배분 시뮬레이터, 목표 CPI, 목표 CPA, 목표 ROAS, 채널 예산 최적화, 예산 재배분",
  "5-4": "A/B 테스트, AB test, 실험 분석, 통계적 유의성, 표본 크기, 전환율 최적화",
  "5-23": "증분 분석, incrementality, 홀드아웃 테스트, 인과추론 마케팅, 전후 비교 분석, iROAS",
  "5-18": "마케팅 반응 분석, MMM, 마케팅 믹스 모델링, 회귀분석, 채널 기여도 분석, 카니발리제이션 진단",
  "5-20": "Aha-moment, 핵심 가치 발굴, 리텐션 선행지표, 그로스 마케팅, 프로덕트 그로스",
  "9-1": "콘텐츠 요소 분석, 콘텐츠 성과 기여, 콘텐츠 마케팅 분석",
  "9-2": "킬러 콘텐츠, 충성 독자 발굴, 구독 전환 분석, 콘텐츠 마케팅",
  "9-3": "콘텐츠 트래픽 변동, 유입경로 분석, 콘텐츠 카테고리 분석",
  "9-6": "소재 분석, 광고 소재 분석, 소재 피로도, CTR 개선, 광고 크리에이티브, 포레스트 플롯",
  "9-7": "콘텐츠 운영 대시보드, 콘텐츠 스코어카드, 콘텐츠 이상탐지",
  // 5-24·5-25·5-26은 배포 후에도 여기 없어서 브랜드 일반 키워드만 싣고 있었다.
  // 이 파일엔 테스트가 아예 없었다(감사 P1-9) — pageKeywords.test.js가 이제 강제한다.
  "5-24": "브랜드 캠페인 증분, 브랜드 검색량 분석, ITS 분석, 중단점 회귀, 브랜드 리프트 측정",
  "5-25": "다중공선성, VIF, 분산팽창지수, 채널 상관관계, MMM 사전 점검, 기여도 분리",
  "5-26": "Apple Search Ads, ASA 키워드, Exact 승격, CPT 입찰 조정, 검색어 리포트, 앱스토어 검색광고",
};

// EN 버전 — EN_READY_TOOL_IDS(routeMap.js)에 있는 항목만. 없으면 buildPageKeywords가
// 조용히 빈 문자열로 폴백(KR 키워드를 EN 페이지에 새는 대신 base만 노출).
export const PAGE_KEYWORDS_BASE_EN = "performance marketing, marketing data analytics, free marketing tools, data-driven marketing";

export const ITEM_KEYWORDS_EN = {
  "5-2": "operations dashboard, free marketing dashboard, campaign scorecard, pacing analysis, anomaly detection, cohort analysis, funnel analysis",
  "5-21": "campaign performance variance, PVM decomposition, mix effect, efficiency effect, CPA increase cause, performance variance diagnosis",
  "5-22": "campaign saturation, marginal CPA, marginal ROAS, response curve, campaign optimization, budget scale-up",
  "5-3": "marketing budget allocation, budget allocation simulator, target CPI, target CPA, target ROAS, channel budget optimization, budget reallocation",
  "9-6": "creative analysis, ad creative analysis, creative fatigue, CTR improvement, ad creative, forest plot",
  "5-4": "A/B test, AB testing, experiment analysis, statistical significance, sample size, conversion rate optimization",
  "5-23": "incrementality analysis, incrementality, holdout test, causal inference marketing, pre-post analysis, iROAS",
  "5-18": "marketing response analysis, MMM, marketing mix modeling, regression analysis, channel contribution analysis, cannibalization diagnosis",
  "5-20": "aha-moment, aha moment finder, retention leading indicator, growth marketing, product growth",
  "9-1": "content element analysis, content performance contribution, content marketing analytics",
  "5-24": "brand campaign incrementality, brand search volume analysis, interrupted time series, ITS analysis, brand lift measurement",
  "5-25": "multicollinearity, VIF, variance inflation factor, channel correlation, MMM pre-check, contribution separability",
  "5-26": "Apple Search Ads, ASA keywords, exact match promotion, CPT bid adjustment, search terms report, app store search ads",
};

// SOP 가이드 (01~04, 08) — 그룹(group) 단위.
export const GROUP_KEYWORDS = {
  "01": "MMP 연동, 이벤트 택소노미, 매체 포스트백, iOS 프라이버시, ATT, SKAN, 앱 마케팅 인프라",
  "02": "Google UAC, Meta Advantage+, Apple Search Ads, 앱 리타겟팅, UA 마케팅, 앱 설치 캠페인",
  "03": "ASO, 앱스토어 최적화, 광고 소재 규격, 3초 훅 설계, 모바일 앱 마케팅",
  "04": "앱 마케팅 KPI, 코호트 리텐션, 카니발리제이션, 오가닉 vs 페이드",
  "08": "CSV 데이터 준비, 컬럼 매핑 가이드, 데이터 분석 가이드, 노코드 데이터 분석",
};

// meta = findMeta(routeId) 결과({ id, title, group }). 도구/SOP 페이지 keywords 문자열을
// 조립(중복 제거, 콤마 구분). 매핑이 없는 페이지(홈 등)는 base만 반환.
export function buildPageKeywords(meta, locale = "ko") {
  if (locale === "en") {
    const specificEn = (meta && ITEM_KEYWORDS_EN[meta.id]) || "";
    const allEn = `${PAGE_KEYWORDS_BASE_EN}, ${specificEn}`
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    return Array.from(new Set(allEn)).join(", ");
  }
  const specific = (meta && (ITEM_KEYWORDS[meta.id] || GROUP_KEYWORDS[meta.group?.id])) || "";
  const all = `${PAGE_KEYWORDS_BASE}, ${specific}`
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  return Array.from(new Set(all)).join(", ");
}
