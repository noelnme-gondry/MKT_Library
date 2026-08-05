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
import { getBlogEditorial, publishedEditorialSlugs } from "./blogEditorial";

const sorted = (values) => [...values].sort();
const HIGH_INTENT_ARTICLE_AUDIT = {
  "ad-performance-diagnosis": { toolId: "5-21", minimumSources: 4, hasMidAction: true },
  "budget-marginal-efficiency": { toolId: "5-3", minimumSources: 4, hasMidAction: false },
  "ad-creative-testing": { toolId: "9-6", minimumSources: 7, hasMidAction: true },
};

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

  it("keeps direct answers and topic-specific applicability guidance complete", () => {
    for (const locale of ["ko", "en"]) {
      const posts = getAllPosts(locale);
      expect(sorted(publishedEditorialSlugs(locale))).toEqual(sorted(posts.map((post) => post.slug)));
      expect(new Set(posts.map((post) => post.conditions)).size).toBeGreaterThanOrEqual(7);
      for (const post of posts) {
        const editorial = getBlogEditorial(locale, post.slug);
        expect(editorial.answer, `${locale}/${post.slug} needs a direct answer`).toBeTruthy();
        expect(editorial.conditions, `${locale}/${post.slug} needs applicability guidance`).toBeTruthy();
        expect(post.seoAnswer).toBe(editorial.answer);
        if (post.reviewedAt) expect(post.reviewedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  it("keeps visible external citations valid, complete, and equivalent across KR/EN pairs", () => {
    const english = new Map(getAllPosts("en").map((post) => [post.slug, post]));
    for (const post of getAllPosts("ko")) {
      const enPost = english.get(post.slug);
      expect(enPost, `en/${post.slug} must exist`).toBeTruthy();
      expect(post.sources.every((source) => /^https:\/\//.test(source.url))).toBe(true);
      expect(enPost.sources.every((source) => /^https:\/\//.test(source.url))).toBe(true);
      const visibleUrls = [...post.html.matchAll(/href="(https:\/\/[^"]+)"/g)].map((match) => match[1]);
      const visibleEnUrls = [...enPost.html.matchAll(/href="(https:\/\/[^"]+)"/g)].map((match) => match[1]);
      expect(post.sources.map((source) => source.url)).toEqual(expect.arrayContaining(visibleUrls));
      expect(enPost.sources.map((source) => source.url)).toEqual(expect.arrayContaining(visibleEnUrls));
      expect(enPost.sources.map((source) => source.url)).toEqual(post.sources.map((source) => source.url));
    }
  });

  it("keeps visible FAQ coverage equivalent across KR/EN pairs", () => {
    const english = new Map(getAllPosts("en").map((post) => [post.slug, post]));
    for (const post of getAllPosts("ko")) {
      const enPost = english.get(post.slug);
      expect(enPost, `en/${post.slug} must exist`).toBeTruthy();
      expect(enPost.faq.length, `FAQ count differs for ${post.slug}`).toBe(post.faq.length);
    }
  });

  it("keeps audited high-intent articles sourced, reviewed, and connected to the exact tool", () => {
    for (const locale of ["ko", "en"]) {
      const posts = new Map(getAllPosts(locale).map((post) => [post.slug, post]));
      for (const [slug, audit] of Object.entries(HIGH_INTENT_ARTICLE_AUDIT)) {
        const post = posts.get(slug);
        expect(post, `${locale}/${slug} must exist`).toBeTruthy();
        expect(post.primaryTool).toBe(audit.toolId);
        expect(post.reviewer, `${locale}/${slug} needs an explicit review owner`).toBeTruthy();
        expect(post.reviewedAt).toBe("2026-08-03");
        expect(post.updated).toBe("2026-08-03");
        expect(post.sources.length).toBeGreaterThanOrEqual(audit.minimumSources);
        expect(post.faq.length).toBeGreaterThanOrEqual(3);
        if (audit.hasMidAction) expect(post.html).toContain("<!-- CONTENT_ACTION -->");
        else expect(post.html).not.toContain("<!-- CONTENT_ACTION -->");
      }
    }
  });

  it("keeps audited high-intent search phrases in final SEO titles or descriptions", () => {
    const coverage = {
      ko: {
        "budget-marginal-efficiency": "마케팅 예산 배분",
        "cohort-analysis-guide": "D30 리텐션",
        "aso-basics-guide": "ASO 전략",
        "cannibalization-organic-paid": "내부 카니발라이제이션",
      },
      en: {
        "budget-marginal-efficiency": "marketing budget allocation",
        "cohort-analysis-guide": "d30 retention",
        "aso-basics-guide": "aso strategy",
        "cannibalization-organic-paid": "internal cannibalisation",
      },
    };
    for (const [locale, entries] of Object.entries(coverage)) {
      const posts = new Map(getAllPosts(locale).map((post) => [post.slug, post]));
      for (const [slug, phrase] of Object.entries(entries)) {
        const post = posts.get(slug);
        expect(post, `${locale}/${slug} must exist`).toBeTruthy();
        expect(`${post.title} ${post.description}`.toLowerCase()).toContain(phrase.toLowerCase());
      }
    }
  });

  it("keeps paired diagnostic articles linked in both directions for each locale", () => {
    const pairs = [
      ["attribution-data-mismatch", "ga4-data-traps"],
      ["campaign-anomaly-detection", "ad-performance-diagnosis"],
    ];
    for (const locale of ["ko", "en"]) {
      const posts = new Map(getAllPosts(locale).map((post) => [post.slug, post]));
      const prefix = locale === "en" ? "/en" : "";
      for (const [first, second] of pairs) {
        expect(posts.get(first).html).toContain(`href="${prefix}/blog/${second}"`);
        expect(posts.get(second).html).toContain(`href="${prefix}/blog/${first}"`);
      }
    }
  });

  it("keeps the metric-intent split, ROAS route, and editorial link recovery intact", () => {
    for (const locale of ["ko", "en"]) {
      const posts = new Map(getAllPosts(locale).map((post) => [post.slug, post]));
      const prefix = locale === "en" ? "/en" : "";
      const metricDefinitions = posts.get("cpi-cpa-cpm-difference");
      expect(metricDefinitions.title.toLowerCase()).toContain("cpm");
      expect(metricDefinitions.keywords.toLowerCase()).not.toContain("cpi cpa");
      expect(metricDefinitions.html).toContain(`href="${prefix}/blog/performance-marketing-metrics"`);
      expect(posts.get("roas-improvement")).toBeTruthy();
      expect(posts.get("ad-performance-diagnosis").html).toContain(`href="${prefix}/blog/ad-creative-testing"`);
      ["meta-advantage-plus-guide", "aso-basics-guide", "retargeting-reengagement-guide", "ad-creative-specs-guide"].forEach((slug) => {
        expect(posts.get("performance-marketer-skills").html).toContain(`href="${prefix}/blog/${slug}"`);
      });
      ["aha-moment-retention", "cohort-analysis-guide", "incrementality-measurement"].forEach((slug) => {
        expect(posts.get("aha-event-ad-optimization").html).toContain(`href="${prefix}/blog/${slug}"`);
      });
    }
  });

  it("does not invent an English URL for unpublished draft content", () => {
    expect(localizedHref("/blog/adjust-vs-appsflyer", "en")).toBe("/blog/adjust-vs-appsflyer");
    expect(localizedHref("/blog/ad-performance-diagnosis", "en")).toBe("/en/blog/ad-performance-diagnosis");
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
