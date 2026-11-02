import { test, expect } from "@playwright/test";
import { PARTNER_AD_FORMATS } from "../src/lib/partnerAds.js";
import { partnerAdSource, PARTNER_FRAME_SANDBOX } from "../src/lib/partnerAdFrame.js";

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
