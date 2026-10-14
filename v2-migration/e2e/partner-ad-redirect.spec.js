import { test, expect } from "@playwright/test";
import { PARTNER_AD_FORMATS } from "../src/lib/partnerAds.js";
import { partnerAdDocument, PARTNER_FRAME_SANDBOX } from "../src/lib/partnerAdFrame.js";

test("partner SDK's redirected CDN origin is allowed inside an isolated frame", async ({ page, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "CSP and origin isolation do not depend on viewport size.");
  const hostOrigin = new URL(baseURL).origin;
  const sdkUrl = "https://ads-partners.coupang.com/g.js";
  const cdnUrl = "https://partners.coupangcdn.com/widget/g/redirect-fixture.js";
  let sdkRequests = 0;
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.origin === hostOrigin) return route.fulfill({ contentType: "text/html", body: "<!doctype html><body>Private host document</body>" });
    if (url.href === cdnUrl) {
      sdkRequests += 1;
      return route.fulfill({ contentType: "application/javascript", body: `
      window.PartnersCoupang = { G: function(config) {
        const frame = document.createElement('iframe');
        frame.src = 'https://ads-partners.coupang.com/widgets.html?id=' + config.id;
        frame.width = config.width;
        frame.height = config.height;
        document.body.append(frame);
      }};
    ` });
    }
    if (url.origin === "https://ads-partners.coupang.com" && url.pathname === "/widgets.html") {
      return route.fulfill({ contentType: "text/html", body: `<!doctype html><body>Creative ${url.searchParams.get("id")}</body>` });
    }
    return route.abort();
  });
  await page.goto("/__partner-ad-regression");
  for (const [format, { id, width, height }] of Object.entries(PARTNER_AD_FORMATS)) {
    // Real g.js returns 302 to this CDN. Exercise the final origin with an offline
    // fixture: Playwright routing does not intercept subsequent redirect requests.
    // Mocking SDK code at g.js itself previously hid the production CSP failure.
    const document = partnerAdDocument(format);
    expect(document).toContain(`src="${sdkUrl}"`);
    const source = `data:text/html;charset=utf-8,${encodeURIComponent(document.replace(`src="${sdkUrl}"`, `src="${cdnUrl}"`))}`;
    await page.evaluate(({ source, sandbox, width, height }) => {
      const frame = document.createElement("iframe");
      frame.id = "partner-ad-fixture";
      frame.src = source;
      frame.sandbox = sandbox;
      frame.width = width;
      frame.height = height;
      document.body.append(frame);
    }, { source, sandbox: PARTNER_FRAME_SANDBOX, width, height });
    const outer = page.frameLocator("#partner-ad-fixture");
    await expect(outer.frameLocator("iframe").getByText(`Creative ${id}`, { exact: true })).toBeVisible({ timeout: 4000 });
    await expect(outer.locator("iframe")).toHaveAttribute("width", String(width));
    await expect(outer.locator("iframe")).toHaveAttribute("height", String(height));
    const isolatedFrame = page.frames().find(frame => frame.url().startsWith("data:"));
    expect(await isolatedFrame.evaluate(() => {
      let documentBlocked = false, storageBlocked = false;
      try { void parent.document.body; } catch { documentBlocked = true; }
      try { void localStorage.length; } catch { storageBlocked = true; }
      return { documentBlocked, storageBlocked };
    })).toEqual({ documentBlocked: true, storageBlocked: true });
    await page.locator("#partner-ad-fixture").evaluate(frame => frame.remove());
  }
  expect(sdkRequests).toBe(Object.keys(PARTNER_AD_FORMATS).length);
});
