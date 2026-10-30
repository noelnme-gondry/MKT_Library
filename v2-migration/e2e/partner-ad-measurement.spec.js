import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { devices, expect, test } from "@playwright/test";
import { SOURCE_SURVEY_ANSWERED_KEY } from "./support/sourceSurvey.js";
import { CONSENT_STORAGE_KEY } from "../src/lib/consent.js";
import { ADSTERRA_DISCLOSURE, ADSTERRA_FORMATS, PARTNER_AD_DISCLOSURE, PARTNER_AD_FORMATS, PARTNER_AD_PLACEMENTS, PARTNER_AD_RAIL_MIN_WIDTH, pageAdPlacement } from "../src/lib/partnerAds.js";
import { adsterraDocument, adsterraSource, partnerAdSource } from "../src/lib/partnerAdFrame.js";
import { ADSTERRA_FRAME_ORIGIN } from "../src/lib/adsterraHost.mjs";

// 운영 호스트 분기는 그대로 실행하되 모든 요청은 로컬 빌드 또는 차단으로 끝낸다.
// 실제 광고/GA 요청·광고 클릭 없음. 앱이 만드는 표준 gtag/dataLayer 큐를 관측한다.
const virtualOrigin = "http://growthoptplaybook.com";
const finishRequests = new WeakMap();
const adEvents = page => page.evaluate(() => (window.dataLayer || [])
  .filter(entry => entry[0] === "event" && entry[1] === "ad_slot_view").map(entry => entry[2]));

test.beforeEach(async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  // dev HMR도 운영 도메인으로 나가지 않도록 차단한다. live 분기 검사는 빌드본에서 실행한다.
  await page.routeWebSocket("**/*", socket => socket.close());
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
    if (!localStorage.getItem(consentKey)) localStorage.setItem(consentKey, "granted");
    localStorage.setItem(surveyKey, "1");
  }, [CONSENT_STORAGE_KEY, SOURCE_SURVEY_ANSWERED_KEY]);
});

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status !== testInfo.expectedStatus) await testInfo.attach("ad-geometry", { contentType: "application/json", body: JSON.stringify(await page.evaluate(() => ({
    viewport: innerWidth, clientWidth: document.documentElement.clientWidth,
    nodes: [...document.querySelectorAll('.main, [data-ad-slot], .partner-ad-anchor')].map(n => ({ tag: n.tagName, class: n.className, hidden: n.hidden, style: n.getAttribute('style'), box: n.getBoundingClientRect().toJSON(), parentWidth: n.parentElement.clientWidth, text: n.dataset.adSlot })),
  })), null, 2) });
  // 새 요청은 차단하고 이미 시작한 로컬 prefetch만 마저 처리한다.
  // 실패를 숨기지 않으며 외부 차단 route는 context가 닫힐 때까지 유지한다.
  await finishRequests.get(page)();
  finishRequests.delete(page);
});

async function reachSlot(page, slot, pathname, locale, firstFormat) {
  const frame = page.locator(`[data-ad-slot="${slot}"] iframe`);
  await expect(frame).toHaveCount(1);
  await expect(frame).toBeVisible();
  const format = await frame.getAttribute("data-ad-format");
  const adsterra = PARTNER_AD_PLACEMENTS[slot].provider === "adsterra";
  await expect(frame).toHaveAttribute("data-ad-provider", adsterra ? "adsterra" : "coupang");
  await expect(frame).toHaveAttribute("src", adsterra ? adsterraSource(format) : partnerAdSource(format));
  expect(await frame.getAttribute("srcdoc")).toBeNull();
  const size = (adsterra ? ADSTERRA_FORMATS : PARTNER_AD_FORMATS)[format];
  expect(await frame.boundingBox()).toMatchObject({ width: size.width, height: size.height });
  await expect(page.locator(`[data-ad-slot="${slot}"] .partner-ad-preview__note`)).toHaveText((adsterra ? ADSTERRA_DISCLOSURE : PARTNER_AD_DISCLOSURE)[locale]);
  await frame.scrollIntoViewIfNeeded();
  await expect.poll(async () => (await adEvents(page)).filter(event => event.ad_slot === slot && event.page_path === pathname).length).toBe(1);
  const event = (await adEvents(page)).find(event => event.ad_slot === slot && event.page_path === pathname);
  expect(event).toEqual({ ad_provider: PARTNER_AD_PLACEMENTS[slot].provider, ad_slot: slot, ad_format: firstFormat || format, locale,
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

  test(`privacy disclosure and live opt-out remove both providers (${locale})`, async ({ page }) => {
    const pathname = `${prefix}/privacy`;
    await page.goto(`${virtualOrigin}${pathname}`);
    await expect(page.locator("main")).toContainText("Adsterra");
    await expect(page.locator("main")).toContainText(locale === "en" ? "Coupang Partners" : "쿠팡 파트너스");
    await reachSlot(page, "page-bottom", pathname, locale);
    await page.getByRole("button", { name: locale === "en" ? "Turn measurement off" : "측정 끄기", exact: true }).click();
    await expect(page.locator("[data-ad-slot]")).toHaveCount(0);
    await page.goto(`${virtualOrigin}${prefix}/tools/budget-allocation`);
    await expect(page.locator('.csv-uploader[data-hydrated="true"]')).toBeVisible();
    await expect(page.locator("[data-ad-slot]")).toHaveCount(0);
    expect(await adEvents(page)).toEqual([]);
  });

  for (const failedTransport of [false, true]) test(`CSV → analysis → result → PNG, ads blocked, transport ${failedTransport ? "throws" : "queues"} (${locale})`, async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const viewportWidth = testInfo.project.name === "mobile-320" ? 390 : 1600;
    await page.setViewportSize({ width: viewportWidth, height: 1000 });
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
    expect(await page.evaluate(() => innerWidth)).toBe(viewportWidth);
    if (failedTransport) {
      await page.locator('[data-ad-slot="analysis-bottom"] iframe').scrollIntoViewIfNeeded();
      await expect.poll(() => page.evaluate(() => window.__failedAdAttempts)).toBeGreaterThan(0);
      expect((await adEvents(page)).filter(event => event.ad_slot === "analysis-bottom")).toEqual([]);
    } else {
      await reachSlot(page, "analysis-bottom", pathname, locale);
      await reachSlot(page, "site-rail", pathname, locale);
      await expect(page.locator('[data-ad-slot="site-rail"] iframe')).toHaveAttribute("data-ad-format", viewportWidth < 1180 ? "compact" : "rail");
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

test("actual responsive geometry hides narrow slots and dedupes format switches", async ({ page }, testInfo) => {
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
  for (const width of [320, 390, 980, 1440, 1600]) {
    await page.setViewportSize({ width, height: 1000 });
    // The contract uses available main width; a collapsed sidebar changes it.
    await expect.poll(() => page.locator('[data-ad-slot="site-rail"]').evaluate((slot, minWidth) => {
      const parent = slot.parentElement;
      const style = getComputedStyle(parent);
      const available = parent.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0);
      return Boolean(slot.querySelector("iframe")) === (available >= minWidth);
    }, PARTNER_AD_RAIL_MIN_WIDTH)).toBe(true);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if ([390, 1440].includes(width)) {
      await page.locator('[data-ad-slot="home-intro"] iframe').scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath(`home-${width}.png`) });
    }
  }
});

test("language and theme switches preserve provider disclosures", async ({ page }, testInfo) => {
  await page.goto(virtualOrigin);
  await reachSlot(page, "home-intro", "/", "ko");
  await page.locator(".header-utility-menu__trigger").click();
  await page.locator(".header-locale").click();
  await expect(page).toHaveURL(`${virtualOrigin}/en`);
  await reachSlot(page, "home-intro", "/en", "en");
  await expect(page.locator(".partner-ad-disclosure")).toHaveText(ADSTERRA_DISCLOSURE.en);
  await page.locator(".header-utility-menu__trigger").click();
  await page.locator(".header-theme").click();
  await expect(page.locator("body")).toHaveClass(/light-mode/);
  await page.locator('[data-ad-slot="home-intro"] iframe').scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("home-en-light.png") });
});

test.describe("consent-required visitors", () => {
  test.use({ timezoneId: "Europe/Berlin", locale: "de-DE" });
  for (const locale of ["ko", "en"]) test(`no ad request before consent or after rejection (${locale})`, async ({ page }) => {
    const adRequests = [];
    page.on("request", request => {
      if (/bauval\.org|ads-partners\.coupang\.com/.test(request.url())) adRequests.push(request.url());
    });
    await page.addInitScript(key => localStorage.removeItem(key), CONSENT_STORAGE_KEY);
    await page.goto(`${virtualOrigin}${locale === "en" ? "/en" : "/"}`);
    const dialog = page.getByRole("dialog", { name: locale === "en" ? "Cookie consent" : "쿠키 동의" });
    await expect(dialog).toBeVisible();
    await expect(page.locator("[data-ad-slot]")).toHaveCount(0);
    await dialog.getByRole("button", { name: locale === "en" ? "Reject" : "거부", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator("[data-ad-slot]")).toHaveCount(0);
    expect(adRequests).toEqual([]);
    expect(await adEvents(page)).toEqual([]);
  });
});

test("mobile home uses safe width after the entry area @mobile-only", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(virtualOrigin);
  await page.addStyleTag({ content: "html { scrollbar-gutter: stable; } ::-webkit-scrollbar { width: 10px; }" });
  expect(await page.evaluate(() => innerWidth)).toBe(360);
  const slot = page.locator('[data-ad-slot="home-intro"]');
  await expect(slot.locator('iframe')).toBeVisible();
  await expect(page.locator('.dc-hero__copy + [data-ad-slot="home-intro"]')).toHaveCount(1);
  await expect(page.locator('footer [data-ad-slot="home-intro"]')).toHaveCount(0);
});

test("mobile analysis has one compact site-rail alongside retained Coupang @mobile-only", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(`${virtualOrigin}/tools/budget-allocation`);
  expect(await page.evaluate(() => innerWidth)).toBe(360);
  await expect(page.locator('[data-ad-slot="site-rail"] iframe')).toHaveAttribute('data-ad-format', 'compact');
  await expect(page.locator('[data-ad-slot="analysis-bottom"] iframe')).toHaveAttribute('data-ad-provider', 'coupang');
});

async function mockCreatives(page) {
  const requests = [];
  await page.route(`${ADSTERRA_FRAME_ORIGIN}/**`, route => route.fulfill({ contentType: 'text/html', body: adsterraDocument(new URL(route.request().url()).pathname.split('/').pop()) }));
  await page.route('https://bauval.org/**', route => {
    requests.push(route.request().url());
    return route.fulfill({ contentType: 'application/javascript', body: `"use strict";const options=window.atOptions;delete window.atOptions;const creative=document.createElement('div');creative.setAttribute('data-mock-creative','adsterra');creative.textContent='Adsterra test creative';creative.style.cssText='width:'+options.width+'px;height:'+options.height+'px;background:#eee;color:#222';document.body.append(creative);` });
  });
  await page.route('https://ads-partners.coupang.com/**', route => {
    requests.push(route.request().url());
    return route.fulfill({ contentType: 'text/html', body: '<body style="margin:0"><div data-mock-creative="coupang">Coupang test creative</div></body>' });
  });
  return requests;
}

async function slotGeometry(page) {
  return page.evaluate(() => ({
    viewport: innerWidth, clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    mainWidth: document.querySelector('.main').clientWidth,
    slots: [...document.querySelectorAll('[data-ad-slot]')].map(slot => ({
      slot: slot.dataset.adSlot, hidden: slot.hidden, width: slot.getBoundingClientRect().width,
      top: slot.getBoundingClientRect().top + scrollY,
      frames: [...slot.querySelectorAll('iframe')].map(f => ({ provider: f.dataset.adProvider, format: f.dataset.adFormat, ...f.getBoundingClientRect().toJSON() })),
    })),
  }));
}

async function recordGeometry(testInfo, name, data) {
  const file = testInfo.outputPath(`${name}.json`);
  writeFileSync(file, JSON.stringify(data, null, 2));
  await testInfo.attach(name, { contentType: 'application/json', path: file });
}

for (const locale of ['ko', 'en']) test(`mobile CSS geometry and orientation, four surfaces (${locale}) @mobile-only`, async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const requests = await mockCreatives(page);
  const evidence = [];
  const prefix = locale === 'en' ? '/en' : '';
  for (const path of ['', '/blog/correlation-vs-causation', '/guide', '/tools/budget-allocation?example=1']) {
    const pathname = `${prefix}${path.split('?')[0]}` || '/';
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(`${virtualOrigin}${prefix}${path}`);
    if (path.includes('budget-allocation')) await expect(page.locator('.result-action-card').first()).toBeVisible();
    for (const width of [320, 360, 375, 390, 412, 768, 980, 1440, 1600, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      const placement = pageAdPlacement(pathname);
      const horizontal = page.locator(`[data-ad-slot="${placement}"] iframe`);
      await expect(horizontal).toHaveCount(1);
      await expect(horizontal).toBeVisible();
      await reachSlot(page, placement, pathname, locale, 'compact');
      await expect(page.frameLocator(`[data-ad-slot="${placement}"] iframe`).locator('[data-mock-creative]')).toBeVisible();
      const safe = await page.locator('.main').evaluate(el => el.clientWidth);
      const expectedRail = safe >= PARTNER_AD_RAIL_MIN_WIDTH ? 'rail' : placement === 'analysis-bottom' ? 'compact' : null;
      const rail = page.locator('[data-ad-slot="site-rail"] iframe');
      await expect(rail).toHaveCount(expectedRail ? 1 : 0);
      if (expectedRail) {
        await expect(rail).toHaveAttribute('data-ad-format', expectedRail);
        await reachSlot(page, 'site-rail', pathname, locale, placement === 'analysis-bottom' ? 'compact' : 'rail');
      }
      const geometry = await slotGeometry(page);
      expect(geometry.viewport).toBe(width);
      expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);
      for (const slot of geometry.slots) {
        expect(slot.frames.length).toBeLessThanOrEqual(1);
        for (const frame of slot.frames) {
          expect(frame.left).toBeGreaterThanOrEqual(-0.5);
          expect(frame.right).toBeLessThanOrEqual(geometry.clientWidth + 0.5);
          const size = (frame.provider === 'adsterra' ? ADSTERRA_FORMATS : PARTNER_AD_FORMATS)[frame.format];
          expect(frame.width).toBe(size.width);
          expect(frame.height).toBe(size.height);
        }
      }
      if (expectedRail === 'compact') {
        expect(await page.locator('[data-ad-slot="site-rail"]').evaluate(el => Boolean(el.previousElementSibling?.matches('main')))).toBe(true);
        const railBox = await rail.boundingBox();
        const coupangBox = await horizontal.boundingBox();
        expect(railBox.y).toBeGreaterThan(coupangBox.y + coupangBox.height);
      }
      evidence.push({ pathname, ...geometry });
      if (width === 390 && evidence.filter(row => row.pathname === pathname && row.viewport === width).length === 1 && !path.includes('blog')) {
        await horizontal.scrollIntoViewIfNeeded();
        await page.screenshot({ path: testInfo.outputPath(`${locale}-${placement}.png`) });
      }
    }
    // 한 페이지 진입 중 같은 슬롯의 회전/복구는 도달 이벤트를 늘리지 않는다.
    const events = await adEvents(page);
    expect(new Set(events.map(event => event.ad_slot)).size).toBe(events.length);
  }
  expect(requests.length).toBeGreaterThan(0);
  await recordGeometry(testInfo, 'mobile-layout', evidence);
});

test('rail boundary, same-format requests and mobile SPA revisit @mobile-only', async ({ page }, testInfo) => {
  const requests = await mockCreatives(page);
  const pathname = '/tools/budget-allocation';
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto(`${virtualOrigin}${pathname}`);
  await reachSlot(page, 'site-rail', pathname, 'ko');
  const compactRequests = () => requests.filter(url => url.includes(ADSTERRA_FORMATS.compact.key)).length;
  expect(compactRequests()).toBe(1);
  for (const width of [412, 390]) {
    await page.setViewportSize({ width, height: 800 });
    await reachSlot(page, 'site-rail', pathname, 'ko');
    expect(compactRequests()).toBe(1);
  }
  await page.setViewportSize({ width: 1600, height: 1000 });
  await expect(page.locator('[data-ad-slot="site-rail"] iframe')).toHaveAttribute('data-ad-format', 'rail');
  const sidebarWidth = await page.locator('.main').evaluate(el => innerWidth - el.clientWidth);
  const boundaries = [];
  for (const mainWidth of [1179, 1180, 1181, 1179]) {
    await page.setViewportSize({ width: mainWidth + sidebarWidth, height: 1000 });
    await expect.poll(() => page.locator('.main').evaluate(el => el.clientWidth)).toBe(mainWidth);
    await expect(page.locator('[data-ad-slot="site-rail"] iframe')).toHaveAttribute('data-ad-format', mainWidth < 1180 ? 'compact' : 'rail');
    await expect(page.locator('[data-ad-slot="site-rail"] iframe')).toHaveCount(1);
    boundaries.push(await slotGeometry(page));
  }
  await page.setViewportSize({ width: 390, height: 800 });
  await reachSlot(page, 'site-rail', pathname, 'ko', 'compact');
  expect((await adEvents(page)).filter(e => e.ad_slot === 'site-rail')).toHaveLength(1);
  await page.locator('.site-footer--slim a[href="/privacy"]').click();
  await expect(page).toHaveURL(`${virtualOrigin}/privacy`);
  await expect(page.locator('[data-ad-slot="site-rail"] iframe')).toHaveCount(0);
  await reachSlot(page, 'page-bottom', '/privacy', 'ko');
  await page.goBack();
  await expect(page).toHaveURL(`${virtualOrigin}${pathname}`);
  await page.locator('[data-ad-slot="site-rail"] iframe').scrollIntoViewIfNeeded();
  await expect.poll(async () => (await adEvents(page)).filter(e => e.ad_slot === 'site-rail' && e.page_path === pathname).length).toBe(2);
  await expect(page.locator('[data-ad-slot="site-rail"] iframe')).toHaveCount(1);
  await recordGeometry(testInfo, 'rail-boundaries', boundaries);
});

test('safe-area and constrained main width never shrink or clip a banner @mobile-only', async ({ page }, testInfo) => {
  const evidence = [];
  for (const path of ['/', '/blog/correlation-vs-causation', '/guide', '/tools/budget-allocation']) {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(`${virtualOrigin}${path}`);
    const placement = pageAdPlacement(path);
    const frame = page.locator(`[data-ad-slot="${placement}"] iframe`);
    await expect(frame).toBeVisible();
    const inset = await page.addStyleTag({ content: '.partner-ad-slot,.partner-ad-anchor{--ad-safe-left:20px!important;--ad-safe-right:20px!important}' });
    await page.setViewportSize({ width: 350, height: 800 });
    await expect(frame).toHaveCount(0);
    await expect(page.locator('[data-ad-slot="site-rail"] iframe')).toHaveCount(0);
    evidence.push({ path, inset: 20, ...await slotGeometry(page) });
    await page.setViewportSize({ width: 360, height: 800 });
    await expect(frame).toHaveCount(1);
    expect(await frame.boundingBox()).toMatchObject({ x: 20, width: 320 });
    await inset.evaluate(el => el.remove());
    // 실제 스크롤바 폭을 단정하지 않고 메인 폭 310/350px을 만들어 여백 부족을 검사한다.
    await page.addStyleTag({ content: '.app,.site-footer{max-width:calc(100% - 10px)!important}' });
    await page.setViewportSize({ width: 320, height: 800 });
    await expect(frame).toHaveCount(0);
    evidence.push({ path, reservedWidth: 10, ...await slotGeometry(page) });
    await page.setViewportSize({ width: 360, height: 800 });
    await expect(frame).toHaveCount(1);
    const rect = await frame.boundingBox();
    expect(rect.width).toBe(320);
    expect(rect.x + rect.width).toBeLessThanOrEqual(350);
    evidence.push({ path, reservedWidth: 10, ...await slotGeometry(page) });
  }
  await recordGeometry(testInfo, 'safe-width-layout', evidence);
});

test.describe('mobile user agent', () => {
  test.use({ isMobile: true, hasTouch: true, userAgent: devices['Pixel 7'].userAgent });
  test('mobile UA preserves viewport and real result slots @mobile-only', async ({ page }, testInfo) => {
    await mockCreatives(page);
    const evidence = [];
    for (const prefix of ['', '/en']) {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`${virtualOrigin}${prefix}/tools/budget-allocation?example=1`);
      await expect(page.locator('.result-action-card').first()).toBeVisible();
      for (const slot of ['site-rail', 'analysis-bottom']) {
        await expect(page.locator(`[data-ad-slot="${slot}"] iframe`)).toHaveAttribute('data-ad-format', 'compact');
      }
      const geometry = await slotGeometry(page);
      expect(geometry.viewport).toBe(390);
      expect(geometry.scrollWidth).toBe(390);
      evidence.push({ locale: prefix ? 'en' : 'ko', ...geometry });
    }
    await recordGeometry(testInfo, 'mobile-ua-layout', evidence);
  });
});
