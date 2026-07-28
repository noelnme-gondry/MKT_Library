import { ROUTES, SITE_URL, EN_READY_TOOL_IDS, EN_READY_GUIDE_IDS, idToPath, isRoutePublished } from "@/lib/routeMap";
import { getAllPosts, getAllTags } from "@/lib/blog";
import { getAllTerms } from "@/lib/glossary";

const BASE = SITE_URL; // matches layout.js canonical/openGraph
const PRODUCT_LAST_MODIFIED = new Date("2026-07-29");
const latestDate = (items) => {
  const dates = items.map((item) => item.updated || item.date).filter(Boolean).sort();
  return dates.length ? new Date(dates[dates.length - 1]) : PRODUCT_LAST_MODIFIED;
};

// Next 16 auto-serves this at /sitemap.xml. Tool/SOP URLs derive from the routeMap
// SSOT (no drift when tools change). Blog는 routeMap 밖(fs 기반)이라 getAllPosts로
// 직접 추가 — 목록(/blog) + 발행 글별(/blog/<slug>). 0편이면 /blog 목록만.
export default function sitemap() {
  const seen = new Set();
  const routeEntries = ROUTES.filter((r) => isRoutePublished(r) && !seen.has(r.slug) && seen.add(r.slug)).map((r) => ({
    url: BASE + (r.slug === "/" ? "" : r.slug),
    lastModified: PRODUCT_LAST_MODIFIED,
    changeFrequency:
      r.slug === "/"
        ? "weekly"
        : r.slug.startsWith("/guide/")
        ? "monthly"
        : "weekly",
    priority:
      r.slug === "/"
        ? 1
        : r.slug.startsWith("/tools/") || r.slug === "/dashboard"
        ? 0.8
        : 0.6,
  }));

  const posts = getAllPosts();
  const blogEntries = [
    { url: `${BASE}/blog`, lastModified: latestDate(posts), changeFrequency: "weekly", priority: 0.7 },
    ...posts.map((p) => ({
      url: `${BASE}/blog/${p.slug}`,
      lastModified: p.updated || p.date ? new Date(p.updated || p.date) : PRODUCT_LAST_MODIFIED,
      changeFrequency: "weekly",
      priority: 0.7,
    })),
    // 태그 랜딩(롱테일 SEO 허브) — 발행 글의 태그마다 1페이지.
    // 태그 페이지의 색인 기준과 동일: 최소 3편이어야 sitemap에 넣는다.
    ...getAllTags().filter((t) => t.count >= 3).map((t) => ({
      url: `${BASE}/blog/tag/${t.slug}`,
      lastModified: latestDate(getPostsByTagSafe(t.slug, posts)),
      changeFrequency: "weekly",
      priority: 0.5,
    })),
  ];

  // CSV 템플릿 다운로드("/templates") — 블로그와 동일하게 routeMap 밖 독립 페이지.
  const templateEntries = [
    { url: `${BASE}/templates`, lastModified: PRODUCT_LAST_MODIFIED, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/en/templates`, lastModified: PRODUCT_LAST_MODIFIED, changeFrequency: "monthly", priority: 0.6 },
  ];

  // routeMap 밖의 독립 페이지. 색인 가능한 canonical 페이지가 sitemap에서
  // 누락되지 않게 주간 리뷰 KO/EN과 법적 고지 페이지를 명시한다.
  const standaloneEntries = [
    { url: `${BASE}/weekly-review`, lastModified: PRODUCT_LAST_MODIFIED, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE}/en/weekly-review`, lastModified: PRODUCT_LAST_MODIFIED, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE}/privacy`, lastModified: PRODUCT_LAST_MODIFIED, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/en/privacy`, lastModified: PRODUCT_LAST_MODIFIED, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/terms`, lastModified: PRODUCT_LAST_MODIFIED, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/en/terms`, lastModified: PRODUCT_LAST_MODIFIED, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/contact`, lastModified: PRODUCT_LAST_MODIFIED, changeFrequency: "yearly", priority: 0.4 },
    { url: `${BASE}/en/contact`, lastModified: PRODUCT_LAST_MODIFIED, changeFrequency: "yearly", priority: 0.4 },
  ];

  // 용어사전("/glossary") — 목록 + 발행 항목별. 블로그와 동일 패턴.
  const glossaryTerms = getAllTerms();
  const glossaryEntries = [
    { url: `${BASE}/glossary`, lastModified: latestDate(glossaryTerms), changeFrequency: "weekly", priority: 0.6 },
    ...glossaryTerms.map((t) => ({
      url: `${BASE}/glossary/${t.slug}`,
      lastModified: t.date ? new Date(t.date) : PRODUCT_LAST_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.5,
    })),
  ];

  // EN 랜딩("/en") — routeMap 밖의 별도 literal 라우트(§en-landing-page). id 불변
  // 규칙상 ROUTES에 추가하지 않고 여기서 직접 추가(EN 블로그와 동일 방식).
  const enLandingEntries = [
    { url: `${BASE}/en`, lastModified: PRODUCT_LAST_MODIFIED, changeFrequency: "weekly", priority: 0.9 },
  ];

  // EN 블로그(content/blog-en, §blog-en-translation-strategy) — 태그 랜딩 미구현, 목록+글만.
  const enPosts = getAllPosts("en");
  const enBlogEntries = [
    { url: `${BASE}/en/blog`, lastModified: latestDate(enPosts), changeFrequency: "weekly", priority: 0.7 },
    ...enPosts.map((p) => ({
      url: `${BASE}/en/blog/${p.slug}`,
      lastModified: p.updated || p.date ? new Date(p.updated || p.date) : PRODUCT_LAST_MODIFIED,
      changeFrequency: "weekly",
      priority: 0.7,
    })),
  ];

  // EN 가이드(EN_READY_GUIDE_IDS 레지스트리 파생 — {id}.en.json 번역 완료분만).
  // 새 가이드 번역 시 레지스트리에 추가하면 여기도 자동 반영(하드코딩 표류 방지).
  const enGuideEntries = [...EN_READY_GUIDE_IDS].map((id) => ({
    url: `${BASE}/en${idToPath(id)}`,
    lastModified: PRODUCT_LAST_MODIFIED,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  // EN 용어사전(content/glossary-en) — 목록 + 발행 항목별.
  const enGlossaryTerms = getAllTerms("en");
  const enGlossaryEntries = [
    { url: `${BASE}/en/glossary`, lastModified: latestDate(enGlossaryTerms), changeFrequency: "weekly", priority: 0.6 },
    ...enGlossaryTerms.map((t) => ({
      url: `${BASE}/en/glossary/${t.slug}`,
      lastModified: t.date ? new Date(t.date) : PRODUCT_LAST_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.5,
    })),
  ];

  // EN 도구(routeMap EN_READY_TOOL_IDS, §plan) — 번역 완료된 도구만. 새 도구가
  // 레지스트리에 추가되는 순간 이 목록도 자동으로 늘어남(하드코딩 없음).
  const enToolEntries = [...EN_READY_TOOL_IDS].map((id) => ({
    url: `${BASE}/en${idToPath(id)}`,
    lastModified: PRODUCT_LAST_MODIFIED,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...routeEntries, ...blogEntries, ...templateEntries, ...standaloneEntries, ...glossaryEntries, ...enLandingEntries, ...enBlogEntries, ...enGuideEntries, ...enGlossaryEntries, ...enToolEntries];
}

function getPostsByTagSafe(tagSlug, posts) {
  return posts.filter((post) => post.tags.some((tag) => String(tag).trim().replace(/\s+/g, "-") === tagSlug));
}
