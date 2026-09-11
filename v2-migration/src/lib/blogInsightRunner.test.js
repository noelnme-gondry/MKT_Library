import { describe, expect, it } from "vitest";
import { getAllPosts } from "@/lib/blog";
import { BLOG_INSIGHT_PLACEMENTS, BLOG_INSIGHT_EXCLUSIONS, splitBlogInsight } from "./blogInsightRegistry";
import { strictMetric, descriptiveBlogResult } from "./blogInsightRunner";
describe("blog data checks", () => {
  it("requires a reviewed placement or an explicit reason for every published article in both locales", () => {
    for (const locale of ["ko", "en"]) {
      const posts = getAllPosts(locale);
      expect(posts.length).toBeGreaterThan(40);
      for (const post of posts) {
        const placed = BLOG_INSIGHT_PLACEMENTS[post.slug];
        expect(Boolean(placed) !== Boolean(BLOG_INSIGHT_EXCLUSIONS[post.slug]), post.slug).toBe(true);
        if (placed) {
          const split = splitBlogInsight(post.html, post.slug);
          expect(split, `${locale}:${post.slug}`).not.toBeNull();
          expect(split.before + split.after).toBe(post.html.replaceAll("<!-- CONTENT_ACTION -->", ""));
        }
      }
    }
  });
  it.each(["", "invalid", "50%", "-1", "1,2", "1e999", null])("does not turn invalid %s into zero", value => expect(strictMetric(value)).toBeNull());
  it("keeps zero and quoted-thousands values meaningful", () => { expect(strictMetric("0")).toBe(0); expect(strictMetric("1,200")).toBe(1200); });
  it("computes ratio of sums and preserves zero-denominator unknowns", () => {
    const result = descriptiveBlogResult({ headers: ["group", "value", "base"], raw: [{ group: "A", value: 5, base: 10 }, { group: "A", value: 10, base: 90 }, { group: "B", value: 0, base: 0 }] }, { category: "group", value: "value", denominator: "base" }, "ko");
    expect(result.visualizations[0].data).toEqual([{ label: "A", value: .15 }, { label: "B", value: null }]);
  });
});
