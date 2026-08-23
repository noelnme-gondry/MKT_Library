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
  "5-18": "마케팅 반응 분석, 주간 패널 CSV, MMM 데이터 준비, 컬럼 매핑",
  "5-18-trend": "마케팅 추세 분석, 계절성 분리, 이상 주차 탐지, 기준선, 주간 추세",
  "5-18-paid-organic": "Paid Organic 변화맵, 오가닉 감소, 유료 오가닉 반대 움직임, WoW 변화",
  "5-18-cannibal": "카니발리제이션 진단, 광고 잠식, 브랜드 검색 잠식, 오가닉 잠식, 그랜저 인과",
  "5-18-mmm": "MMM, 마케팅 믹스 모델링, 채널 기여도 분석, adstock, 포화 곡선, 기본 수요",
  "5-18-forecast": "마케팅 회귀 예측, 성과 예측, OOS 검증, 예측 구간, 시나리오 예측",
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
  "5-27": "ASO, 앱스토어 최적화, 스토어 전환율, 제품 페이지 조회, 유입 소스별 전환, 스토어 퍼널, ASO 분석 도구",
  "5-26": "Apple Search Ads, ASA 키워드, Exact 승격, CPT 입찰 조정, 검색어 리포트, 앱스토어 검색광고",
  "5-28": "구독 생존분석, 이탈 분석, Kaplan-Meier, 해저드, 중도절단, RMST, 구독 LTV, 리텐션 실험",
  // 가이드도 항목 단위. GROUP_KEYWORDS만 있으면 같은 그룹의 3~4개 페이지가 제목만
  // 다르고 keywords·description이 통째로 같아져 서로 잡아먹는다(그룹 01은 4페이지가
  // 동일 문자열이었다). GROUP_KEYWORDS는 신규 가이드용 폴백으로 남긴다.
  "1-1": "MMP SDK 연동, 테크니컬 PRD, 딥링크 라우팅, 앱 마케팅 개발 협업, 트래킹 QA",
  "1-2": "이벤트 택소노미, 인앱 이벤트 설계, 이벤트 네이밍 규칙, GA4 이벤트, 전환 이벤트 파라미터",
  "1-3": "포스트백 연동, Adjust 포스트백, SAN 연동, S2S postback, 매체 전환 전달",
  "1-4": "iOS ATT, SKAdNetwork, SKAN 4.0, 컨버전 값 스키마, ATT 동의율, iOS 프라이버시 대응",
  "2-1": "Google UAC, 앱 캠페인 운영, UAC 입찰 전략, 에셋 그룹, 구글 앱 광고",
  "2-2": "Meta Advantage+ App, AAP 최적화, Meta 앱 광고, SKAN 캠페인, OS 분리 운영",
  "2-3": "Apple Search Ads 운영, ASA 캠페인 구조, ASA 키워드 입찰, 앱스토어 검색광고",
  "2-4": "앱 리타겟팅, 리인게이지먼트, 디퍼드 딥링크, 휴면 사용자 복귀, 재참여 캠페인",
  "3-1": "ASO, 앱스토어 최적화, 스토어 메타데이터, 스토어 A/B 테스트, ASO 키워드",
  "3-2": "광고 소재 규격, 소재 사이즈, 플레이어블 광고, 영상 세이프존, 매체별 에셋 규격",
  "3-3": "3초 훅, 영상 광고 후킹, 첫 프레임 설계, 영상 이탈률, 소재 기획 프레임워크",
  "4-1": "앱 마케팅 KPI, CPI CPA 정의, ARPU, ROAS 기준, 마케팅 벤치마크",
  "4-2": "코호트 분석, 리텐션 곡선, D1 D7 D30 리텐션, 누적 ARPU, LTV 추정",
  "4-3": "카니발리제이션, 오가닉 페이드, ROAS 과대평가, 증분 보정, 유료 오가닉 잠식",
  "8-1": "CSV 데이터 준비, 컬럼 매핑, 데이터 전처리, 분석 데이터 구조, 노코드 데이터 분석",
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
  "5-18": "marketing response analysis, weekly panel CSV, MMM data setup, column mapping",
  "5-18-trend": "marketing trend analysis, seasonality separation, outlier weeks, baseline, weekly trend",
  "5-18-paid-organic": "paid organic map, organic decline, opposite movement, WoW change",
  "5-18-cannibal": "cannibalization diagnosis, ad displacement, brand search cannibalization, organic displacement, Granger causality",
  "5-18-mmm": "MMM, marketing mix modeling, channel contribution analysis, adstock, saturation curve, base demand",
  "5-18-forecast": "marketing regression forecast, performance forecast, OOS validation, prediction interval, scenario forecast",
  "5-20": "aha-moment, aha moment finder, retention leading indicator, growth marketing, product growth",
  "9-1": "content element analysis, content performance contribution, content marketing analytics",
  "5-24": "brand campaign incrementality, brand search volume analysis, interrupted time series, ITS analysis, brand lift measurement",
  "5-25": "multicollinearity, VIF, variance inflation factor, channel correlation, MMM pre-check, contribution separability",
  "5-27": "ASO, app store optimization, store conversion rate, product page views, conversion by traffic source, store funnel, ASO analysis tool",
  "5-26": "Apple Search Ads, ASA keywords, exact match promotion, CPT bid adjustment, search terms report, app store search ads",
  "5-28": "subscription survival analysis, churn analysis, Kaplan-Meier, hazard, censoring, RMST, subscription LTV, retention experiment",
  "1-1": "MMP SDK integration, technical PRD, deep link routing, mobile attribution QA",
  "1-2": "event taxonomy, in-app event spec, event naming convention, GA4 events, conversion parameters",
  "1-3": "postback integration, Adjust postback, SAN integration, S2S postback, network conversion delivery",
  "1-4": "iOS ATT, SKAdNetwork, SKAN 4.0, conversion value schema, ATT opt-in rate, iOS privacy",
  "2-1": "Google UAC, app campaign operations, UAC bidding, asset groups, Google app ads",
  "2-2": "Meta Advantage+ App, AAP optimization, Meta app ads, SKAN campaign, OS split operation",
  "2-3": "Apple Search Ads operations, ASA campaign structure, ASA keyword bidding, app store search ads",
  "2-4": "app retargeting, re-engagement, deferred deep link, dormant user reactivation",
  "3-1": "ASO, app store optimization, store metadata, store A/B testing, ASO keywords",
  "3-2": "ad creative specs, creative sizes, playable ads, video safe zone, network asset specs",
  "3-3": "3-second hook, video ad hook, first frame design, video drop-off, creative framework",
  "4-1": "app marketing KPI, CPI CPA definition, ARPU, ROAS benchmark, marketing benchmarks",
  "4-2": "cohort analysis, retention curve, D1 D7 D30 retention, cumulative ARPU, LTV projection",
  "4-3": "cannibalization, organic vs paid, ROAS overestimation, incrementality correction",
  "8-1": "CSV data prep, column mapping, data preprocessing, analysis data structure, no-code analytics",
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
