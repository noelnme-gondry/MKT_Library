import { describe, expect, it } from "vitest";
import { getBlogSeo, publishedBlogSeoSlugs } from "./blogSeo";

describe("blogSeo metadata contract", () => {
  it.each(["ko", "en"])("covers every published title and keeps descriptions bounded (%s)", (locale) => {
    const limit = locale === "ko" ? 80 : 160;
    const slugs = publishedBlogSeoSlugs(locale);
    expect(slugs).not.toContain("adjust-vs-appsflyer");
    for (const slug of slugs) {
      const seo = getBlogSeo(locale, slug, { description: "Original article summary." });
      expect(seo?.title).toBeTruthy();
      expect([...seo.description].length).toBeLessThanOrEqual(limit);
      expect(seo).not.toHaveProperty("answer");
    }
  });

  it("provides preview metadata for the unpublished Adjust comparison", () => {
    expect(getBlogSeo("ko", "adjust-vs-appsflyer")?.title).toContain("Adjust");
    expect(getBlogSeo("en", "adjust-vs-appsflyer")?.title).toContain("AppsFlyer");
  });
});
