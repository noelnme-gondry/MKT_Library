import { describe, expect, it } from "vitest";
import { getAllPosts } from "@/lib/blog";
import { SITE_URL } from "@/lib/routeMap";
import { buildRssFeed } from "./rssFeed";

describe("RSS feeds", () => {
  it("keeps the English channel and its article URLs separate from Korean", () => {
    const feed = buildRssFeed("en");

    expect(feed).toContain(`<atom:link href="${SITE_URL}/en/rss.xml" rel="self"`);
    expect(feed).toContain("<language>en-US</language>");
    for (const post of getAllPosts("en")) {
      expect(feed).toContain(`<link>${SITE_URL}/en/blog/${post.slug}</link>`);
      expect(feed).not.toContain(`<link>${SITE_URL}/blog/${post.slug}</link>`);
    }
  });
});
