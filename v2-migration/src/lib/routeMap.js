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
  // 5-18은 다섯 분석이 공유하는 CSV·매핑 허브다. 예전에는 이 하나만 도구 목록에
  // 있고 분석 다섯은 그 안에 들어가야만 보였는데, 서로 다른 질문 다섯 개를 한 이름
  // 뒤에 숨긴 셈이었다 — 지금은 분석이 각각 도구고, 허브는 목록에 없는 준비 화면이다
  // (검색에는 남는다: publication="subtool"은 nav에서만 빠지고 색인은 유지).
  { id: "5-18", slug: "/tools/marketing-response", component: "MarketingResponse", publication: "subtool" },
  { id: "5-18-paid-organic", slug: "/tools/paid-organic-trend", component: "PaidOrganicTrend" },
  { id: "5-18-trend", slug: "/tools/marketing-trend", component: "MarketingResponseTrend" },
  { id: "5-18-cannibal", slug: "/tools/cannibalization-diagnosis", component: "MarketingResponseCannibal" },
  { id: "5-18-mmm", slug: "/tools/mmm-contribution", component: "MarketingResponseMmm" },
  { id: "5-18-forecast", slug: "/tools/marketing-forecast", component: "MarketingResponseForecast" },
  { id: "5-20", slug: "/tools/aha-moment", component: "AhaMomentFinder" },
  { id: "5-23", slug: "/tools/incrementality", component: "Incrementality" },
  { id: "5-24", slug: "/tools/brand-campaign-incrementality", component: "BrandCampaignIncrementality" },
  { id: "5-25", slug: "/tools/vif-multicollinearity", component: "MulticollinearityChecker" },
  { id: "5-26", slug: "/tools/asa-keyword-finder", component: "AsaKeywordFinder" },
  { id: "5-27", slug: "/tools/aso-store-conversion", component: "AsoStoreConversion" },
  { id: "5-28", slug: "/tools/subscription-survival", component: "SubscriptionSurvivalAnalysis" },
  { id: "5-29", slug: "/tools/segment-composition-change", component: "SegmentCompositionChange" },
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
  // 브라우저 저장 원본의 삭제·만료·설정을 다루는 공개 주소. 데이터가 있는 상태로만
  // 볼 수 있는 무주소 게이트가 아니라, 언제나 열 수 있는 noindex 사생활 화면이다.
  { id: "storage", slug: "/storage", component: "WorkspaceStoragePage", publication: "preview" },
  // 도치가 받은 파일의 매핑·결과 전용 작업대. 사용자 데이터가 브라우저 메모리에만
  // 있으므로 검색 랜딩이 아닌 일회성 화면(publication: preview)으로 둔다.
  { id: "dochi-result", slug: "/dochi-result", component: "DochiResult", publication: "preview" },
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

// 발행된 "분석 도구"(SOP 가이드·셸 라우트 제외)의 id 목록 — 화면 카피의 도구 수,
// 목록·인덱스, 대외 문서 검사가 전부 여기서 파생한다. 같은 필터를 두 벌 두면 하나만
// 고쳐지므로(실제로 toolIndex와 brandFacts가 따로 세고 있었다) 의존성 없는 이 파일에 둔다.
export function publishedToolIds() {
  return ROUTES.filter((route) => isRoutePublished(route) && /^(5-|9-)/.test(route.id)).map((route) => route.id);
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
  "5-2", "5-3", "5-4", "9-6", "9-1", "5-20", "5-21", "5-22", "5-23", "5-24", "5-25", "5-26", "5-27", "5-28", "5-29",
  // 구 5-18 안에 있던 다섯 분석. 각각 독립 도구다.
  "5-18-paid-organic", "5-18-trend", "5-18-cannibal", "5-18-mmm", "5-18-forecast",
]);

// 목록·사이드바에는 없지만 독립 URL과 검색 색인을 갖는 라우트. 지금은 5-18
// (다섯 분석이 공유하는 CSV·매핑 허브) 하나다. EN은 같은 컴포넌트의 locale
// 분기를 쓰므로 이 별도 게이트로 허용한다.
export const EN_READY_UNLISTED_IDS = new Set(["5-18"]);

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
  return id === "home" || id === "guide-index" || id === "start-gate" || id === "storage" || id === "dochi-result" || EN_READY_TOOL_IDS.has(id) || EN_READY_UNLISTED_IDS.has(id) || EN_READY_GUIDE_IDS.has(id);
}

// { ko, en } absolute URL pair for hreflang alternates.languages, or null
// when no EN version exists yet (caller should omit the languages key).
export function enAlternates(routeId) {
  if (!hasEnVersion(routeId)) return null;
  const path = idToPath(routeId);
  const en = `${SITE_URL}/en${path === "/" ? "" : path}`;
  return {
    ko: `${SITE_URL}${path}`,
    en,
    // x-default는 ko·en 어느 쪽에도 매칭되지 않는 제3언어권 검색자가 받는 판이다.
    // 한국어 사용자는 hreflang="ko"로, 영어 사용자는 "en"으로 먼저 매칭되므로
    // 이 값은 그 둘에 영향을 주지 않는다 → 국제 확장 방향에 맞춰 EN을 기본으로 둔다.
    "x-default": en,
  };
}
