import path from "node:path";
import { JSDOM } from "jsdom";
import { expect, test } from "@playwright/test";
import { BLOG_PRACTICES, blogPracticeFor } from "../src/lib/blogPractice";
import { BLOG_INSIGHT_PLACEMENTS } from "../src/lib/blogInsightRegistry";
import { PUBLISHED_BLOG_TOOL_MAP } from "../src/lib/contentToolRegistry";
import { idToSlug } from "../src/lib/routeMap";

// One real browser handoff per distinct generated dataset family; coverage of
// every published article (including exclusions) is checked separately below.
const generatedCases = [...new Map(Object.keys(BLOG_INSIGHT_PLACEMENTS)
  .filter(slug => !BLOG_PRACTICES[slug])
  .map(slug => [blogPracticeFor(slug).demoGroup, slug])).values()];

for (const locale of ["ko", "en"]) {
  test(`every published ${locale} article has appropriate practice and preparation links`, async ({ request }) => {
    let checkedCitations = 0;
    for (const slug of Object.keys(PUBLISHED_BLOG_TOOL_MAP)) {
      const response = await request.get(`${locale === "en" ? "/en" : ""}/blog/${slug}`);
      expect(response.ok(), slug).toBe(true);
      const html = await response.text();
      const dom = new JSDOM(html);
      const doc = dom.window.document;
      const links = new Set([...doc.querySelectorAll("main a[href]")].map(link => link.getAttribute("href")));
      for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
        const data = JSON.parse(script.textContent);
        const nodes = Array.isArray(data) ? data : data["@graph"] || [data];
        for (const node of nodes) for (const citation of node.citation || []) {
          checkedCitations += 1;
          expect(links.has(citation), `${slug}: ${citation}`).toBe(true);
        }
      }
      dom.window.close();
      const eligible = Boolean(BLOG_INSIGHT_PLACEMENTS[slug]);
      expect(html.includes('class="blog-practice-prep"'), slug).toBe(eligible);
      expect(html.includes('id="blog-practice"'), slug).toBe(eligible);
      expect(html, slug).toContain(`${locale === "en" ? "/en" : ""}/templates/`);
    }
    expect(checkedCitations).toBeGreaterThan(0);
  });
  for (const slug of ["incrementality-measurement", "apple-search-ads-guide"]) {
    test(`direct demo and keyboard sources (${locale}/${slug})`, async ({ page }) => {
      const en = locale === "en";
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("**/*", route => ["localhost", "127.0.0.1"].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
      await page.goto(`${en ? "/en" : ""}/blog/${slug}`);
      const trust = page.locator(".editorial-trust--compact");
      await expect(trust).toBeVisible();
      await expect(trust.locator("a").first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const demo = page.getByRole("button", { name: en ? "Open analysis with demo" : "데모로 분석 열기", exact: true });
      await expect(demo).toBeEnabled();
      expect((await demo.boundingBox()).height).toBeGreaterThanOrEqual(44);
      await demo.click();
      await expect(page).toHaveURL(`${en ? "/en" : ""}${idToSlug[BLOG_INSIGHT_PLACEMENTS[slug].toolId]}`);
      if (slug === "incrementality-measurement") {
        const notice = page.getByRole("dialog", { name: en ? "You're currently viewing demo data" : "지금은 데모 데이터를 이용 중입니다" });
        await expect(notice).toBeVisible();
        await notice.getByRole("button", { name: en ? "Not now" : "나중에", exact: true }).click();
      }
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      if (slug === "apple-search-ads-guide") await expect(page.getByLabel(en ? "Conversion maturity of the uploaded period" : "업로드 기간의 전환 성숙도")).toHaveValue("unknown");
      expect(errors).toEqual([]);
    });
  }
  for (const slug of generatedCases) {
    test(`generated practice downloads and reaches its tool (${locale}/${slug})`, async ({ page }) => {
      const en = locale === "en", practice = blogPracticeFor(slug, locale);
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("**/*", route => ["localhost", "127.0.0.1"].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
      await page.goto(`${en ? "/en" : ""}/blog/${slug}`);
      const downloadEvent = page.waitForEvent("download");
      await page.getByRole("button", { name: practice.download, exact: true }).click();
      const download = await downloadEvent;
      expect(download.suggestedFilename()).toBe(practice.file);
      expect(await download.failure()).toBeNull();
      await page.getByRole("link", { name: practice.jump, exact: true }).click();
      const panel = page.locator("#blog-practice");
      await expect(panel).toBeFocused();
      await panel.getByLabel(en ? "Choose CSV" : "CSV 선택", { exact: true }).setInputFiles(await download.path());
      await expect(panel.getByRole("status")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await panel.getByRole("button", { name: en ? "Open detailed analysis" : "더 자세한 분석 보기", exact: true }).click();
      await expect(page).toHaveURL(`${en ? "/en" : ""}${idToSlug[BLOG_INSIGHT_PLACEMENTS[slug].toolId]}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(errors).toEqual([]);
    });
  }
}

for (const locale of ["ko", "en"]) {
  for (const slug of Object.keys(BLOG_PRACTICES)) {
    test(`editorial practice download and analysis (${locale}/${slug})`, async ({ page }) => {
      const en = locale === "en";
      const practice = blogPracticeFor(slug, locale);
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("**/*", route => ["localhost", "127.0.0.1"].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
      await page.goto(`${en ? "/en" : ""}/blog/${slug}`);
      const prep = page.getByRole("complementary", { name: practice.before });
      await expect(prep).toBeVisible();
      expect(await prep.evaluate(node => node.closest("article"))).toBeNull();
      const downloadEvent = page.waitForEvent("download");
      await prep.getByRole("link", { name: practice.download }).click();
      const download = await downloadEvent;
      expect(download.suggestedFilename()).toBe(practice.file);
      expect(await download.failure()).toBeNull();
      const jump = prep.getByRole("link", { name: practice.jump });
      await jump.focus();
      await page.keyboard.press("Enter");
      const panel = page.getByRole("complementary", { name: practice.title });
      await expect(panel).toBeFocused();
      const instructions = panel.locator(".blog-practice__instructions");
      await expect(instructions).toBeVisible();
      await expect(instructions).toContainText(practice.limit);
      await panel.getByLabel(en ? "Choose CSV" : "CSV 선택", { exact: true }).setInputFiles(path.join(process.cwd(), "public", practice.href));
      await expect(panel.getByText(en ? "Check columns" : "열 확인", { exact: true })).toBeVisible();
      if (slug !== "aso-basics-guide") await panel.getByLabel(en ? "Source currency (no conversion)" : "원본 통화 (환산 없음)").selectOption("KRW");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (practice.mode === "detail") {
        await expect(panel.getByRole("button", { name: en ? "Show result" : "결과 보기", exact: true })).toHaveCount(0);
        await panel.getByRole("button", { name: en ? "Open detailed analysis" : "더 자세한 분석 보기", exact: true }).click();
        await expect(page).toHaveURL(`${en ? "/en" : ""}${idToSlug[BLOG_INSIGHT_PLACEMENTS[slug].toolId]}`);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        if (BLOG_INSIGHT_PLACEMENTS[slug].toolId === "5-26") {
          await expect(page.getByLabel(en ? "Conversion maturity of the uploaded period" : "업로드 기간의 전환 성숙도")).toHaveValue("unknown");
        }
      } else {
        await panel.getByRole("button", { name: en ? "Show result" : "결과 보기", exact: true }).click();
        await expect(panel.locator(".blog-inline-insight__finding")).toContainText(slug === "aso-basics-guide" ? (en ? "Traffic mix" : "트래픽 구성") : (en ? "No channel has enough observations" : "관측 수나 지출 변동"));
        await expect(panel.getByRole("alert")).toHaveCount(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
      expect(errors).toEqual([]);
    });
  }
}
