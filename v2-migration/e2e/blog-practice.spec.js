import path from "node:path";
import { JSDOM } from "jsdom";
import { expect, test } from "@playwright/test";
import { BLOG_PRACTICES, blogPracticeFor } from "../src/lib/blogPractice";
import { BLOG_INSIGHT_PLACEMENTS } from "../src/lib/blogInsightRegistry";
import { PUBLISHED_BLOG_TOOL_MAP, inlineCalculatorForBlog } from "../src/lib/contentToolRegistry";
import { getCalculator } from "../src/lib/calculators";
import { idToSlug } from "../src/lib/routeMap";
import { blogConversionFor } from "../src/lib/blogConversion";
import { blogSelfCheckFor } from "../src/lib/blogSelfCheck";
import { blogSelfCheckNext } from "../src/lib/blogSelfCheckNext";
import { getPostBySlug } from "../src/lib/blog";
import { buildBlogPracticeDownload } from "../src/lib/blogPracticeData";
import { withDeclaredConditions } from "./support/declaredConditions.js";

// 5-26은 전환 집계 질문을 결과 위 한 줄 + 창으로 묻는다 — 글에서 넘어온 예시는 아직 답하지 않은 상태다.
async function expectMaturityUnanswered(page, en) {
  await withDeclaredConditions(page, en ? "Conversion completeness" : "전환 집계 확인", en, (dialog) =>
    expect(dialog.getByLabel(en ? "Can conversions still arrive for the most recent days?" : "최근 며칠은 전환이 아직 더 들어올 수 있나요?")).toHaveValue("unknown"));
}

// One real browser handoff per distinct generated dataset family; coverage of
// every published article (including exclusions) is checked separately below.
const generatedCases = [...new Map(Object.keys(BLOG_INSIGHT_PLACEMENTS)
  .filter(slug => !BLOG_PRACTICES[slug] && !inlineCalculatorForBlog(slug))
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
      const entry = doc.querySelector(".blog-conversion-entry");
      const copy = blogConversionFor(slug, locale);
      if (BLOG_INSIGHT_PLACEMENTS[slug]) {
        expect(entry.textContent, slug).toContain(copy.preview);
        if (copy.note) expect(entry.textContent, slug).toContain(copy.note);
        expect(doc.querySelector("#blog-practice").textContent, slug).toContain(copy.preview);
      } else {
        expect(entry.textContent, slug).toContain(blogSelfCheckFor(slug, locale).title);
        expect(entry.textContent, slug).toContain(blogSelfCheckNext(slug, locale).label);
      }
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
      // CSV 예시·합계 계산·30초 점검 중 글의 실제 실습 계약을 검증한다.
      const eligible = Boolean(BLOG_INSIGHT_PLACEMENTS[slug]);
      const calculator = inlineCalculatorForBlog(slug);
      expect(html.includes('id="blog-practice"'), slug).toBe(eligible);
      expect(html.includes("blog-example__headline"), slug).toBe(eligible && !calculator);
      expect(html.includes("calculator-workbench"), slug).toBe(Boolean(calculator));
      expect(html.includes('id="blog-self-check"'), slug).toBe(!eligible);
      expect(html.includes("blog-check--situation"), slug).toBe(true);
      if (eligible && !calculator) expect(html, slug).toContain(`${locale === "en" ? "/en" : ""}/templates/`);
      if (calculator) expect(html, slug).toContain(`${locale === "en" ? "/en" : ""}${getCalculator(calculator, locale).toolHref}`);
    }
    expect(checkedCitations).toBeGreaterThan(0);
  });
  test(`inline ROAS calculation and budget handoff (${locale})`, async ({ page }) => {
    const en = locale === "en", slug = "roas-improvement", prefix = en ? "/en" : "";
    const calculator = getCalculator(inlineCalculatorForBlog(slug), locale);
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", route => ["localhost", "127.0.0.1"].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
    await page.goto(`${prefix}/blog/${slug}`);
    const trust = page.locator(".editorial-trust--compact");
    await expect(trust).toBeVisible();
    await expect(trust.locator("a")).toHaveCount(getPostBySlug(slug, locale).sources.length);
    const entry = page.locator(".blog-conversion-entry").getByRole("link", { name: blogConversionFor(slug, locale).action, exact: true });
    await expect(entry).toHaveAttribute("href", "#blog-practice");
    expect((await entry.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await entry.click();
    const panel = page.locator("#blog-practice");
    await expect(panel).toBeInViewport();
    await panel.getByLabel(calculator.labels.adSpend).fill("200");
    await panel.getByLabel(calculator.labels.revenue).fill("500");
    await expect(panel.locator(".calculator-result__primary")).toContainText("250% · 2.50×");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await panel.getByRole("link", { name: calculator.toolCta }).click();
    await expect(page).toHaveURL(`${prefix}${calculator.toolHref}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(errors).toEqual([]);
  });
  for (const slug of ["incrementality-measurement", "apple-search-ads-guide", "ad-creative-testing"]) {
    test(`direct demo and keyboard sources (${locale}/${slug})`, async ({ page }) => {
      const en = locale === "en";
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("**/*", route => ["localhost", "127.0.0.1"].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
      await page.goto(`${en ? "/en" : ""}/blog/${slug}`);
      const trust = page.locator(".editorial-trust--compact");
      await expect(trust).toBeVisible();
      const sourceCount = getPostBySlug(slug, locale).sources.length;
      await expect(trust.locator("a")).toHaveCount(sourceCount);
      if (sourceCount) await expect(trust.locator("a").first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const demo = page.locator(".blog-conversion-entry").getByRole("button", { name: blogConversionFor(slug, locale).action, exact: true });
      await expect(demo).toBeEnabled();
      expect((await demo.boundingBox()).height).toBeGreaterThanOrEqual(44);
      await demo.click();
      await expect(page).toHaveURL(`${en ? "/en" : ""}${idToSlug[BLOG_INSIGHT_PLACEMENTS[slug].toolId]}`);
      const arrival = page.locator(".blog-arrival");
      await expect(arrival).toBeVisible();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(arrival.getByRole("link", { name: en ? "Back to the article" : "글로 돌아가기" })).toHaveAttribute("href", `${en ? "/en" : ""}/blog/${slug}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      // Reaching a route is not conversion: the sample's actual result must render.
      await expect(page.locator(".result-action-card").first()).toBeVisible({ timeout: 30_000 });
      if (slug === "apple-search-ads-guide") await expectMaturityUnanswered(page, en);
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
      const panel = page.locator("#blog-practice");
      await expect(panel.locator(".blog-example__headline")).toBeVisible();
      // 상세 버튼은 CSV를 고른 뒤에만 나온다 — 그 전엔 예시 결과와 '내 CSV로' 하나만.
      await expect(panel.getByRole("button", { name: en ? "Open detailed analysis" : "더 자세한 분석 보기", exact: true })).toHaveCount(0);
      await panel.getByLabel(en ? "Use my CSV" : "내 CSV로 분석하기", { exact: true }).setInputFiles({ name: practice.file, mimeType: "text/csv", buffer: Buffer.from(buildBlogPracticeDownload(practice).text) });
      await expect(panel.getByRole("status").filter({ hasText: practice.file })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await panel.getByRole("button", { name: en ? "Open detailed analysis" : "더 자세한 분석 보기", exact: true }).click();
      // This checks the handoff, not a 10-second performance budget. CI traces show
      // MMM route chunks still arriving after that deadline while navigation is pending.
      // Keep the exact URL, arrival and page-error assertions after the route settles.
      await expect(page).toHaveURL(`${en ? "/en" : ""}${idToSlug[BLOG_INSIGHT_PLACEMENTS[slug].toolId]}`, { timeout: 30_000 });
      // 시안 E: 모달 대신 출처 한 줄. 데모 안내 모달이 겹치지 않는다.
      await expect(page.locator(".blog-arrival")).toBeVisible();
      await expect(page.getByRole("dialog")).toHaveCount(0);
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
      const panel = page.locator("#blog-practice");
      await expect(panel.locator(".blog-example__headline")).toBeVisible();
      const instructions = panel.locator(".blog-practice__instructions");
      await instructions.locator("summary").click();
      await expect(instructions).toContainText(practice.limit);
      const downloadEvent = page.waitForEvent("download");
      await instructions.getByRole("link", { name: practice.download }).click();
      const download = await downloadEvent;
      expect(download.suggestedFilename()).toBe(practice.file);
      expect(await download.failure()).toBeNull();
      await panel.getByLabel(en ? "Use my CSV" : "내 CSV로 분석하기", { exact: true }).setInputFiles(path.join(process.cwd(), "public", practice.href));
      await expect(panel.getByText(en ? "Check columns" : "열 확인", { exact: true })).toBeVisible();
      if (slug !== "aso-basics-guide") await panel.getByLabel(en ? "Source currency (no conversion)" : "원본 통화 (환산 없음)").selectOption("KRW");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (practice.mode === "detail") {
        await expect(panel.getByRole("button", { name: en ? "Show result" : "결과 보기", exact: true })).toHaveCount(0);
        await panel.getByRole("button", { name: en ? "Open detailed analysis" : "더 자세한 분석 보기", exact: true }).click();
        await expect(page).toHaveURL(`${en ? "/en" : ""}${idToSlug[BLOG_INSIGHT_PLACEMENTS[slug].toolId]}`);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        if (BLOG_INSIGHT_PLACEMENTS[slug].toolId === "5-26") {
          await expectMaturityUnanswered(page, en);
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
