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
