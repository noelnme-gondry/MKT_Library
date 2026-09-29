import { idToSlug, hasEnVersion, publishedToolIds } from "@/lib/routeMap";

// 예시 결과를 "링크로" 여는 계약(2026-09-29). 예전엔 예시가 버튼(상태)으로만 열려서 블로그·템플릿·
// 외부 공유·AI 답변에 넣을 주소가 없었다(Plausible "View live demo"처럼 주소 하나로 결과가 열려야 한다).
// 도구 URL에 ?example=1을 붙이면 그 도구의 예시 버튼과 **같은 핸들러**가 한 번 돈다(useExampleLink).
// canonical·sitemap은 파라미터 없는 도구 URL 그대로다 — 같은 페이지의 다른 상태일 뿐이다.
export const EXAMPLE_PARAM = "example";

/** 도구의 예시 결과 링크. 발행 도구가 아니면 null(e2e/example-link.spec.js가 발행 도구 전체를 연다). EN은 EN 경로가 있는 도구만. */
export function exampleHref(toolId, locale = "ko") {
  const slug = idToSlug[toolId];
  if (!slug || !publishedToolIds().includes(toolId)) return null;
  if (locale === "en" && !hasEnVersion(toolId)) return null;
  return `${locale === "en" ? "/en" : ""}${slug}?${EXAMPLE_PARAM}=1`;
}

/** 현재 주소가 예시 링크인가. */
export function isExampleUrl(search) {
  return new URLSearchParams(search || "").get(EXAMPLE_PARAM) === "1";
}

/** 한 번 쓴 파라미터를 지운 주소(새로고침·공유 때 예시가 다시 덮어쓰지 않게). */
export function stripExampleParam(href) {
  const url = new URL(href);
  url.searchParams.delete(EXAMPLE_PARAM);
  return `${url.pathname}${url.search}${url.hash}`;
}
