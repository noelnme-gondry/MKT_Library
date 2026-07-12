import { ROUTES, SITE_URL } from "@/lib/routeMap";
import { getAllPosts, getAllTags } from "@/lib/blog";

const BASE = SITE_URL; // matches layout.js canonical/openGraph

// Next 16 auto-serves this at /sitemap.xml. Tool/SOP URLs derive from the routeMap
// SSOT (no drift when tools change). Blog는 routeMap 밖(fs 기반)이라 getAllPosts로
// 직접 추가 — 목록(/blog) + 발행 글별(/blog/<slug>). 0편이면 /blog 목록만.
export default function sitemap() {
  const seen = new Set();
  const routeEntries = ROUTES.filter((r) => !seen.has(r.slug) && seen.add(r.slug)).map((r) => ({
    url: BASE + (r.slug === "/" ? "" : r.slug),
    lastModified: new Date(),
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
    { url: `${BASE}/blog`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    ...posts.map((p) => ({
      url: `${BASE}/blog/${p.slug}`,
      lastModified: p.date ? new Date(p.date) : new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    })),
    // 태그 랜딩(롱테일 SEO 허브) — 발행 글의 태그마다 1페이지.
    ...getAllTags().map((t) => ({
      url: `${BASE}/blog/tag/${t.slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.5,
    })),
  ];

  // EN 랜딩("/en") — routeMap 밖의 별도 literal 라우트(§en-landing-page). id 불변
  // 규칙상 ROUTES에 추가하지 않고 여기서 직접 추가(EN 블로그와 동일 방식).
  const enLandingEntries = [
    { url: `${BASE}/en`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
  ];

  // EN 블로그(content/blog-en, §blog-en-translation-strategy) — 태그 랜딩 미구현, 목록+글만.
  const enPosts = getAllPosts("en");
  const enBlogEntries = [
    { url: `${BASE}/en/blog`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    ...enPosts.map((p) => ({
      url: `${BASE}/en/blog/${p.slug}`,
      lastModified: p.date ? new Date(p.date) : new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    })),
  ];

  return [...routeEntries, ...blogEntries, ...enLandingEntries, ...enBlogEntries];
}
