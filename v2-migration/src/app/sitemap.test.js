import { describe, expect, it } from "vitest";
import sitemap from "./sitemap";
import { EN_READY_GUIDE_IDS, EN_READY_RESPONSE_SUBTOOL_IDS, EN_READY_TOOL_IDS, SITE_URL, idToPath } from "@/lib/routeMap";
import { getPublicRouteLastModified } from "@/lib/publicationDates";

describe("sitemap", () => {
  it("emits unique canonical URLs and only truthful modification dates", () => {
    const entries = sitemap();
    const urls = entries.map((entry) => entry.url);
    const now = Date.now() + 24 * 60 * 60 * 1000;

    expect(entries.length).toBeGreaterThan(20);
    expect(new Set(urls).size).toBe(urls.length);
    for (const entry of entries) {
      expect(entry.url.startsWith(SITE_URL)).toBe(true);
      if (entry.lastModified) {
        expect(entry.lastModified).toBeInstanceOf(Date);
        expect(Number.isNaN(entry.lastModified.getTime())).toBe(false);
        expect(entry.lastModified.getTime()).toBeLessThan(now);
      }
    }

    expect(entries.find((entry) => entry.url === `${SITE_URL}/privacy`)).not.toHaveProperty("lastModified");
    expect(entries.find((entry) => entry.url.includes("/blog/")).lastModified).toBeInstanceOf(Date);
  });

  it("contains both localized tool routes", () => {
    const urls = new Set(sitemap().map((entry) => entry.url));
    expect(urls.has(`${SITE_URL}/start`)).toBe(true);
    expect(urls.has(`${SITE_URL}/en/start`)).toBe(true);
    expect(urls.has(`${SITE_URL}/guide`)).toBe(true);
    expect(urls.has(`${SITE_URL}/en/guide`)).toBe(true);
    expect(urls.has(`${SITE_URL}/dashboard`)).toBe(true);
    expect(urls.has(`${SITE_URL}/en/dashboard`)).toBe(true);
    expect(urls.has(`${SITE_URL}/tools/experiment-analysis`)).toBe(true);
    expect(urls.has(`${SITE_URL}/en/tools/experiment-analysis`)).toBe(true);
  });

  it("emits accurate review or release dates for public guides and tools in both locales", () => {
    const entries = new Map(sitemap().map((entry) => [entry.url, entry]));
    const routeIds = [...EN_READY_GUIDE_IDS, ...EN_READY_TOOL_IDS, ...EN_READY_RESPONSE_SUBTOOL_IDS];

    for (const routeId of routeIds) {
      const lastModified = getPublicRouteLastModified(routeId);
      expect(lastModified, `Missing public date for ${routeId}`).toMatch(/^20\d{2}-\d{2}-\d{2}$/);
      expect(entries.get(`${SITE_URL}${idToPath(routeId)}`).lastModified.toISOString().slice(0, 10)).toBe(lastModified);
      expect(entries.get(`${SITE_URL}/en${idToPath(routeId)}`).lastModified.toISOString().slice(0, 10)).toBe(lastModified);
    }
  });

  it("contains localized legal and contact pages", () => {
    const urls = new Set(sitemap().map((entry) => entry.url));
    for (const path of ["/privacy", "/en/privacy", "/terms", "/en/terms", "/contact", "/en/contact"]) {
      expect(urls.has(`${SITE_URL}${path}`)).toBe(true);
    }
  });

  it("contains localized marketing metric calculators and diagnosis routes", () => {
    const urls = new Set(sitemap().map((entry) => entry.url));
    for (const path of [
      "/calculator",
      "/en/calculator",
      "/calculator/ltv-cac",
      "/en/calculator/ltv-cac",
      "/calculator/ab-test-sample-size",
      "/en/calculator/ab-test-sample-size",
      "/diagnose",
      "/en/diagnose",
    ]) {
      expect(urls.has(`${SITE_URL}${path}`)).toBe(true);
    }
  });
});

// sitemap의 standalone 목록은 손으로 나열돼 있다. 새 페이지를 app/에 추가하고
// 여기 추가하지 않으면 "색인 가능한데 sitemap에 없는" 페이지가 조용히 생긴다 —
// 목록끼리 대조하는 테스트로는 절대 못 잡는다(양쪽 다 같은 손으로 쓴 목록이라).
// 그래서 실제 디렉토리를 훑어 대조한다.
describe("sitemap covers every routable page in app/", () => {
  const fs = require("node:fs");
  const path = require("node:path");

  // catch-all([[...slug]]·[...slug])과 동적 세그먼트([slug])는 routeMap·발행
  // 콘텐츠에서 파생되므로 여기서 별도로 세지 않는다. noindex를 선언한 페이지도 제외.
  const NOINDEX_SEGMENTS = new Set(["growth-funnel", "share"]);

  function collectRoutes(dir, prefix = "") {
    const found = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const name = entry.name;
      if (name.startsWith("_") || name.startsWith("@")) continue;
      // route group `(ko)` `(en)`은 URL에 나타나지 않는다.
      const isGroup = name.startsWith("(") && name.endsWith(")");
      if (name.includes("[")) continue; // 동적 세그먼트는 파생 대상
      const nextPrefix = isGroup ? prefix : `${prefix}/${name}`;
      const child = path.join(dir, name);
      const hasPage = fs.existsSync(path.join(child, "page.js")) || fs.existsSync(path.join(child, "page.jsx"));
      if (hasPage && !isGroup) found.push(nextPrefix);
      found.push(...collectRoutes(child, nextPrefix));
    }
    return found;
  }

  it("has a sitemap entry for every static page directory", () => {
    const appDir = path.join(process.cwd(), "src", "app");
    const urls = new Set(sitemap().map((entry) => entry.url));
    const missing = collectRoutes(appDir)
      .filter((route) => !NOINDEX_SEGMENTS.has(route.split("/").pop()))
      .filter((route) => !urls.has(`${SITE_URL}${route}`));
    expect(missing).toEqual([]);
  });
});
