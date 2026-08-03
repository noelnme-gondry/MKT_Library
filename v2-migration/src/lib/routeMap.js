// SSOT for slug <-> internal route id mapping.
// Plain module (NO "use client") so both client components and the server
// sitemap.js can import it.
//
// Internal route ids (5-2, 5-3, ...) are IMMUTABLE (§4.1). This layer maps
// human-readable URL slugs to those ids bidirectionally without renaming ids.
//
// Legacy tool ids 5-7 & 5-15 are redirect-only aliases of the experiment tool
// (primary id 5-4). They share 5-4's slug and are NOT emitted in the sitemap.

export const SITE_URL = "https://growthoptplaybook.com";

// component tag is documentation-only (the actual dispatch lives in the page).
export const ROUTES = [
  { id: "home", slug: "/", component: "LandingPage" },
  { id: "5-2", slug: "/dashboard", component: "Dashboard" },
  { id: "5-3", slug: "/tools/budget-allocation", component: "BudgetAllocation" },
  { id: "5-21", slug: "/tools/campaign-variance", component: "CampaignPvm" },
  { id: "5-22", slug: "/tools/campaign-saturation", component: "MarketingEfficiency" },
  // 5-6(소재 분석)은 9-6으로 통합됨(중복 제거). /tools/creative-analysis는
  // next.config.mjs redirects()로 /content/freshness(9-6)로 301 리다이렉트.
  { id: "5-4", slug: "/tools/experiment-analysis", component: "AbTestHoldout" },
  { id: "5-18", slug: "/tools/marketing-response", component: "MarketingResponse" },
  // 5-18의 CSV·매핑 허브 아래 독립 분석 화면. 원본은 response 그룹의 브라우저
  // 메모리에서만 공유하고, 각 화면은 다른 분석을 렌더·실행하지 않는다.
  { id: "5-18-trend", slug: "/tools/marketing-trend", component: "MarketingResponseTrend", publication: "subtool" },
  { id: "5-18-cannibal", slug: "/tools/cannibalization-diagnosis", component: "MarketingResponseCannibal", publication: "subtool" },
  { id: "5-18-mmm", slug: "/tools/mmm-contribution", component: "MarketingResponseMmm", publication: "subtool" },
  { id: "5-18-forecast", slug: "/tools/marketing-forecast", component: "MarketingResponseForecast", publication: "subtool" },
  { id: "5-20", slug: "/tools/aha-moment", component: "AhaMomentFinder" },
  { id: "5-23", slug: "/tools/incrementality", component: "Incrementality" },
  // ── Content Analytics (콘텐츠 도메인 — 엔진 재사용) ──
  { id: "9-1", slug: "/content/element-analysis", component: "ContentElementAnalyzer" },
  { id: "9-2", slug: "/content/killer-content", component: "KillerContentFinder", publication: "preview" },
  { id: "9-3", slug: "/content/traffic-variance", component: "ContentTrafficVariance", publication: "preview" },
  // 9-6 = 소재 분석(구 5-6 통합, CreativeAnalyzer domain=performance). slug은 콘텐츠
  // 라우팅 계열 유지(§4.1 id 불변). /tools/creative-analysis는 여기로 redirect.
  { id: "9-6", slug: "/content/freshness", component: "CreativeAnalyzer" },
  { id: "9-7", slug: "/content/dashboard", component: "ContentDashboard", publication: "preview" },
  { id: "1-1", slug: "/guide/dev-collaboration", component: "SopContent" },
  { id: "1-2", slug: "/guide/event-taxonomy", component: "SopContent" },
  { id: "1-3", slug: "/guide/postback-integration", component: "SopContent" },
  { id: "1-4", slug: "/guide/ios-privacy-att-skan", component: "SopContent" },
  { id: "2-1", slug: "/guide/google-uac", component: "SopContent" },
  { id: "2-2", slug: "/guide/meta-advantage-plus", component: "SopContent" },
  { id: "2-3", slug: "/guide/apple-search-ads", component: "SopContent" },
  { id: "2-4", slug: "/guide/retargeting-reengagement", component: "SopContent" },
  { id: "3-1", slug: "/guide/aso-basics", component: "SopContent" },
  { id: "3-2", slug: "/guide/creative-specs", component: "SopContent" },
  { id: "3-3", slug: "/guide/hook-framework", component: "SopContent" },
  { id: "4-1", slug: "/guide/kpi-analysis", component: "SopContent" },
  { id: "4-2", slug: "/guide/cohort-retention", component: "SopContent" },
  { id: "4-3", slug: "/guide/cannibalization-analysis", component: "SopContent" },
  { id: "8-1", slug: "/guide/csv-data-prep", component: "SopContent" },
  // 가이드 인덱스(블로그처럼 목록 페이지 — 자체 주소 `/guide`). 개별 가이드
  // `/guide/*`와 다른 정확 slug라 충돌 없음(slugToId 키 "guide" vs "guide/xxx").
  { id: "guide-index", slug: "/guide", component: "GuideIndex" },
  // "내 데이터로 분석 시작" 게이트(데모 없이 도구 선택). 자체 주소 `/start`.
  { id: "start-gate", slug: "/start", component: "StartGate" },
  // ── Legacy id aliases (redirect-only; share 5-4's slug; excluded from sitemap) ──
  { id: "5-7", slug: "/tools/experiment-analysis", component: "AbTestHoldout", legacy: true },
  { id: "5-15", slug: "/tools/experiment-analysis", component: "AbTestHoldout", legacy: true },
];

// id -> slug (used by nav <Link> + router.push). Legacy ids resolve to the
// shared slug, which is fine for forward navigation.
export const idToSlug = Object.fromEntries(ROUTES.map((r) => [r.id, r.slug]));

// slug path (no leading slash) -> id. Built from PRIMARY entries only so a
// slug always resolves back to its canonical/primary id (5-4, never 5-7/5-15).
// "" (root) -> "home", "dashboard" -> "5-2", "tools/budget-allocation" -> "5-3".
export const slugToId = Object.fromEntries(
  ROUTES.filter((r) => !r.legacy).map((r) => [
    r.slug === "/" ? "" : r.slug.replace(/^\//, ""),
    r.id,
  ])
);

// slugArr (from optional catch-all params.slug) -> id, or null for unknown URLs.
export function resolveSlugToId(slugArr) {
  const key = (slugArr || []).join("/");
  return slugToId[key] ?? null;
}

// pathname (from usePathname(), e.g. "/en/tools/budget-allocation") -> id, or
// null. Strips a leading "en" segment first — Header/Sidebar derive their
// active-route id straight from the URL (not the store) and were resolving
// "en/dashboard" as a whole, which never matches any KR slug and silently
// fell back to "home" (breadcrumb collapsed to generic "Overview", sidebar
// active-highlight broken) on every /en/* page. Use this instead of manual
// split+resolveSlugToId in any component that reads usePathname() directly.
export function resolvePathToId(pathname) {
  const segs = (pathname || "/").split("/").filter(Boolean);
  if (segs[0] === "en") segs.shift();
  return resolveSlugToId(segs);
}

// id -> path string (falls back to home).
export function idToPath(id) {
  return idToSlug[id] || "/";
}

export function isRoutePublished(routeOrId) {
  const route = typeof routeOrId === "string" ? ROUTES.find((item) => item.id === routeOrId && !item.legacy) : routeOrId;
  return Boolean(route && !route.legacy && route.publication !== "preview" && route.publication !== "subtool");
}

// 검색 색인 가능 여부는 전역 내비게이션 노출 여부와 별도다. response subtool은
// 사이드바·템플릿 목록에서는 숨기지만 sitemap과 canonical을 가진 독립 검색 랜딩이다.
// 이 둘을 isRoutePublished 하나로 판정하면 sitemap에는 있으면서 meta robots는
// noindex가 되는 모순이 생긴다.
export function isRouteIndexable(routeOrId) {
  const route = typeof routeOrId === "string" ? ROUTES.find((item) => item.id === routeOrId && !item.legacy) : routeOrId;
  return Boolean(route && !route.legacy && route.publication !== "preview");
}

// ── EN i18n rollout registry ──────────────────────────────────────────────
// Tool ids with a fully-translated EN page (component honors locale="en").
// Add an id here ONLY after its component + shared shell strings are done —
// this gates /en/[[...slug]] dispatch, hreflang emission, and sitemap EN URLs
// so untranslated tools never get a thin/half-Korean page indexed.
export const EN_READY_TOOL_IDS = new Set([
  // 5-6(소재 분석)은 9-6으로 통합 — EN 지원도 9-6으로 이관.
  "5-2", "5-3", "5-4", "9-6", "9-1", "5-18", "5-20", "5-21", "5-22", "5-23",
]);

// 5-18의 하위 분석은 독립 URL이지만 전역 도구 목록·사이드바에는 노출하지
// 않는다. EN은 같은 컴포넌트의 locale 분기를 사용하므로 이 별도 게이트로 허용한다.
export const EN_READY_RESPONSE_SUBTOOL_IDS = new Set(["5-18-trend", "5-18-cannibal", "5-18-mmm", "5-18-forecast"]);

// EN 번역 완료된 SOP 가이드({id}.en.json 존재 + SopContent DATA_BASED_PAGES 등록).
// 1-1·8-1은 리터럴 라우트(/en/guide/dev-collaboration 등)가 우선 서빙하지만, 사이드바·
// GuideIndex의 EN 링크 게이트(hasEnVersion)를 위해 여기에도 포함.
export const EN_READY_GUIDE_IDS = new Set([
  "1-1", "1-2", "1-3", "1-4",
  "2-1", "2-2", "2-3", "2-4",
  "3-1", "3-2", "3-3",
  "4-1", "4-2", "4-3",
  "8-1",
]);

export function hasEnVersion(id) {
  // guide-index·start-gate는 UI 셸(라벨만 번역) — EN 지원. 개별 가이드는 EN_READY_GUIDE_IDS로 게이트.
  return id === "home" || id === "guide-index" || id === "start-gate" || EN_READY_TOOL_IDS.has(id) || EN_READY_RESPONSE_SUBTOOL_IDS.has(id) || EN_READY_GUIDE_IDS.has(id);
}

// { ko, en } absolute URL pair for hreflang alternates.languages, or null
// when no EN version exists yet (caller should omit the languages key).
export function enAlternates(routeId) {
  if (!hasEnVersion(routeId)) return null;
  const path = idToPath(routeId);
  return {
    ko: `${SITE_URL}${path}`,
    en: `${SITE_URL}/en${path === "/" ? "" : path}`,
    "x-default": `${SITE_URL}${path}`,
  };
}
