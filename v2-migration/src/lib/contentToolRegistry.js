// Editorial SSOT for the analysis users should run after reading a post or
// glossary entry. This is deliberately explicit rather than keyword-based:
// every published topic has one reviewed conversion destination.
const BLOG_PRIMARY_TOOL = {
  "ab-testing": "5-4",
  "ad-creative-specs-guide": "9-6",
  "ad-machine-learning": "5-18",
  "ad-performance-diagnosis": "5-21",
  "aha-moment-retention": "5-20",
  "ai-era-marketer": "5-18",
  "apple-search-ads-guide": "5-2",
  "aso-basics-guide": "9-6",
  "attribution-data-mismatch": "5-23",
  "audience-broad-vs-narrow": "5-4",
  "budget-marginal-efficiency": "5-3",
  "campaign-anomaly-detection": "5-21",
  "cannibalization-organic-paid": "5-18",
  "cohort-analysis-guide": "5-2",
  "correlation-vs-causation": "5-23",
  "cpi-cpa-cpm-difference": "5-2",
  "event-taxonomy-guide": "5-2",
  "funnel-dropoff-analysis": "5-2",
  "ga4-data-traps": "5-18",
  "google-uac-optimization": "9-6",
  "hook-3-seconds-framework": "9-6",
  "incrementality-measurement": "5-23",
  "ios-att-skan-guide": "5-2",
  "ltv-cac-ratio": "5-2",
  "marketing-mix-modeling": "5-18",
  "meta-advantage-plus-guide": "9-6",
  "performance-marketer-skills": "5-2",
  "performance-marketing-metrics": "5-2",
  "postback-integration-guide": "5-2",
  "retargeting-reengagement-guide": "5-22",
};

const GLOSSARY_PRIMARY_TOOL = {
  adstock: "5-18",
  cac: "5-2",
  cannibalization: "5-18",
  "click-injection": "5-2",
  cohort: "5-2",
  cpa: "5-21",
  cpc: "9-6",
  cpi: "5-2",
  cpm: "9-6",
  ctr: "9-6",
  cvr: "9-6",
  "deep-link": "5-2",
  ecpi: "5-2",
  funnel: "5-2",
  "holdout-test": "5-23",
  incrementality: "5-23",
  ltv: "5-2",
  "marginal-cpa": "5-22",
  mmp: "5-2",
  multicollinearity: "5-18",
  "probabilistic-attribution": "5-18",
  "response-curve": "5-22",
  retention: "5-2",
  roas: "5-3",
  uplift: "5-23",
};

const BLOG_RELATED_GLOSSARY = {
  "ab-testing": ["holdout-test", "uplift"],
  "ad-creative-specs-guide": ["ctr", "cpm"],
  "ad-machine-learning": ["adstock", "response-curve"],
  "ad-performance-diagnosis": ["cpa", "ctr", "cvr", "cpm"],
  "aha-moment-retention": ["retention", "cohort"],
  "ai-era-marketer": ["response-curve", "multicollinearity"],
  "apple-search-ads-guide": ["cpi", "cpa"],
  "aso-basics-guide": ["cvr", "deep-link"],
  "attribution-data-mismatch": ["mmp", "probabilistic-attribution"],
  "audience-broad-vs-narrow": ["cpm", "cvr"],
  "budget-marginal-efficiency": ["marginal-cpa", "response-curve", "roas"],
  "campaign-anomaly-detection": ["cpa", "roas"],
  "cannibalization-organic-paid": ["cannibalization", "incrementality"],
  "cohort-analysis-guide": ["cohort", "retention", "ltv"],
  "correlation-vs-causation": ["multicollinearity", "incrementality"],
  "cpi-cpa-cpm-difference": ["cpi", "cpa", "cpm"],
  "event-taxonomy-guide": ["funnel", "cohort"],
  "funnel-dropoff-analysis": ["funnel", "cvr"],
  "ga4-data-traps": ["probabilistic-attribution", "mmp"],
  "google-uac-optimization": ["cpi", "roas"],
  "hook-3-seconds-framework": ["ctr", "cvr"],
  "incrementality-measurement": ["incrementality", "holdout-test", "uplift"],
  "ios-att-skan-guide": ["probabilistic-attribution", "mmp"],
  "ltv-cac-ratio": ["ltv", "cac", "roas"],
  "marketing-mix-modeling": ["adstock", "multicollinearity", "response-curve"],
  "meta-advantage-plus-guide": ["cpm", "cvr"],
  "performance-marketer-skills": ["cpa", "roas"],
  "performance-marketing-metrics": ["cpa", "cpi", "roas"],
  "postback-integration-guide": ["mmp", "deep-link"],
  "retargeting-reengagement-guide": ["cpm", "cvr"],
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
