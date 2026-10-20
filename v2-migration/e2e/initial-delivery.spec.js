import { expect, test } from "@playwright/test";
import { gzipSync } from "node:zlib";
import { JSDOM } from "jsdom";
import { ROUTES, hasEnVersion, isRouteIndexable } from "../src/lib/routeMap.js";
import { getToolSearchContent, hasInlineToolReference } from "../src/lib/toolSearchContent.js";
import { START_PAGE_COPY } from "../src/lib/startPageCopy.js";

// HTTP 응답의 본문·초기 script만 검사한다. 브라우저 성능 지표(LCP/INP)를 대신하지 않는다.
test("published tool responses contain useful initial guidance", async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "HTTP output is independent of viewport.");
  const routes = ROUTES.filter(route => /^(5|9)-/.test(route.id) && isRouteIndexable(route.id));
  expect(routes.length).toBeGreaterThan(10);
  for (const route of routes) {
    for (const locale of hasEnVersion(route.id) ? ["ko", "en"] : ["ko"]) {
      const pathname = `${locale === "en" ? "/en" : ""}${route.slug}`;
      const response = await request.get(pathname);
      expect(response.status(), pathname).toBe(200);
      const dom = new JSDOM(await response.text());
      try {
        const document = dom.window.document;
        const main = document.querySelector("main");
        expect(main, pathname).toBeTruthy();
        const content = getToolSearchContent(route.id, locale);
        expect(content, pathname).toBeTruthy();
        const selector = hasInlineToolReference(route.id) ? ".tool-longform" : `#tool-entry-summary-${route.id}`;
        expect(main.querySelector(selector), pathname).toBeTruthy();
        expect([content.lead, content.answer].filter(Boolean).some(text => main.textContent.includes(text)), pathname).toBe(true);
      } finally { dom.window.close(); }
    }
  }
  for (const locale of ["ko", "en"]) {
    const response = await request.get(locale === "en" ? "/en/start" : "/start");
    const dom = new JSDOM(await response.text());
    try {
      expect(response.status()).toBe(200);
      expect(dom.window.document.querySelector("main").textContent).toContain(START_PAGE_COPY[locale].deck);
    } finally { dom.window.close(); }
  }
});

test("core entries stay within the initial JavaScript budget", async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "Build payload is independent of viewport.");
  test.skip(process.env.E2E_SERVER !== "production", "The payload budget applies to production builds.");
  // 2026-10-20 이전 1,086KiB → 분리 후 약 678KiB. 800KiB는 재결합 회귀를 잡는 여유 한도다.
  const maxGzipBytes = 800 * 1024;
  const scriptSizes = new Map();
  for (const pathname of ["/", "/start", "/dashboard", "/tools/budget-allocation", "/en/start", "/en/tools/budget-allocation"]) {
    const response = await request.get(pathname);
    expect(response.status(), pathname).toBe(200);
    const dom = new JSDOM(await response.text());
    const scripts = [...new Set([...dom.window.document.querySelectorAll("script[src]")]
      .map(node => node.getAttribute("src")).filter(src => src.startsWith("/_next/")))];
    dom.window.close();
    expect(scripts.length, pathname).toBeGreaterThan(0);
    let total = 0;
    for (const src of scripts) {
      if (!scriptSizes.has(src)) {
        const script = await request.get(src);
        expect(script.status(), src).toBe(200);
        scriptSizes.set(src, gzipSync(await script.body()).length);
      }
      total += scriptSizes.get(src);
    }
    expect(total, `${pathname}: ${Math.round(total / 1024)}KiB initial gzip JS`).toBeLessThanOrEqual(maxGzipBytes);
  }
});
