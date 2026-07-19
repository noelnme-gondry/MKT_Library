import { hasEnVersion, resolvePathToId } from "@/lib/routeMap";

// Client/server-safe publication registry. Content loaders, Header language
// switching and Markdown link localization all use this list so an EN prefix is
// never added to a route that does not exist.
export const EN_BLOG_SLUGS = new Set([
  "ab-testing",
  "ad-machine-learning",
  "ad-performance-drop",
  "ai-era-marketer",
  "attribution-data-mismatch",
  "audience-broad-vs-narrow",
  "correlation-vs-causation",
  "cpa-reduction",
  "creative-fatigue",
  "ga4-data-traps",
  "incrementality-measurement",
  "junior-metrics-guide",
  "marketing-budget-allocation",
  "marketing-mix-modeling",
  "performance-marketer-skills",
  "performance-marketing-metrics",
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
