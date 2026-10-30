import { test, expect } from "@playwright/test";
import { ADSTERRA_FORMATS, PARTNER_AD_FORMATS } from "../src/lib/partnerAds.js";
import { adsterraDocument, adsterraSource, ADSTERRA_FRAME_SANDBOX, partnerAdSource, PARTNER_FRAME_SANDBOX } from "../src/lib/partnerAdFrame.js";
import { ADSTERRA_FRAME_ORIGIN } from "../src/lib/adsterraHost.mjs";

test("partner creatives render without an SDK or size handshake and cannot read the app", async ({ page, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "The fixed creative sizes and origin isolation are checked together.");
  const hostOrigin = new URL(baseURL).origin;
  let blockedScripts = 0;
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.origin === hostOrigin) return route.fulfill({ contentType: "text/html", body: "<!doctype html><body>Private host document</body>" });
    if (url.origin === "https://ads-partners.coupang.com" && url.pathname === "/widgets.html") {
      return route.fulfill({ contentType: "text/html", body: `<!doctype html><body>Creative ${url.searchParams.get("id")}</body>` });
    }
    if (route.request().resourceType() === "script") blockedScripts += 1;
    return route.abort();
  });
  await page.goto("/__partner-ad-regression");
  for (const [format, { id, width, height }] of Object.entries(PARTNER_AD_FORMATS)) {
    // The old data-document wrapper stayed blank when its SDK was blocked.
    // Only the creative is available here; it sends no size/ready postMessage.
    const source = partnerAdSource(format);
    await page.evaluate(({ source, sandbox, width, height }) => {
      const frame = document.createElement("iframe");
      frame.id = "partner-ad-fixture";
      frame.src = source;
      frame.sandbox = sandbox;
      frame.width = width;
      frame.height = height;
      frame.style.border = "0";
      document.body.append(frame);
    }, { source, sandbox: PARTNER_FRAME_SANDBOX, width, height });
    const creative = page.frameLocator("#partner-ad-fixture");
    await expect(creative.getByText(`Creative ${id}`, { exact: true })).toBeVisible({ timeout: 4000 });
    await expect(creative.locator("iframe")).toHaveCount(0);
    expect(await page.locator("#partner-ad-fixture").boundingBox()).toMatchObject({ width, height });
    const isolatedFrame = page.frames().find(frame => frame.url() === source);
    expect(await isolatedFrame.evaluate(() => {
      let documentBlocked = false, storageBlocked = false;
      try { void parent.document.body; } catch { documentBlocked = true; }
      try { void parent.localStorage.length; } catch { storageBlocked = true; }
      return { documentBlocked, storageBlocked };
    })).toEqual({ documentBlocked: true, storageBlocked: true });
    await page.locator("#partner-ad-fixture").evaluate(frame => frame.remove());
  }
  expect(blockedScripts).toBe(0);
});

test("Adsterra scripts cannot read the parent document or its storage", async ({ page, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440");
  const origin = new URL(baseURL).origin;
  const requests = [];
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.origin === origin) return route.fulfill({ contentType: "text/html", body: "<!doctype html><body>Private analysis</body>" });
    if (url.origin === ADSTERRA_FRAME_ORIGIN) return route.fulfill({ contentType: "text/html", body: adsterraDocument(url.pathname.split("/").pop()) });
    if (url.origin === "https://bauval.org") {
      requests.push({ url: url.href, referrer: route.request().headers().referer });
      // The issued SDK consumes and deletes its global configuration in strict mode.
      // A top-level var makes that property non-configurable and stops rendering.
      return route.fulfill({ contentType: "application/javascript", body: `"use strict";
        window.consumedAdOptions = window.atOptions; delete window.atOptions;
        const child = document.createElement("iframe");
        child.width = window.consumedAdOptions.width; child.height = window.consumedAdOptions.height;
        document.body.append(child);
        child.contentWindow.document.open();
        child.contentWindow.document.write("<!doctype html><body>Mock creative</body>");
        child.contentWindow.document.close();` });
    }
    return route.abort();
  });
  await page.goto("/__ad-isolation?file=private.csv#secret");
  for (const [format, size] of Object.entries(ADSTERRA_FORMATS)) {
    await page.evaluate(({ source, sandbox, size }) => {
      const frame = document.createElement("iframe");
      frame.id = "ad-fixture"; frame.src = source; frame.sandbox = sandbox;
      frame.referrerPolicy = "origin"; frame.width = size.width; frame.height = size.height;
      frame.style.border = "0"; document.body.append(frame);
    }, { source: adsterraSource(format), sandbox: ADSTERRA_FRAME_SANDBOX, size });
    await expect(page.frameLocator("#ad-fixture").frameLocator("iframe").getByText("Mock creative")).toBeVisible();
    const isolated = await page.locator("#ad-fixture").elementHandle().then(handle => handle.contentFrame());
    const boundary = await isolated.evaluate(() => {
      let documentBlocked = false, storageBlocked = false;
      try { void parent.document.body; } catch { documentBlocked = true; }
      try { void parent.localStorage.length; } catch { storageBlocked = true; }
      return { documentBlocked, storageBlocked, options: window.consumedAdOptions, optionsDeleted: !Object.hasOwn(window, "atOptions"), referrer: document.referrer, baseUri: document.baseURI };
    });
    expect(boundary).toMatchObject({ documentBlocked: true, storageBlocked: true, optionsDeleted: true, options: { key: size.key, format: "iframe", width: size.width, height: size.height, params: {} } });
    expect(["", `${origin}/`]).toContain(boundary.referrer);
    // srcdoc inherits the parent URL even with an opaque sandbox unless its base is fixed.
    expect(boundary.baseUri).not.toMatch(/__ad-isolation|private|secret/);
    expect(await page.locator("#ad-fixture").boundingBox()).toMatchObject({ width: size.width, height: size.height });
    await page.locator("#ad-fixture").evaluate(frame => frame.remove());
  }
  expect(requests).toHaveLength(3);
  expect(JSON.stringify(requests)).not.toMatch(/private|secret/);
  for (const request of requests) expect([undefined, `${ADSTERRA_FRAME_ORIGIN}/`]).toContain(request.referrer);
});
