import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config.mjs";
import sitemap from "@/app/sitemap";
import { getAllPosts } from "@/lib/blog";
import { SITE_URL, resolveSlugToId, isRouteIndexable } from "@/lib/routeMap";

const redirects = await nextConfig.redirects();

const blogSlug = (path) => {
  const match = /^\/(?:en\/)?blog\/([^/?#]+)$/.exec(path);
  return match ? match[1] : null;
};

const publishedBlogSlugs = {
  ko: new Set(getAllPosts("ko").map((post) => post.slug)),
  en: new Set(getAllPosts("en").map((post) => post.slug)),
};

describe("redirects", () => {
  it("declares redirects at all", () => {
    expect(redirects.length).toBeGreaterThan(0);
  });

  // 301 목적지가 사라지면 링크주스가 404로 흘러간다. 통합·이관 때 가장 흔한 사고다.
  it("points every destination at a page that still exists", () => {
    for (const rule of redirects) {
      const slug = blogSlug(rule.destination);
      if (slug) {
        const locale = rule.destination.startsWith("/en/") ? "en" : "ko";
        expect(publishedBlogSlugs[locale].has(slug), `${rule.source} → ${rule.destination}`).toBe(true);
        continue;
      }
      const routePath = rule.destination.replace(/^\/en/, "");
      const routeId = resolveSlugToId(routePath.split("/").filter(Boolean));
      expect(routeId, `${rule.source} → ${rule.destination}`).toBeTruthy();
      expect(isRouteIndexable(routeId), rule.destination).toBe(true);
    }
  });

  // 리다이렉트되는 URL이 sitemap에 남아 있으면 크롤러가 계속 옛 주소를 요청한다.
  it("keeps redirected sources out of the sitemap", () => {
    const sitemapPaths = new Set(sitemap().map((entry) => entry.url.replace(SITE_URL, "")));
    for (const rule of redirects) {
      expect(sitemapPaths.has(rule.source), `sitemap still lists ${rule.source}`).toBe(false);
    }
  });

  it("never redirects a path to itself or into another redirect", () => {
    const sources = new Map(redirects.map((rule) => [rule.source, rule.destination]));
    for (const rule of redirects) {
      expect(rule.source, "self redirect").not.toBe(rule.destination);
      expect(sources.has(rule.destination), `chain: ${rule.source} → ${rule.destination}`).toBe(false);
    }
  });

  it("uses permanent redirects so link equity transfers", () => {
    for (const rule of redirects) {
      expect(rule.permanent, rule.source).toBe(true);
    }
  });
});
