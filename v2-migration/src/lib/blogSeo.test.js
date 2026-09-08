import { describe, expect, it } from "vitest";
import { getAllPosts } from "./blog";
import { getBlogSeo, publishedBlogSeoSlugs } from "./blogSeo";

describe("blogSeo metadata contract", () => {
  // 2026-09-08: KO 40자·EN 60자 제목 상한을 뺐다. 상한은 SERP 잘림을 막으려던 것이었지만,
  // 검색어를 다 담지 못해 제목이 질의와 어긋나는 쪽이 더 비쌌다(잘린 제목은 클릭을 잃고,
  // 어긋난 제목은 노출 자체를 잃는다). 대신 검색어를 앞에 세워 잘려도 핵심이 남게 쓴다.
  // description 상한은 그대로 둔다 — 스니펫은 잘리면 문장이 중간에서 끊겨 읽기가 망가진다.
  it.each(["ko", "en"])("covers every published title and keeps description bounded (%s)", (locale) => {
    const descriptionLimit = locale === "ko" ? 80 : 160;
    const slugs = publishedBlogSeoSlugs(locale);
    expect(slugs).not.toContain("adjust-vs-appsflyer");
    for (const slug of slugs) {
      const seo = getBlogSeo(locale, slug, { description: "Original article summary." });
      expect(seo?.title).toBeTruthy();
      expect([...seo.description].length).toBeLessThanOrEqual(descriptionLimit);
      expect(seo).not.toHaveProperty("answer");
    }
  });

  // h1은 화면에 보이는 제목이라 비면 페이지에 제목이 없는 상태가 된다.
  // 레지스트리에 따로 적지 않은 글은 SERP 제목을 그대로 물려받아야 한다.
  it.each(["ko", "en"])("gives every published post a non-empty h1 (%s)", (locale) => {
    const missing = publishedBlogSeoSlugs(locale)
      .filter((slug) => !getBlogSeo(locale, slug, {})?.h1);
    expect(missing, `h1 없음:\n${missing.join("\n")}`).toEqual([]);
  });

  // 발행 원고를 출발점으로 파싱 결과까지 검사한다. 레지스트리의 자체 목록만
  // 돌면 미등록 원고와 실제 화면의 폴백 경로는 검사되지 않는다.
  it.each(["ko", "en"])("published articles carry SEO headings and localized body links (%s)", (locale) => {
    const posts = getAllPosts(locale);
    expect(posts.length).toBeGreaterThan(40);
    expect(posts.map(post => post.slug).sort()).toEqual(publishedBlogSeoSlugs(locale).sort());
    for (const post of posts) {
      expect(post.h1, post.slug).toBe(getBlogSeo(locale, post.slug).h1);
      expect(post.h1.trim(), post.slug).not.toBe("");
      expect(post.html, post.slug).not.toMatch(/<h1[ >]/);
      if (locale === "en") expect(post.html, post.slug).not.toMatch(/href="\/blog\//);
    }
  });

  it("provides preview metadata for the unpublished Adjust comparison", () => {
    expect(getBlogSeo("ko", "adjust-vs-appsflyer")?.title).toContain("Adjust");
    expect(getBlogSeo("en", "adjust-vs-appsflyer")?.title).toContain("AppsFlyer");
  });
});
