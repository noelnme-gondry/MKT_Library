import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { expect, test } from "@playwright/test";
import { getBlogSeo } from "../src/lib/blogSeo.js";
import { SITE_URL } from "../src/lib/routeMap.js";

// 원고의 개념 계약에서 파생해 새 대상도 실제 SSR·브라우저 검증에 포함한다.
function contentCases(locale) {
  return ["glossary", "blog"].flatMap(kind => {
    const directory = path.join(process.cwd(), "content", `${kind}${locale === "en" ? "-en" : ""}`);
    return fs.readdirSync(directory).filter(file => file.endsWith(".md") && !file.startsWith("_")).flatMap(file => {
      const { data } = matter(fs.readFileSync(path.join(directory, file), "utf8"));
      if (data.draft || !data.searchTitleTerms?.length) return [];
      const slug = data.slug || file.replace(/\.md$/, "");
      const seo = kind === "blog" ? getBlogSeo(locale, slug, data) : null;
      return [{
        path: `/${locale === "en" ? "en/" : ""}${kind}/${slug}`,
        counterpart: `/${locale === "ko" ? "en/" : ""}${kind}/${slug}`,
        title: seo?.title || data.seoTitle,
        h1: seo?.h1 || data.term,
        concepts: data.searchTitleTerms,
      }];
    });
  });
}

for (const locale of ["ko", "en"]) {
  test(`search concepts reach server metadata and readable content (${locale})`, async ({ page }) => {
    const cases = contentCases(locale);
    expect(cases.length).toBeGreaterThanOrEqual(7);
    await page.route("**/*", route => ["localhost", "127.0.0.1"].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
    for (const item of cases) {
      const response = await page.goto(item.path);
      expect(response.status(), item.path).toBe(200);
      const server = await page.evaluate(raw => {
        const document = new DOMParser().parseFromString(raw, "text/html");
        return {
          title: document.querySelector("title")?.textContent,
          ogTitle: document.querySelector('meta[property="og:title"]')?.content,
          canonical: document.querySelector('link[rel="canonical"]')?.href,
          robots: document.querySelector('meta[name="robots"]')?.content,
          alternate: [...document.querySelectorAll('link[rel="alternate"][hreflang]')].map(link => link.href),
        };
      }, await response.text());
      expect(server.title, item.path).toContain(item.title);
      expect(server.ogTitle, item.path).toBe(item.title);
      expect(server.canonical).toBe(`${SITE_URL}${item.path}`);
      expect(server.robots).toMatch(/\bindex\b/);
      expect(server.robots).not.toContain("noindex");
      expect(server.alternate).toContain(`${SITE_URL}${item.counterpart}`);
      const main = page.locator("main");
      await expect(main.locator("h1")).toHaveText(item.h1);
      for (const concept of item.concepts) {
        expect(server.title.toLowerCase(), item.path).toContain(concept.toLowerCase());
        expect((await main.innerText()).toLowerCase(), item.path).toContain(concept.toLowerCase());
      }
      await page.evaluate(async () => { await document.fonts.ready; });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), item.path).toBe(true);
    }
  });
}
