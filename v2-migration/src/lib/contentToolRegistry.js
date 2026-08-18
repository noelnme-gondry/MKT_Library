// Editorial SSOT for the analysis users should run after reading a post or
// glossary entry. This is deliberately explicit rather than keyword-based:
// every published topic has one reviewed conversion destination.
const BLOG_PRIMARY_TOOL = {
  "ab-testing": "5-4",
  "ad-creative-specs-guide": "9-6",
  "ad-creative-testing": "9-6",
  "ad-machine-learning": "5-18",
  "ad-performance-diagnosis": "5-21",
  "aha-event-ad-optimization": "5-20",
  "aha-moment-retention": "5-20",
  "ai-era-marketer": "5-18",
  "apple-search-ads-guide": "5-26",
  "asa-keyword-expansion": "5-26",
  "aso-basics-guide": "5-27",
  "attribution-data-mismatch": "5-23",
  "audience-broad-vs-narrow": "5-4",
  "brand-campaign-lift": "5-24",
  "budget-marginal-efficiency": "5-3",
  "budget-scaling-limit": "5-22",
  "campaign-anomaly-detection": "5-21",
  "cannibalization-organic-paid": "5-18",
  "cohort-analysis-guide": "5-2",
  "content-element-analysis": "9-1",
  "correlation-vs-causation": "5-23",
  "cpi-cpa-cpm-difference": "5-2",
  "creative-attribute-regression": "9-1",
  "event-taxonomy-guide": "5-2",
  "funnel-dropoff-analysis": "5-2",
  "ga4-data-traps": "5-18",
  "google-uac-optimization": "9-6",
  "hook-3-seconds-framework": "9-6",
  "incrementality-measurement": "5-23",
  "ios-att-skan-guide": "5-2",
  "ltv-cac-ratio": "5-2",
  "marketing-mix-modeling": "5-18",
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
  adstock: "5-18",
  arpu: "5-2",
  aso: "5-27",
  att: "5-2",
  attribution: "5-23",
  "attribution-window": "5-23",
  cac: "5-2",
  cannibalization: "5-18",
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
  mmm: "5-18",
  mmp: "5-2",
  multicollinearity: "5-25",
  "payback-period": "5-2",
  postback: "5-2",
  "probabilistic-attribution": "5-18",
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
const BLOG_RESPONSE_STAGE = {
  "ad-machine-learning": "mmm",
  "ai-era-marketer": "mmm",
  "cannibalization-organic-paid": "diagnose",
  "ga4-data-traps": "trend",
  "marketing-mix-modeling": "mmm",
};

const GLOSSARY_RESPONSE_STAGE = {
  adstock: "mmm",
  cannibalization: "diagnose",
  multicollinearity: "mmm",
  "probabilistic-attribution": "mmm",
};

const BLOG_RELATED_GLOSSARY = {
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

export function primaryResponseStageForContent(slug, type = "blog") {
  const registry = type === "glossary" ? GLOSSARY_RESPONSE_STAGE : BLOG_RESPONSE_STAGE;
  return registry[slug] || null;
}

export function relatedGlossaryForPost(slug) {
  return BLOG_RELATED_GLOSSARY[slug] || [];
}

export const PUBLISHED_BLOG_TOOL_MAP = BLOG_PRIMARY_TOOL;
export const PUBLISHED_GLOSSARY_TOOL_MAP = GLOSSARY_PRIMARY_TOOL;
export const PUBLISHED_BLOG_GLOSSARY_MAP = BLOG_RELATED_GLOSSARY;
