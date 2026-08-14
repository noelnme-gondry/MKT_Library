import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { getAllPosts } from "@/lib/blog";
import { getAllCalculators } from "@/lib/calculators";
import { getAllTerms } from "@/lib/glossary";
import { getBrandFacts, getBrandLimits } from "@/lib/brandFacts";
import { COMPARE_SLUGS } from "@/lib/compareContent";
import { ROUTES, SITE_URL, hasEnVersion, isRouteIndexable } from "@/lib/routeMap";
import { getRouteSeo } from "@/lib/routeSeo";
import { readSopData } from "@/lib/sopData";
import { findMeta } from "@/store/useDataStore";
import { GET, buildLlmsText, dynamic } from "./route";

const markdownLinks = (text) => [...text.matchAll(/\[[^\]]+\]\((https:\/\/[^)]+)\)/g)].map((match) => match[1]);

const indexableAnalysisRoutes = (locale) => ROUTES
  .filter((route) => isRouteIndexable(route))
  .filter((route) => route.slug === "/dashboard" || route.slug.startsWith("/tools/") || route.slug.startsWith("/content/"))
  .filter((route) => locale !== "en" || hasEnVersion(route.id))
  .filter((route) => getRouteSeo(route.id, locale));

// KO SOP JSON에는 title 필드가 아예 없다(EN만 있음) — 그래서 readSopData(...)?.title로
// 거르면 KO 가이드가 2개도 아닌 **0개**가 된다. 기대값 계산이 구현과 같은 버그를 갖고
// 있어서 llms.txt의 KO 가이드 섹션이 빈 채로 통과했다(감사 P1-8).
// 이제 제목은 IA(findMeta)에서 오므로 인덱싱 가능한 가이드 라우트 전체가 기대값이다.
const indexableGuideRoutes = (locale) => ROUTES
  .filter((route) => isRouteIndexable(route))
  .filter((route) => route.slug.startsWith("/guide/"))
  .filter((route) => locale !== "en" || hasEnVersion(route.id))
  .filter((route) => readSopData(route.id, locale)?.title || findMeta(route.id)?.title);

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
    // 프라이버시 약속은 이제 brandFacts SSOT에서 파생된다. 문자열을 여기 다시 적으면
    // SSOT를 고쳐도 테스트가 옛 문장을 통과시킨다 — 사실 자체를 조회해서 대조한다.
    const privacy = getBrandFacts("en").find((fact) => fact.id === "privacy");
    expect(text).toContain(privacy.claim);
    expect(text).toContain(privacy.detail);
    // 한계도 같은 급으로 실려야 인용될 때 과장되지 않는다.
    for (const limit of getBrandLimits("en")) expect(text).toContain(limit.claim);
    expect(text).not.toContain("�");
    expect(text.endsWith("\n")).toBe(true);
    expect(text).toBe(buildLlmsText());
  });

  it("uses unique same-origin absolute links that resolve to canonical public pages", () => {
    const links = markdownLinks(buildLlmsText());
    const sitemapUrls = new Set(sitemap().map((entry) => entry.url));
    const machineIndexes = new Set([`${SITE_URL}/sitemap.xml`, `${SITE_URL}/rss.xml`, `${SITE_URL}/en/rss.xml`]);
    const expectedLinkCount = 12
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
      + COMPARE_SLUGS.length * 2
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

// 감사 P1-8: KO 운영가이드 섹션이 0건으로 나가던 회귀 가드.
// public/content/pages에 KO JSON이 2개뿐이라 sop?.title만 보면 13개가 사라진다.
describe("llms.txt · 가이드 로케일 대칭", () => {
  it("KO와 EN 운영가이드 개수가 같다", async () => {
    const body = buildLlmsText();
    const koSection = body.split("## Operating guides — Korean")[1]?.split("\n## ")[0] || "";
    const enSection = body.split("## Operating guides — English")[1]?.split("\n## ")[0] || "";
    const koCount = (koSection.match(/^- \[/gm) || []).length;
    const enCount = (enSection.match(/^- \[/gm) || []).length;
    expect(koCount).toBeGreaterThan(0);
    expect(koCount).toBe(enCount);
  });
});
