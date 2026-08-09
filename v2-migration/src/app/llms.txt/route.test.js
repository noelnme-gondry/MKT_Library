import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { getAllPosts } from "@/lib/blog";
import { getAllCalculators } from "@/lib/calculators";
import { getAllTerms } from "@/lib/glossary";
import { ROUTES, SITE_URL, hasEnVersion, isRouteIndexable } from "@/lib/routeMap";
import { getRouteSeo } from "@/lib/routeSeo";
import { readSopData } from "@/lib/sopData";
import { GET, buildLlmsText, dynamic } from "./route";

const markdownLinks = (text) => [...text.matchAll(/\[[^\]]+\]\((https:\/\/[^)]+)\)/g)].map((match) => match[1]);

const indexableAnalysisRoutes = (locale) => ROUTES
  .filter((route) => isRouteIndexable(route))
  .filter((route) => route.slug === "/dashboard" || route.slug.startsWith("/tools/") || route.slug.startsWith("/content/"))
  .filter((route) => locale !== "en" || hasEnVersion(route.id))
  .filter((route) => getRouteSeo(route.id, locale));

const indexableGuideRoutes = (locale) => ROUTES
  .filter((route) => isRouteIndexable(route))
  .filter((route) => route.slug.startsWith("/guide/"))
  .filter((route) => locale !== "en" || hasEnVersion(route.id))
  .filter((route) => readSopData(route.id, locale)?.title);

describe("llms.txt", () => {
  it("publishes UTF-8 Markdown with the browser-only privacy promise", async () => {
    const response = GET();
    const bytes = new Uint8Array(await response.arrayBuffer());
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);

    expect(dynamic).toBe("force-static");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(text.startsWith("# Growth Opt Playbook\n")).toBe(true);
    expect(text).toContain("내 CSV로 분석 시작");
    expect(text).toContain("processed in the user's browser");
    expect(text).not.toContain("�");
    expect(text.endsWith("\n")).toBe(true);
    expect(text).toBe(buildLlmsText());
  });

  it("uses unique same-origin absolute links that resolve to canonical public pages", () => {
    const links = markdownLinks(buildLlmsText());
    const sitemapUrls = new Set(sitemap().map((entry) => entry.url));
    const machineIndexes = new Set([`${SITE_URL}/sitemap.xml`, `${SITE_URL}/rss.xml`, `${SITE_URL}/en/rss.xml`]);
    const expectedLinkCount = 10
      + indexableAnalysisRoutes("ko").length
      + indexableAnalysisRoutes("en").length
      + indexableGuideRoutes("ko").length
      + indexableGuideRoutes("en").length
      + getAllPosts("ko").length
      + getAllPosts("en").length
      + getAllCalculators("ko").length
      + getAllCalculators("en").length
      + getAllTerms("ko").length
      + getAllTerms("en").length
      + machineIndexes.size;

    expect(links.length).toBe(expectedLinkCount);
    expect(new Set(links).size).toBe(links.length);
    for (const link of links) {
      expect(link.startsWith(`${SITE_URL}/`)).toBe(true);
      if (!machineIndexes.has(link)) expect(sitemapUrls.has(link), `Missing from sitemap: ${link}`).toBe(true);
    }
  });

  it("includes indexable analysis routes and excludes previews", () => {
    const text = buildLlmsText();
    const analysisRoutes = indexableAnalysisRoutes("ko");

    for (const route of analysisRoutes) {
      expect(text).toContain(`](${SITE_URL}${route.slug})`);
      if (hasEnVersion(route.id)) expect(text).toContain(`](${SITE_URL}/en${route.slug})`);
    }
    for (const route of ROUTES.filter((item) => item.publication === "preview")) {
      expect(text).not.toContain(`${SITE_URL}${route.slug}`);
    }
  });

  it("derives every published KR and EN article, calculator, and glossary link from its registry", () => {
    const text = buildLlmsText();
    for (const locale of ["ko", "en"]) {
      const prefix = locale === "en" ? "/en" : "";
      for (const post of getAllPosts(locale)) expect(text).toContain(`](${SITE_URL}${prefix}/blog/${post.slug})`);
      for (const calculator of getAllCalculators(locale)) expect(text).toContain(`](${SITE_URL}${prefix}/calculator/${calculator.slug})`);
      for (const term of getAllTerms(locale)) expect(text).toContain(`](${SITE_URL}${prefix}/glossary/${term.slug})`);
    }
  });
});
