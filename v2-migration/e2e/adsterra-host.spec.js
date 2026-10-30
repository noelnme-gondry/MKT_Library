import { test, expect } from "@playwright/test";
import { ADSTERRA_FORMATS } from "../src/lib/partnerAds.js";
import { adsterraSource, ADSTERRA_FRAME_SANDBOX } from "../src/lib/partnerAdFrame.js";
import { ADSTERRA_FRAME_ORIGIN } from "../src/lib/adsterraHost.mjs";
import { SITE_URL } from "../src/lib/routeMap.js";

test("actual ad endpoint preserves nested writes and cross-origin boundaries", async ({ page, baseURL, request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440");
  const sdkRequests = [];
  await page.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.origin === SITE_URL || url.origin === "https://untrusted.example") return route.fulfill({ contentType: "text/html", body: "<!doctype html><body>Private app fixture</body>" });
    if (url.origin === ADSTERRA_FRAME_ORIGIN) {
      const response = await request.get(`${baseURL}${url.pathname}`, { headers: { host: url.host }, maxRedirects: 0 });
      expect(response.status()).toBe(200);
      expect(response.headers()["x-frame-options"]).toBeUndefined();
      return route.fulfill({ response });
    }
    if (url.origin === "https://bauval.org") {
      sdkRequests.push({ url: url.href, referrer: route.request().headers().referer || "" });
      return route.fulfill({ contentType: "application/javascript", body: `"use strict";const options=window.atOptions;delete window.atOptions;const f=document.createElement('iframe');f.width=options.width;f.height=options.height;f.style.border='0';document.body.append(f);f.contentWindow.document.open();f.contentWindow.document.write('<body>Nested creative</body>');f.contentWindow.document.close();` });
    }
    return route.abort();
  });
  await page.goto(`${SITE_URL}/analysis?file=private.csv#secret`);
  for (const format of Object.keys(ADSTERRA_FORMATS)) {
    await page.evaluate(({ src, sandbox }) => {
      document.querySelector("iframe")?.remove();
      const f = document.createElement("iframe"); f.src = src; f.sandbox = sandbox; f.referrerPolicy = "origin";
      document.body.append(f);
    }, { src: adsterraSource(format), sandbox: ADSTERRA_FRAME_SANDBOX });
    await expect(page.frameLocator("iframe").frameLocator("iframe").getByText("Nested creative")).toBeVisible();
    const frame = page.frames().find(f => f.url() === adsterraSource(format));
    expect(await frame.evaluate(() => {
      let documentBlocked = false, storageBlocked = false;
      try { void parent.document.body; } catch { documentBlocked = true; }
      try { void parent.localStorage.length; } catch { storageBlocked = true; }
      return { documentBlocked, storageBlocked, referrer: document.referrer };
    })).toEqual({ documentBlocked: true, storageBlocked: true, referrer: `${SITE_URL}/` });
  }
  expect(sdkRequests).toHaveLength(Object.keys(ADSTERRA_FORMATS).length);
  expect(JSON.stringify(sdkRequests)).not.toMatch(/private|secret/);
  for (const r of sdkRequests) expect(["", `${ADSTERRA_FRAME_ORIGIN}/`]).toContain(r.referrer);
  const denied = await request.get(`${baseURL}/ad-frame/compact`);
  expect(denied.status()).toBe(404);
  expect(await denied.text()).not.toContain("script");
  const ordinary = await request.get(`${baseURL}/start`);
  expect(ordinary.headers()["x-frame-options"]).toBe("SAMEORIGIN");
  expect(ordinary.headers()["content-security-policy"]).toBe("frame-ancestors 'self'");
  await page.goto("https://untrusted.example/");
  const blocked = page.waitForEvent("console", { predicate: message => /frame-ancestors/.test(message.text()) });
  await page.evaluate(src => { const f = document.createElement("iframe"); f.src = src; document.body.append(f); }, adsterraSource("compact"));
  await blocked;
  expect(sdkRequests).toHaveLength(Object.keys(ADSTERRA_FORMATS).length);
});
