import { describe, expect, it } from "vitest";
import sitemap from "./sitemap";
import { SITE_URL } from "@/lib/routeMap";

describe("sitemap", () => {
  it("emits unique canonical URLs with valid modification dates", () => {
    const entries = sitemap();
    const urls = entries.map((entry) => entry.url);
    const now = Date.now() + 24 * 60 * 60 * 1000;

    expect(entries.length).toBeGreaterThan(20);
    expect(new Set(urls).size).toBe(urls.length);
    for (const entry of entries) {
      expect(entry.url.startsWith(SITE_URL)).toBe(true);
      expect(entry.lastModified).toBeInstanceOf(Date);
      expect(Number.isNaN(entry.lastModified.getTime())).toBe(false);
      expect(entry.lastModified.getTime()).toBeLessThan(now);
    }
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
