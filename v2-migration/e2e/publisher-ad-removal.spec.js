import { test, expect } from "@playwright/test";
import { CONSENT_STORAGE_KEY } from "../src/lib/consent.js";
import { SOURCE_SURVEY_ANSWERED_KEY } from "./support/sourceSurvey.js";

const site = "http://growthoptplaybook.com";
const adHost = /(?:^|\.)(?:googlesyndication\.com|ads-partners\.coupang\.com|ads-partners\.coupangcdn\.com)$/;
const adElements = '[data-ad-slot], .partner-ad-rail, .partner-ad-disclosure, ins.adsbygoogle, meta[name="google-adsense-account"]';

for (const prefix of ["", "/en"]) {
  test(`home, article, dashboard, and privacy have no publisher ads (${prefix || "ko"})`, async ({ page, baseURL }) => {
    const adRequests = [];
    // Exercise the production hostname, with the local build and external requests intercepted.
    await page.routeWebSocket("**/*", socket => socket.close());
    let closing = false;
    const pending = new Set();
    async function serveLocal(route) {
      const url = new URL(route.request().url());
      if (adHost.test(url.hostname)) adRequests.push(url.href);
      if (closing || url.origin !== site) return route.abort();
      const response = await route.fetch({ url: baseURL + url.pathname + url.search, maxRedirects: 0 });
      await route.fulfill({ response });
    }
    await page.route("**/*", route => {
      const request = serveLocal(route);
      pending.add(request);
      return request.finally(() => pending.delete(request));
    });
    await page.addInitScript(([consent, survey]) => {
      localStorage.setItem(consent, "granted");
      localStorage.setItem(survey, "1");
    }, [CONSENT_STORAGE_KEY, SOURCE_SURVEY_ANSWERED_KEY]);

    try {
      for (const path of ["", "/blog/performance-marketing-metrics", "/dashboard", "/privacy"]) {
        const pathname = prefix + path || "/";
        const response = await page.goto(site + pathname);
        expect(response.status()).toBe(200);
        await expect(page.locator("main").first()).toBeVisible();
        await expect.poll(() => page.evaluate(() => Array.from(window.dataLayer || [])
          .some(entry => entry[1] === "page_view" && entry[2]?.page_path === location.pathname))).toBe(true);
        if (path.includes("/blog")) await expect(page.locator("#blog-practice")).toBeAttached();
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await expect(page.locator(adElements)).toHaveCount(0);
      }
      expect(adRequests).toEqual([]);
    } finally {
      closing = true;
      while (pending.size) await Promise.all([...pending]);
    }
  });
}
