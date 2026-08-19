import { BRAND } from "@/lib/brandFacts";

// 제품명은 `docs/product-ssot.md` §1.1 → `brandFacts.BRAND`가 정본이다. 여기 리터럴로
// 다시 적으면 SSOT를 고쳐도 OG만 옛 이름으로 남는다(실제로 갈라져 있었다).
export const OPEN_GRAPH_SITE_NAME = BRAND.name;

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
