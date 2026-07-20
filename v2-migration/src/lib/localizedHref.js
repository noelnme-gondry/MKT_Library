import { hasEnVersion, resolvePathToId } from "@/lib/routeMap";

// Client/server-safe publication registry. Content loaders, Header language
// switching and Markdown link localization all use this list so an EN prefix is
// never added to a route that does not exist.
export const EN_BLOG_SLUGS = new Set([
  "ab-testing",
  "ad-creative-specs-guide",
  "ad-machine-learning",
  "ad-performance-drop",
  "aha-moment-retention",
  "ai-era-marketer",
  "apple-search-ads-guide",
  "aso-basics-guide",
  "attribution-data-mismatch",
  "audience-broad-vs-narrow",
  "campaign-anomaly-detection",
  "campaign-saturation-signals",
  "cannibalization-organic-paid",
  "cohort-analysis-guide",
  "correlation-vs-causation",
  "cpa-reduction",
  "cpi-cpa-cpm-difference",
  "creative-fatigue",
  "ctr-improvement",
  "cvr-optimization",
  "event-taxonomy-guide",
  "funnel-dropoff-analysis",
  "ga4-data-traps",
  "google-uac-optimization",
  "hook-3-seconds-framework",
  "incrementality-measurement",
  "ios-att-skan-guide",
  "junior-metrics-guide",
  "ltv-cac-ratio",
  "marketing-budget-allocation",
  "marketing-mix-modeling",
  "meta-advantage-plus-guide",
  "performance-marketer-skills",
  "performance-marketing-metrics",
  "postback-integration-guide",
  "retargeting-reengagement-guide",
  "roas-improvement",
  "scaling-pitfalls",
]);

export const EN_GLOSSARY_SLUGS = new Set([
  "adstock", "cac", "cannibalization", "click-injection", "cohort",
  "cpa", "cpc", "cpi", "cpm", "ctr", "cvr", "deep-link", "ecpi",
  "funnel", "holdout-test", "incrementality", "ltv", "marginal-cpa",
  "mmp", "multicollinearity", "probabilistic-attribution", "response-curve",
  "retention", "roas", "uplift",
]);

export function localizedHref(href, locale = "ko") {
  if (locale !== "en" || !href || !href.startsWith("/") || href.startsWith("/en/")) return href;
  if (href === "/blog" || href === "/glossary") return `/en${href}`;
  if (href.startsWith("/blog/")) {
    const slug = href.slice("/blog/".length).split(/[?#]/)[0];
    return EN_BLOG_SLUGS.has(slug) ? `/en${href}` : href;
  }
  if (href.startsWith("/glossary/")) {
    const slug = href.slice("/glossary/".length).split(/[?#]/)[0];
    return EN_GLOSSARY_SLUGS.has(slug) ? `/en${href}` : href;
  }
  const routeId = resolvePathToId(href);
  return routeId && hasEnVersion(routeId) ? `/en${href}` : href;
}

export function englishSwitchHref(pathname) {
  const cleanPath = (pathname || "/").replace(/^\/en(?=\/|$)/, "") || "/";
  if (cleanPath === "/blog") return "/en/blog";
  if (cleanPath.startsWith("/blog/tag/")) return "/en/blog";
  if (cleanPath.startsWith("/blog/")) {
    const slug = cleanPath.slice("/blog/".length);
    return EN_BLOG_SLUGS.has(slug) ? `/en${cleanPath}` : "/en/blog";
  }
  if (cleanPath === "/glossary") return "/en/glossary";
  if (cleanPath.startsWith("/glossary/")) {
    const slug = cleanPath.slice("/glossary/".length);
    return EN_GLOSSARY_SLUGS.has(slug) ? `/en${cleanPath}` : "/en/glossary";
  }
  const routeId = resolvePathToId(cleanPath);
  return routeId && hasEnVersion(routeId)
    ? `/en${cleanPath === "/" ? "" : cleanPath}`
    : "/en";
}
