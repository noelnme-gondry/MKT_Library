export const OPEN_GRAPH_SITE_NAME = "Growth Opt Playbook";

export function openGraphBase(locale = "ko") {
  return {
    siteName: OPEN_GRAPH_SITE_NAME,
    locale: locale === "en" ? "en_US" : "ko_KR",
  };
}

// Next.js replaces the entire openGraph object when a child route declares it.
// Route metadata must therefore opt into the shared brand and locale fields.
export function withOpenGraphBase(openGraph = {}, locale = "ko") {
  return { ...openGraphBase(locale), ...openGraph };
}
