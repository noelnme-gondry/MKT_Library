import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import HomeReading from "./HomeReading";
import { getAllPosts } from "@/lib/blog";

describe("home reading previews", () => {
  it.each(["ko", "en"])("links published articles through their own localized figures (%s)", (locale) => {
    const { container } = render(<HomeReading locale={locale} />);
    const posts = getAllPosts(locale);
    const links = [...container.querySelectorAll(".home-reading-list__articles a")];
    expect(links).toHaveLength(3);
    for (const link of links) {
      const post = posts.find((item) => link.getAttribute("href").endsWith(`/blog/${item.slug}`));
      expect(post).toBeTruthy();
      expect(link.querySelector("h3").textContent).toBe(post.title);
      const src = link.querySelector("img").getAttribute("src");
      expect(src).toContain(locale === "en" ? "/blog-assets-en/" : "/blog-assets/");
      expect(post.html).toContain(src);
      expect(existsSync(path.join(process.cwd(), "public", src))).toBe(true);
    }
    expect(container.querySelector('a[href$="/guide"]')).toBeTruthy();
  });
});
