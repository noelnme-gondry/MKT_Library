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

  it("keeps final search titles and descriptions unique within each locale", () => {
    for (const locale of ["ko", "en"]) {
      const posts = getAllPosts(locale);
      for (const field of ["title", "description"]) {
        const normalized = posts.map((post) => String(post[field] || "").trim().replace(/\s+/g, " ").toLocaleLowerCase(locale));
        expect(new Set(normalized).size, `${locale} has duplicate final ${field} values`).toBe(posts.length);
      }
    }
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
        "event-taxonomy-guide": "SDK 이벤트",
      },
      en: {
        "budget-marginal-efficiency": "marketing budget allocation",
        "cohort-analysis-guide": "d30 retention",
        "aso-basics-guide": "aso strategy",
        "cannibalization-organic-paid": "internal cannibalisation",
        "event-taxonomy-guide": "sdk event",
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

  // blogSeo.test.js는 스텁 설명으로 레지스트리만 보므로 원고 설명이 길어져도 못 잡는다.
  // 여기서는 실제 발행글의 최종 description을 검사한다 — 검색결과에서 잘리지 않게
  // 길이를 강제하고, 제목만 반복하는 자동 문구가 다시 전 글로 퍼지지 않게 막는다.
  it.each([["ko", 80], ["en", 160]])("keeps every published description specific and within limits (%s)", (locale, limit) => {
    const generic = locale === "en"
      ? "A practical guide to the key checks, trade-offs, and next steps."
      : "핵심 기준과 실무 확인 순서를 정리합니다.";
    for (const post of getAllPosts(locale)) {
      expect(post.description, `missing description for ${post.slug}`).toBeTruthy();
      expect([...post.description].length, `description too long for ${locale}/${post.slug}`).toBeLessThanOrEqual(limit);
      expect(post.description, `${locale}/${post.slug} fell back to the boilerplate description`).not.toContain(generic);
    }
  });

  it("consolidates Korean blog navigation into six parent categories", () => {
    expect(sorted(getAllTags("ko").map((tag) => tag.tag))).toEqual(sorted([
      "측정·분석", "예산·효율", "소재·크리에이티브", "매체·운영", "타겟·퍼널", "성장·커리어",
    ]));
  });
});

// AEO: 발행 글은 FAQPage 구조화 데이터를 낸다. 이 가드가 없던 동안 36편 중 20편이
// FAQ 없이 나가고 있었고, 목록을 손으로 세지 않으면 드러나지 않았다.
// 목록은 발행물에서 파생한다 — 하드코딩하면 새 글이 가드에서도 똑같이 빠진다(§7).
describe("블로그 FAQ 커버리지", () => {
  it.each(["ko", "en"])("%s 발행 글은 모두 FAQ를 2문항 이상 갖는다", (locale) => {
    const missing = getAllPosts(locale)
      .filter((post) => !Array.isArray(post.faq) || post.faq.length < 2)
      .map((post) => post.slug);
    expect(missing).toEqual([]);
  });

  it("FAQ 질문·답이 비어 있거나 지나치게 짧지 않다", () => {
    for (const locale of ["ko", "en"]) {
      for (const post of getAllPosts(locale)) {
        for (const item of post.faq) {
          expect(item.q.trim().length, `${locale}/${post.slug}`).toBeGreaterThan(8);
          expect(item.a.trim().length, `${locale}/${post.slug}`).toBeGreaterThan(30);
        }
      }
    }
  });

  it("한 글 안에서 같은 질문이 반복되지 않는다", () => {
    for (const locale of ["ko", "en"]) {
      for (const post of getAllPosts(locale)) {
        expect(new Set(post.faq.map((item) => item.q)).size, `${locale}/${post.slug}`).toBe(post.faq.length);
      }
    }
  });
});
