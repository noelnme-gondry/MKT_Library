import { describe, expect, it } from "vitest";

import { getAllPosts } from "./blog";
import { getBlogSeo } from "./blogSeo";
import { getAllTerms } from "./glossary";
import {
  GUIDE_SEARCH_CONTENT_IDS,
  getGuideFaq,
  getGuidePrimaryTool,
  getGuideSearchContent,
  guidePostSlugs,
  guideTermSlugs,
  guidesForPost,
} from "./guideSearchContent";
import { getRouteSeo } from "./routeSeo";
import { ROUTES, isRoutePublished, idToSlug } from "./routeMap";

const LOCALES = ["ko", "en"];

// 목록은 ROUTES에서 파생한다 — 손으로 적으면 새 가이드가 "가드에서도 똑같이" 빠진다.
const publishedGuideIds = ROUTES
  .filter((route) => isRoutePublished(route) && /^([1-4]-\d+|8-1)$/.test(route.id))
  .map((route) => route.id);

describe("guideSearchContent", () => {
  it("covers every published SOP guide", () => {
    expect([...GUIDE_SEARCH_CONTENT_IDS].sort()).toEqual([...publishedGuideIds].sort());
  });

  it.each(LOCALES)("answers the guide's core question up front (%s)", (locale) => {
    for (const id of GUIDE_SEARCH_CONTENT_IDS) {
      const content = getGuideSearchContent(id, locale);
      expect(content, id).toBeTruthy();
      expect(content.question.endsWith("?"), id).toBe(true);
      expect(content.answer, id).toBeTruthy();
      expect(content.answer.length, `${id} answer too long`).toBeLessThanOrEqual(90);
      // 핵심 질문이 아래 FAQ와 중복되면 같은 질문이 두 번 렌더된다.
      expect(content.faq.map((item) => item.q), id).not.toContain(content.question);
    }
  });

  it.each(LOCALES)("keeps FAQ entries answerable and unique (%s)", (locale) => {
    for (const id of GUIDE_SEARCH_CONTENT_IDS) {
      const { faq } = getGuideSearchContent(id, locale);
      expect(faq.length, id).toBeGreaterThanOrEqual(2);
      expect(new Set(faq.map((item) => item.q)).size, id).toBe(faq.length);
      for (const item of faq) {
        expect(item.q.length, id).toBeGreaterThan(5);
        expect(item.a.length, id).toBeGreaterThan(20);
      }
    }
  });

  it.each(LOCALES)("puts the core question first in the FAQ payload (%s)", (locale) => {
    for (const id of GUIDE_SEARCH_CONTENT_IDS) {
      const content = getGuideSearchContent(id, locale);
      const faq = getGuideFaq(id, locale);
      expect(faq[0]?.q, id).toBe(content.question);
      expect(faq.length, id).toBe(content.faq.length + 1);
      expect(new Set(faq.map((item) => item.q)).size, id).toBe(faq.length);
    }
  });

  it.each(LOCALES)("does not reuse one core question across guides (%s)", (locale) => {
    const questions = GUIDE_SEARCH_CONTENT_IDS.map((id) => getGuideSearchContent(id, locale).question);
    expect(new Set(questions).size).toBe(questions.length);
  });

  it("points every guide at a real analysis route", () => {
    for (const id of GUIDE_SEARCH_CONTENT_IDS) {
      const tool = getGuidePrimaryTool(id);
      expect(tool, id).toBeTruthy();
      expect(idToSlug[tool], `${id} → ${tool} is not a real route`).toBeTruthy();
    }
  });

  it("keeps guide→post and post→guide in sync (reverse index is derived)", () => {
    for (const id of GUIDE_SEARCH_CONTENT_IDS) {
      for (const slug of guidePostSlugs(id)) {
        expect(guidesForPost(slug), `${slug} → ${id} 역방향 누락`).toContain(id);
      }
    }
    for (const [slug, guideIds] of Object.entries(
      Object.fromEntries(
        GUIDE_SEARCH_CONTENT_IDS.flatMap((id) => guidePostSlugs(id).map((slug) => [slug, guidesForPost(slug)])),
      ),
    )) {
      for (const id of guideIds) {
        expect(guidePostSlugs(id), `${id} → ${slug} 정방향 누락`).toContain(slug);
      }
    }
  });

  it.each(LOCALES)("does not let a paired guide and post share one title (%s)", (locale) => {
    for (const id of GUIDE_SEARCH_CONTENT_IDS) {
      const guideTitle = getRouteSeo(id, locale)?.title;
      for (const slug of guidePostSlugs(id)) {
        const postTitle = getBlogSeo(locale, slug)?.title;
        if (!postTitle) continue;
        expect(postTitle, `${id} ↔ ${slug} 제목 동일`).not.toBe(guideTitle);
      }
    }
  });

  it("links only to published posts and terms", () => {
    const postSlugs = new Set(getAllPosts("ko").map((post) => post.slug));
    const enPostSlugs = new Set(getAllPosts("en").map((post) => post.slug));
    const termSlugs = new Set(getAllTerms("ko").map((term) => term.slug));
    for (const id of GUIDE_SEARCH_CONTENT_IDS) {
      // 가이드는 도구와 달리 본문이 이미 롱폼이라 관련 글이 없으면 아웃바운드가
      // 통째로 사라진다 — 최소 1건은 강제한다.
      expect(guidePostSlugs(id).length + guideTermSlugs(id).length, id).toBeGreaterThan(0);
      for (const slug of guidePostSlugs(id)) {
        expect(postSlugs.has(slug), `${id} → /blog/${slug} 없음`).toBe(true);
        expect(enPostSlugs.has(slug), `${id} → /en/blog/${slug} 없음`).toBe(true);
      }
      for (const slug of guideTermSlugs(id)) {
        expect(termSlugs.has(slug), `${id} → /glossary/${slug} 없음`).toBe(true);
      }
    }
  });
});
