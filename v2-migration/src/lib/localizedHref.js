import { hasEnVersion, resolvePathToId } from "@/lib/routeMap";

// Client/server-safe publication registry. Content loaders, Header language
// switching and Markdown link localization all use this list so an EN prefix is
// never added to a route that does not exist.
export const EN_BLOG_SLUGS = new Set([
  "ab-testing",
  "ad-creative-specs-guide",
  "ad-creative-testing",
  "ad-machine-learning",
  "ad-performance-diagnosis",
  "aha-event-ad-optimization",
  "aha-moment-retention",
  "ai-era-marketer",
  "apple-search-ads-guide",
  "aso-basics-guide",
  "attribution-data-mismatch",
  "audience-broad-vs-narrow",
  "budget-marginal-efficiency",
  "campaign-anomaly-detection",
  "cannibalization-organic-paid",
  "cohort-analysis-guide",
  "correlation-vs-causation",
  "cpi-cpa-cpm-difference",
  "event-taxonomy-guide",
  "funnel-dropoff-analysis",
  "ga4-data-traps",
  "google-uac-optimization",
  "hook-3-seconds-framework",
  "incrementality-measurement",
  "ios-att-skan-guide",
  "ltv-cac-ratio",
  "marketing-mix-modeling",
  "meta-advantage-plus-guide",
  "multicollinearity-mmm-guide",
  "performance-marketer-skills",
  "performance-marketing-analysis-order",
  "performance-marketing-metrics",
  "postback-integration-guide",
  "retargeting-reengagement-guide",
  "roas-improvement",
  "uplift-holdout-guide",
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
  if (href === "/blog" || href === "/glossary" || href === "/templates" || href === "/diagnose" || href === "/weekly-review" || href === "/weekly-report" || href === "/growth-funnel" || href === "/calculator" || href.startsWith("/calculator/")) return `/en${href}`;
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
  if (cleanPath === "/templates" || cleanPath === "/diagnose" || cleanPath === "/weekly-review" || cleanPath === "/weekly-report" || cleanPath === "/growth-funnel" || cleanPath === "/calculator" || cleanPath.startsWith("/calculator/")) return `/en${cleanPath}`;
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
