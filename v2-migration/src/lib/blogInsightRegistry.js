// Put the example after the first explanatory section, before readers must finish the article.
// Both locales keep every existing article block and the same entry contract.
// Every published article must have an entry or an explicit non-CSV reason.
const entry = (toolId, type = "adapter") => ({ section: 1, toolId, type });
export const BLOG_INSIGHT_PLACEMENTS = {
  "simpson-paradox-conversion-rate": entry("5-29", "ratio"),
  "user-churn-survival-analysis": entry("5-28", "distribution"),
  "weekly-marketing-report-template": entry("5-21"),
  "cac-payback-period": entry("5-2"),
  "marketing-report-sheets-bigquery": entry("5-2"),
  "ab-testing": entry("5-4", "comparison"),
  "ad-creative-testing": entry("9-6"),
  "ad-machine-learning": entry("5-21"),
  "ad-performance-diagnosis": entry("5-21"),
  "aha-event-ad-optimization": entry("5-20", "distribution"),
  "aha-moment-retention": entry("5-20", "distribution"),
  "apple-search-ads-guide": entry("5-26"),
  "asa-keyword-expansion": entry("5-26"),
  "aso-basics-guide": entry("5-27"),
  "audience-broad-vs-narrow": entry("5-4", "comparison"),
  "brand-campaign-lift": entry("5-24", "trend"),
  "budget-marginal-efficiency": entry("5-3"),
  "budget-scaling-limit": entry("5-22"),
  "campaign-anomaly-detection": entry("5-21"),
  "cannibalization-organic-paid": entry("5-18-paid-organic"),
  "cohort-analysis-guide": entry("5-2", "distribution"),
  "content-element-analysis": entry("9-1", "comparison"),
  "correlation-vs-causation": entry("5-23", "comparison"),
  "cpi-cpa-cpm-difference": entry("5-2", "ratio"),
  "creative-attribute-regression": entry("9-1", "comparison"),
  "funnel-dropoff-analysis": entry("5-2", "funnel"),
  "google-uac-optimization": entry("9-6"),
  "hook-3-seconds-framework": entry("9-6", "ratio"),
  "incrementality-measurement": entry("5-23", "comparison"),
  "ltv-cac-ratio": entry("5-2", "ratio"),
  "marketing-mix-modeling": entry("5-18-mmm", "trend"),
  "meta-advantage-plus-guide": entry("9-6", "comparison"),
  "multicollinearity-mmm-guide": entry("5-25"),
  "offline-ad-online-impact": entry("5-24", "trend"),
  "performance-marketer-skills": entry("5-2", "comparison"),
  "performance-marketing-analysis-order": entry("5-2"),
  "performance-marketing-metrics": entry("5-2", "ratio"),
  "retargeting-reengagement-guide": entry("5-22", "comparison"),
  "roas-improvement": entry("5-3"),
  "store-conversion-drop-diagnosis": entry("5-27"),
  "store-listing-experiment": entry("5-4", "comparison"),
  "uplift-holdout-guide": entry("5-23", "comparison"),
};
export const BLOG_INSIGHT_EXCLUSIONS = {
  "ad-creative-specs-guide": "Media dimensions and safe areas require inspecting creative assets, not a performance CSV.",
  "ai-era-marketer": "Career and responsibility guidance; no defined CSV calculation in the article.",
  "attribution-data-mismatch": "Attribution windows and event definitions must be reconciled before counts can be compared.",
  "event-taxonomy-guide": "Tracking implementation and event naming require an instrumentation audit.",
  "ga4-data-traps": "Sampling, thresholds and attribution settings cannot be established from exported rows alone.",
  "ios-att-skan-guide": "Privacy and attribution configuration cannot be diagnosed from aggregate campaign rows.",
  "postback-integration-guide": "Delivery failures need SDK/postback configuration or logs, not aggregate CSV metrics.",
  "skan-conversion-value-schema": "Conversion-value schema design requires an explicit event-to-value specification.",
  "skan-vs-mmp-attribution": "The compared systems use different units and windows; CSV ratios are not attribution reconciliation.",
  "skan4-migration-guide": "Migration instructions concern postback windows and configuration rather than CSV analysis.",
};
export function splitBlogInsight(html, slug) {
  const config = BLOG_INSIGHT_PLACEMENTS[slug];
  if (!config) return null;
  const headings = [...html.matchAll(/<h2\b[^>]*>/g)];
  const next = headings[config.section];
  if (!headings[config.section - 1]) return null;
  const boundary = next?.index ?? html.length;
  return { before: html.slice(0, boundary).replaceAll("<!-- CONTENT_ACTION -->", ""), after: html.slice(boundary).replaceAll("<!-- CONTENT_ACTION -->", ""), config };
}
