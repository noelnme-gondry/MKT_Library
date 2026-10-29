import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { SOURCE_SURVEY_ANSWERED_KEY } from "./support/sourceSurvey.js";
import { CONSENT_STORAGE_KEY } from "../src/lib/consent.js";
import { PARTNER_AD_PLACEMENTS, pageAdPlacement } from "../src/lib/partnerAds.js";

// 운영 호스트 분기는 그대로 실행하되 모든 요청은 로컬 빌드 또는 차단으로 끝낸다.
// 실제 쿠팡/GA 요청·광고 클릭 없음. 앱이 만드는 표준 gtag/dataLayer 큐를 관측한다.
const virtualOrigin = "http://growthoptplaybook.com";
const finishRequests = new WeakMap();
const adEvents = page => page.evaluate(() => (window.dataLayer || [])
  .filter(entry => entry[0] === "event" && entry[1] === "ad_slot_view").map(entry => entry[2]));

test.beforeEach(async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const pending = new Set();
  let closing = false;
  finishRequests.set(page, async () => {
    closing = true;
    while (pending.size) await Promise.all([...pending]);
  });
  await page.route("**/*", route => {
    const handle = async () => {
      const url = new URL(route.request().url());
      if (closing || url.origin !== virtualOrigin) return route.abort();
      const response = await route.fetch({ url: `${baseURL}${url.pathname}${url.search}`, maxRedirects: 0 });
      await route.fulfill({ response });
    };
    const request = handle();
    pending.add(request);
    return request.finally(() => pending.delete(request));
  });
  await page.addInitScript(([consentKey, surveyKey]) => {
    if (window.top !== window) return;
    localStorage.setItem(consentKey, "granted");
    localStorage.setItem(surveyKey, "1");
  }, [CONSENT_STORAGE_KEY, SOURCE_SURVEY_ANSWERED_KEY]);
});

test.afterEach(async ({ page }) => {
  // 새 요청은 차단하고 이미 시작한 로컬 prefetch만 마저 처리한다.
  // 실패를 숨기지 않으며 외부 차단 route는 context가 닫힐 때까지 유지한다.
  await finishRequests.get(page)();
  finishRequests.delete(page);
});

async function reachSlot(page, slot, pathname, locale) {
  const frame = page.locator(`[data-ad-slot="${slot}"] iframe`);
  await expect(frame).toBeVisible();
  const format = await frame.getAttribute("data-ad-format");
  await frame.scrollIntoViewIfNeeded();
  await expect.poll(async () => (await adEvents(page)).filter(event => event.ad_slot === slot && event.page_path === pathname).length).toBe(1);
  const event = (await adEvents(page)).find(event => event.ad_slot === slot && event.page_path === pathname);
  expect(event).toEqual({ ad_provider: "coupang", ad_slot: slot, ad_format: format, locale,
    page_path: pathname, ad_measurement_version: 1, send_to: "G-DK12TNR0GW",
    page_location: `${virtualOrigin}${pathname}`, page_referrer: "", page_title: "" });
  expect(PARTNER_AD_PLACEMENTS[slot].formats).toContain(format);
  expect(JSON.stringify(event)).not.toMatch(/private|secret|\?|#/);
}

for (const locale of ["ko", "en"]) {
  const prefix = locale === "en" ? "/en" : "";
  for (const route of ["/", "/blog/correlation-vs-causation", "/guide"]) {
    const pathname = `${prefix}${route === "/" ? "" : route}` || "/";
    test(`real page slots, blocked ad frames and safe payload: ${locale} ${route}`, async ({ page }) => {
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.goto(`${virtualOrigin}${pathname}?file=private.csv#secret`);
      await reachSlot(page, "site-rail", pathname, locale);
      await reachSlot(page, pageAdPlacement(pathname), pathname, locale);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.locator(`[data-ad-slot="${pageAdPlacement(pathname)}"] iframe`).scrollIntoViewIfNeeded();
      expect((await adEvents(page)).filter(event => event.page_path === pathname)).toHaveLength(2);
      expect(errors).toEqual([]);
    });
  }

  test(`SPA shared rail counts each entry and revisit (${locale})`, async ({ page }) => {
    const home = prefix || "/";
    const guide = `${prefix}/guide`;
    await page.goto(`${virtualOrigin}${home}`);
    await reachSlot(page, "site-rail", home, locale);
    const link = page.locator(`a[href="${guide}"]`).filter({ visible: true }).first();
    await link.click();
    await expect(page).toHaveURL(`${virtualOrigin}${guide}`);
    await reachSlot(page, "site-rail", guide, locale);
    await page.goBack();
    await expect(page).toHaveURL(`${virtualOrigin}${home}`);
    await page.locator('[data-ad-slot="site-rail"] iframe').scrollIntoViewIfNeeded();
    await expect.poll(async () => (await adEvents(page)).filter(event => event.ad_slot === "site-rail" && event.page_path === home).length).toBe(2);
  });

  for (const failedTransport of [false, true]) test(`CSV → analysis → result → PNG, ads blocked, transport ${failedTransport ? "throws" : "queues"} (${locale})`, async ({ page }) => {
    test.setTimeout(120_000);
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    const entitlement = { plan: "paid", account: true, expiresAt: Date.now() + 86400000, offlineUntil: Date.now() + 3600000 };
    await page.route("**/api/account/session", route => route.fulfill({ json: { enabled: true, account: { id: "test-owner", email: "test@example.com" }, entitlement } }));
    await page.route("**/api/payments/access", route => route.fulfill({ json: { entitlement } }));
    const pathname = `${prefix}/tools/budget-allocation`;
    await page.goto(`${virtualOrigin}${pathname}?file=private.csv#secret`);
    const uploader = page.locator('.csv-uploader[data-hydrated="true"]');
    await expect(uploader).toBeVisible();
    if (failedTransport) await page.evaluate(() => {
      const original = window.gtag;
      window.__failedAdAttempts = 0;
      window.gtag = function (...args) {
        if (args[0] === "event" && args[1] === "ad_slot_view") {
          window.__failedAdAttempts++;
          throw new Error("ad transport unavailable");
        }
        return original.apply(this, args);
      };
    });
    await uploader.locator('input[type="file"][accept*="csv"]').setInputFiles(path.join(process.cwd(), "e2e/fixtures/efficiency.csv"));
    await expect(uploader.locator(".file-state")).toBeVisible();
    await uploader.locator('[data-currency-scope="declare"]').getByRole("button", { name: /^(원 ₩|KRW ₩)$/ }).click();
    const confirmations = page.getByRole("button", { name: locale === "en" ? "Confirm" : "확인", exact: true });
    while (await confirmations.count()) await confirmations.first().click();
    await uploader.getByRole("button", { name: locale === "en" ? "Analyze data" : "데이터 분석하기", exact: true }).click();
    await page.getByRole("radio", { name: locale === "en" ? "Changes" : "변경 요약", exact: true }).click();
    const figure = page.locator(".tool-core-figure").first();
    await expect(figure).toBeVisible();
    if (failedTransport) {
      await page.locator('[data-ad-slot="analysis-bottom"] iframe').scrollIntoViewIfNeeded();
      await expect.poll(() => page.evaluate(() => window.__failedAdAttempts)).toBeGreaterThan(0);
      expect((await adEvents(page)).filter(event => event.ad_slot === "analysis-bottom")).toEqual([]);
    } else {
      await reachSlot(page, "analysis-bottom", pathname, locale);
    }
    const downloadPromise = page.waitForEvent("download");
    await figure.getByRole("button", { name: locale === "en" ? "Download PNG" : "PNG 받기" }).click();
    const download = await downloadPromise;
    const bytes = readFileSync(await download.path());
    expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(bytes.readUInt32BE(16)).toBeGreaterThan(400);
    const events = await page.evaluate(() => (window.dataLayer || []).filter(entry => entry[0] === "event").map(entry => entry[1]));
    expect(events).toEqual(expect.arrayContaining(["data_import_success", "analysis_started", "analysis_completed", "result_downloaded"]));
    expect(errors).toEqual([]);
  });
}

test("actual responsive geometry hides narrow slots and dedupes format switches", async ({ page }) => {
  await page.setViewportSize({ width: 319, height: 800 });
  await page.goto(virtualOrigin);
  await expect(page.locator("footer")).toBeAttached();
  await expect(page.locator('[data-ad-slot="home-intro"]')).toBeHidden();
  expect(await adEvents(page)).toEqual([]);
  await page.setViewportSize({ width: 390, height: 800 });
  await reachSlot(page, "home-intro", "/", "ko");
  expect((await adEvents(page))[0].ad_format).toBe("compact");
  await page.setViewportSize({ width: 1600, height: 1000 });
  await expect(page.locator('[data-ad-slot="home-intro"] iframe')).toHaveAttribute("data-ad-format", "wide");
  await page.locator('[data-ad-slot="home-intro"] iframe').scrollIntoViewIfNeeded();
  expect((await adEvents(page)).filter(event => event.ad_slot === "home-intro")).toHaveLength(1);
});
