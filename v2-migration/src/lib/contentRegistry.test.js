import { describe, expect, it } from "vitest";
import { getAllPosts, getAllTags, getPostsByTag } from "./blog";
import { getAllTerms } from "./glossary";
import {
  PUBLISHED_BLOG_TOOL_MAP,
  PUBLISHED_BLOG_GLOSSARY_MAP,
  PUBLISHED_GLOSSARY_TOOL_MAP,
} from "./contentToolRegistry";
import { EN_BLOG_SLUGS, EN_GLOSSARY_SLUGS, localizedHref } from "./localizedHref";
import { isRoutePublished } from "./routeMap";
import { publishedBlogSeoSlugs } from "./blogSeo";

const sorted = (values) => [...values].sort();

describe("editorial SEO registries", () => {
  it("maps every published KR article to one published analysis tool", () => {
    const slugs = getAllPosts("ko").map((post) => post.slug);
    expect(sorted(Object.keys(PUBLISHED_BLOG_TOOL_MAP))).toEqual(sorted(slugs));
    expect(Object.values(PUBLISHED_BLOG_TOOL_MAP).every(isRoutePublished)).toBe(true);
  });

  it("connects every published article to existing glossary entries", () => {
    const posts = getAllPosts("ko").map((post) => post.slug);
    const terms = new Set(getAllTerms("ko").map((term) => term.slug));
    expect(sorted(Object.keys(PUBLISHED_BLOG_GLOSSARY_MAP))).toEqual(sorted(posts));
    expect(Object.values(PUBLISHED_BLOG_GLOSSARY_MAP).flat().every((slug) => terms.has(slug))).toBe(true);
  });

  it("maps every glossary term to one published analysis tool", () => {
    const slugs = getAllTerms("ko").map((term) => term.slug);
    expect(sorted(Object.keys(PUBLISHED_GLOSSARY_TOOL_MAP))).toEqual(sorted(slugs));
    expect(Object.values(PUBLISHED_GLOSSARY_TOOL_MAP).every(isRoutePublished)).toBe(true);
  });

  it("keeps locale registries identical to the translated content on disk", () => {
    expect(sorted(EN_BLOG_SLUGS)).toEqual(sorted(getAllPosts("en").map((post) => post.slug)));
    expect(sorted(EN_GLOSSARY_SLUGS)).toEqual(sorted(getAllTerms("en").map((term) => term.slug)));
  });

  it("keeps search titles/answers complete for every published blog", () => {
    expect(sorted(publishedBlogSeoSlugs("ko"))).toEqual(sorted(getAllPosts("ko").map((post) => post.slug)));
    expect(sorted(publishedBlogSeoSlugs("en"))).toEqual(sorted(getAllPosts("en").map((post) => post.slug)));
    expect(getAllPosts("ko").every((post) => post.seoAnswer && post.searchIntent)).toBe(true);
    expect(getAllPosts("en").every((post) => post.seoAnswer && post.searchIntent)).toBe(true);
  });

  it("does not invent an English URL for untranslated content", () => {
    expect(localizedHref("/blog/adjust-vs-appsflyer", "en")).toBe("/blog/adjust-vs-appsflyer");
    expect(localizedHref("/blog/ab-testing", "en")).toBe("/en/blog/ab-testing");
  });

  it("resolves every encoded Korean tag route back to published posts", () => {
    for (const tag of getAllTags("ko")) {
      expect(getPostsByTag(encodeURIComponent(tag.slug), "ko").length).toBe(tag.count);
    }
  });

  it("consolidates Korean blog navigation into six parent categories", () => {
    expect(sorted(getAllTags("ko").map((tag) => tag.tag))).toEqual(sorted([
      "측정·분석", "예산·효율", "소재·크리에이티브", "매체·운영", "타겟·퍼널", "성장·커리어",
    ]));
  });
});
