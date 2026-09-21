// Editorial SSOT for the analysis users should run after reading a post or
// glossary entry. This is deliberately explicit rather than keyword-based:
// every published topic has one reviewed conversion destination.
const BLOG_PRIMARY_TOOL = {
  "weekly-marketing-report-template": "5-21",
  "cac-payback-period": "5-2",
  "marketing-report-sheets-bigquery": "5-2",
  "ab-testing": "5-4",
  "ad-creative-specs-guide": "9-6",
  "ad-creative-testing": "9-6",
  "ad-machine-learning": "5-18-mmm",
  "ad-performance-diagnosis": "5-21",
  "aha-event-ad-optimization": "5-20",
  "aha-moment-retention": "5-20",
  "ai-era-marketer": "5-18-mmm",
  "apple-search-ads-guide": "5-26",
  "asa-keyword-expansion": "5-26",
  "aso-basics-guide": "5-27",
  "store-conversion-drop-diagnosis": "5-27",
  "store-listing-experiment": "5-27",
  "attribution-data-mismatch": "5-23",
  "audience-broad-vs-narrow": "5-4",
  "brand-campaign-lift": "5-24",
  "budget-marginal-efficiency": "5-3",
  "budget-scaling-limit": "5-22",
  "campaign-anomaly-detection": "5-21",
  "cannibalization-organic-paid": "5-18-cannibal",
  "cohort-analysis-guide": "5-2",
  "content-element-analysis": "9-1",
  "correlation-vs-causation": "5-23",
  "cpi-cpa-cpm-difference": "5-2",
  "creative-attribute-regression": "9-1",
  "event-taxonomy-guide": "5-2",
  "funnel-dropoff-analysis": "5-2",
  "ga4-data-traps": "5-18-trend",
  "google-uac-optimization": "9-6",
  "hook-3-seconds-framework": "9-6",
  "incrementality-measurement": "5-23",
  "ios-att-skan-guide": "5-2",
  "ltv-cac-ratio": "5-2",
  "marketing-mix-modeling": "5-18-mmm",
  "multicollinearity-mmm-guide": "5-25",
  "meta-advantage-plus-guide": "9-6",
  "offline-ad-online-impact": "5-24",
  "performance-marketer-skills": "5-2",
  "performance-marketing-metrics": "5-2",
  "performance-marketing-analysis-order": "5-2",
  "postback-integration-guide": "5-2",
  "retargeting-reengagement-guide": "5-22",
  "roas-improvement": "5-3",
  "uplift-holdout-guide": "5-23",
  "skan4-migration-guide": "5-2",
  "skan-conversion-value-schema": "5-2",
  "skan-vs-mmp-attribution": "5-23",
};

const GLOSSARY_PRIMARY_TOOL = {
  adstock: "5-18-mmm",
  arpu: "5-2",
  aso: "5-27",
  "custom-product-page": "5-27",
  "product-page-views": "5-27",
  att: "5-2",
  attribution: "5-23",
  "attribution-window": "5-23",
  cac: "5-2",
  cannibalization: "5-18-cannibal",
  "click-injection": "5-2",
  cohort: "5-2",
  "conversion-value": "5-2",
  cpa: "5-21",
  cpc: "9-6",
  cpi: "5-2",
  cpm: "9-6",
  "creative-fatigue": "9-6",
  "crowd-anonymity": "5-2",
  ctr: "9-6",
  cvr: "9-6",
  "deep-link": "5-2",
  "difference-in-differences": "5-23",
  ecpi: "5-2",
  frequency: "9-6",
  funnel: "5-2",
  "holdout-test": "5-23",
  "incremental-roas": "5-23",
  incrementality: "5-23",
  "learning-phase": "5-21",
  lookalike: "5-3",
  ltv: "5-2",
  "marginal-cpa": "5-22",
  mmm: "5-18-mmm",
  mmp: "5-2",
  multicollinearity: "5-25",
  "payback-period": "5-2",
  postback: "5-2",
  "probabilistic-attribution": "5-18-mmm",
  "response-curve": "5-22",
  retargeting: "5-23",
  retention: "5-2",
  roas: "5-3",
  skan: "5-2",
  "statistical-power": "5-4",
  uplift: "5-23",
  "view-through-conversion": "5-23",
};

// 5-18은 이제 매핑 허브와 네 개의 독립 분석 화면으로 분리된다. 콘텐츠의 질문에
// 맞는 화면으로 바로 보내고, CSV·매핑은 해당 브라우저 세션에서만 공유한다.
const BLOG_RELATED_GLOSSARY = {
  "weekly-marketing-report-template": ["cpi", "cpa"],
  "cac-payback-period": ["cac", "ltv"],
  "marketing-report-sheets-bigquery": ["cpi", "attribution-window"],
  "ab-testing": ["holdout-test", "uplift"],
  "ad-creative-specs-guide": ["ctr", "cpm"],
  "ad-creative-testing": ["cpa", "roas", "ctr", "cvr"],
  "ad-machine-learning": ["adstock", "response-curve"],
  "ad-performance-diagnosis": ["cpa", "ctr", "cvr", "cpm"],
  "aha-event-ad-optimization": ["retention", "cohort", "cpa"],
  "aha-moment-retention": ["retention", "cohort"],
  "ai-era-marketer": ["response-curve", "multicollinearity"],
  "apple-search-ads-guide": ["cpi", "cpa"],
  "asa-keyword-expansion": ["cpi", "cpa", "incrementality"],
  "aso-basics-guide": ["cvr", "deep-link", "funnel"],
  "store-conversion-drop-diagnosis": ["product-page-views", "cvr", "funnel"],
  "store-listing-experiment": ["custom-product-page", "product-page-views", "uplift"],
  "attribution-data-mismatch": ["mmp", "probabilistic-attribution"],
  "audience-broad-vs-narrow": ["cpm", "cvr"],
  "brand-campaign-lift": ["incrementality", "uplift", "holdout-test"],
  "budget-marginal-efficiency": ["marginal-cpa", "response-curve", "roas"],
  "budget-scaling-limit": ["marginal-cpa", "response-curve", "cpa"],
  "campaign-anomaly-detection": ["cpa", "roas"],
  "cannibalization-organic-paid": ["cannibalization", "incrementality"],
  "cohort-analysis-guide": ["cohort", "retention", "ltv"],
  "content-element-analysis": ["ctr", "cvr"],
  "correlation-vs-causation": ["multicollinearity", "incrementality"],
  "cpi-cpa-cpm-difference": ["cpm", "cpc", "ctr"],
  "creative-attribute-regression": ["ctr", "cvr", "cpm"],
  "event-taxonomy-guide": ["funnel", "cohort"],
  "funnel-dropoff-analysis": ["funnel", "cvr"],
  "ga4-data-traps": ["probabilistic-attribution", "mmp"],
  "google-uac-optimization": ["cpi", "roas"],
  "hook-3-seconds-framework": ["ctr", "cvr"],
  "incrementality-measurement": ["incrementality", "holdout-test", "uplift"],
  "ios-att-skan-guide": ["probabilistic-attribution", "mmp"],
  "ltv-cac-ratio": ["ltv", "cac", "roas"],
  "marketing-mix-modeling": ["adstock", "multicollinearity", "response-curve"],
  "multicollinearity-mmm-guide": ["multicollinearity", "incrementality"],
  "meta-advantage-plus-guide": ["cpm", "cvr"],
  "offline-ad-online-impact": ["incrementality", "uplift"],
  "performance-marketer-skills": ["cpa", "roas"],
  "performance-marketing-metrics": ["cpa", "cpi", "roas"],
  "performance-marketing-analysis-order": ["cpa", "incrementality", "multicollinearity", "response-curve"],
  "postback-integration-guide": ["mmp", "deep-link"],
  "retargeting-reengagement-guide": ["cpm", "cvr"],
  "roas-improvement": ["roas", "marginal-cpa", "response-curve"],
  "uplift-holdout-guide": ["uplift", "holdout-test", "incrementality"],
  "skan4-migration-guide": ["skan", "conversion-value", "crowd-anonymity"],
  "skan-conversion-value-schema": ["conversion-value", "skan", "crowd-anonymity"],
  "skan-vs-mmp-attribution": ["skan", "mmp", "attribution-window"],
};

export function primaryToolForContent(slug, type = "blog") {
  const registry = type === "glossary" ? GLOSSARY_PRIMARY_TOOL : BLOG_PRIMARY_TOOL;
  return registry[slug] || "5-2";
}

export function relatedGlossaryForPost(slug) {
  return BLOG_RELATED_GLOSSARY[slug] || [];
}

export const PUBLISHED_BLOG_TOOL_MAP = BLOG_PRIMARY_TOOL;
export const PUBLISHED_GLOSSARY_TOOL_MAP = GLOSSARY_PRIMARY_TOOL;
export const PUBLISHED_BLOG_GLOSSARY_MAP = BLOG_RELATED_GLOSSARY;

/* ============================================================
 * 계산기 목적지 — 도구(CSV 업로드)보다 앞에 세울 곳만 등록한다.
 *
 * 왜 따로 두나: `*_PRIMARY_TOOL`이 가리키는 분석 도구는 전부 CSV를 요구한다.
 * "CAC 뜻"으로 들어온 검색 방문자는 파일이 없으므로, 그 사람에게 운영 대시보드를
 * 1차 CTA로 주면 실제로는 아무 데도 못 간다. 숫자 몇 개로 답이 나오는 계산기가
 * 있으면 그쪽이 1차고, 도구는 2차로 남긴다(§12.31 — 길을 막지는 않는다).
 *
 * 등록 기준은 두 갈래를 **둘 다** 만족할 때만이다.
 *   ① 용어가 그 계산기의 입력 또는 출력으로 이름이 붙어 있다(`inputs`·`*Label`).
 *   ② 계산기가 답하는 질문이 그 용어를 찾아온 사람의 질문이다.
 * ②가 없으면 기계적으로는 통과하는 오배치가 생긴다 — `required-cvr`은 CPM을
 * 입력으로 받지만 "CPM 뜻"을 찾아온 사람의 질문은 필요 전환율이 아니다.
 * 주제가 겹치는 정도로 넣으면 읽은 내용과 다른 화면이 열린다.
 *
 * 비어 있는 표면(blog)은 폴백 없이 null이다 — 폴백을 두면 무엇이 폴백으로
 * 떨어졌는지 화면에서도 테스트에서도 안 보인다.
 * 슬러그 실재와 KO/EN 카피는 `contentActionPanel.test.js`가 CALCULATOR_ORDER에서
 * 파생 검사한다.
 * ============================================================ */
const GLOSSARY_PRIMARY_CALCULATOR = {
  // LTV·CAC는 입력, 페이백은 출력 — 세 용어가 같은 한 화면에서 답을 받는다.
  cac: "ltv-cac",
  ltv: "ltv-cac",
  "payback-period": "ltv-cac",
  // CPA는 입력이자 "목표 ROAS 달성 CPA" 출력, ROAS는 "현재 ROAS" 출력.
  cpa: "cpa-roas-converter",
  roas: "cpa-roas-converter",
  // "필요 CVR"이 출력. 전환율을 찾아온 사람의 질문이 곧 이 계산기의 질문이다.
  cvr: "required-cvr",
  // 검정력은 `powerPct` 입력 — 표본이 작으면 있는 효과도 못 잡는다는 정의를
  // 숫자로 확인하는 자리가 표본수 계산기다.
  "statistical-power": "ab-test-sample-size",
  // CPI는 `expectedCpi` 입력. "이 CPI면 이 예산으로 설치 몇 개"가 CPI를
  // 찾아온 사람이 실제로 다음에 묻는 것이다.
  cpi: "expected-installs",
};

const BLOG_PRIMARY_CALCULATOR = {};

export const PRIMARY_CALCULATOR_MAPS = {
  glossary: GLOSSARY_PRIMARY_CALCULATOR,
  blog: BLOG_PRIMARY_CALCULATOR,
};

export function primaryCalculatorForContent(slug, type = "blog") {
  const registry = type === "glossary" ? GLOSSARY_PRIMARY_CALCULATOR : BLOG_PRIMARY_CALCULATOR;
  return registry[slug] || null;
}
