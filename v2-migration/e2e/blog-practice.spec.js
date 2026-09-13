import path from "node:path";
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
    for (const slug of Object.keys(PUBLISHED_BLOG_TOOL_MAP)) {
      const response = await request.get(`${locale === "en" ? "/en" : ""}/blog/${slug}`);
      expect(response.ok(), slug).toBe(true);
      const html = await response.text();
      const eligible = Boolean(BLOG_INSIGHT_PLACEMENTS[slug]);
      expect(html.includes('class="blog-practice-prep"'), slug).toBe(eligible);
      expect(html.includes('id="blog-practice"'), slug).toBe(eligible);
      expect(html, slug).toContain(`${locale === "en" ? "/en" : ""}/templates/`);
    }
  });
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
      await expect(instructions).not.toHaveAttribute("open");
      await instructions.locator("summary").focus();
      await page.keyboard.press("Enter");
      await expect(instructions).toHaveAttribute("open");
      await expect(instructions).toContainText(practice.limit);
      await panel.getByLabel(en ? "Choose CSV" : "CSV 선택", { exact: true }).setInputFiles(path.join(process.cwd(), "public", practice.href));
      await expect(panel.getByText(en ? "Check columns" : "열 확인", { exact: true })).toBeVisible();
      if (slug !== "aso-basics-guide") await panel.getByLabel(en ? "Source currency (no conversion)" : "원본 통화 (환산 없음)").selectOption("KRW");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (practice.mode === "detail") {
        await expect(panel.getByRole("button", { name: en ? "Show result" : "결과 보기", exact: true })).toHaveCount(0);
        await panel.getByRole("button", { name: en ? "Open detailed analysis" : "더 자세한 분석 보기", exact: true }).click();
        await expect(page).toHaveURL(new RegExp(`${en ? "/en" : ""}/tools/asa-keyword-finder$`));
        await expect(page.getByLabel(en ? "Conversion maturity of the uploaded period" : "업로드 기간의 전환 성숙도")).toHaveValue("unknown");
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
