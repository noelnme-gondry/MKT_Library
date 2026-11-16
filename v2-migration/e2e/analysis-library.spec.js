import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { MARKETING_ANALYSIS_DOMAINS } from "../src/lib/marketingAnalysisLibrary.js";

const total = MARKETING_ANALYSIS_DOMAINS.reduce((count, group) => count + group.methods.length, 0);

async function verifyLibrary(page, locale) {
  const en = locale === "en";
  await page.goto(en ? "/en/guide" : "/guide");
  const library = page.locator("#analysis-library");
  await expect(library.getByRole("status")).toContainText(String(total));
  await expect(page.locator("h1")).toHaveCount(1);
  await page.getByRole("link", { name: en ? /Explore the marketing analysis map/ : /마케팅 분석 지도 보기/ }).click();
  const search = library.getByRole("searchbox");
  await search.fill("CUPED");
  await expect(library.locator("details")).toHaveCount(1);
  const method = library.locator("#analysis-cuped");
  const summary = method.locator("summary");
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(method).toHaveAttribute("open", "");
  await expect(method).toContainText(en ? "Tool linked" : "연결 도구 있음");
  await expect(method.locator('a[href*="microsoft.com"]')).toHaveCount(1);
  await expect(method.locator(`a[href="${en ? "/en" : ""}/tools/cuped-experiment"]`)).toBeVisible();
  await library.getByLabel(en ? "Availability" : "제공 범위").selectOption("tool");
  await expect(library.locator("details")).toHaveCount(1);
  await library.getByLabel(en ? "Availability" : "제공 범위").selectOption("reference");
  await expect(library.getByRole("status")).toContainText("0");
  await expect(library.locator("details")).toHaveCount(0);
  await library.getByRole("button", { name: en ? "Reset filters" : "필터 초기화" }).click();
  await library.getByLabel(en ? "Domain" : "분야").selectOption("acquisition");
  await expect(library.locator("details")).toHaveCount(2);
  await library.locator("#analysis-keyword-optimization summary").click();
  const tool = library.locator(`a[href="${en ? "/en" : ""}/tools/asa-keyword-finder"]`);
  await expect(tool).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const accessibility = await new AxeBuilder({ page }).include("#analysis-library").analyze();
  expect(accessibility.violations).toEqual([]);
  await tool.click();
  await expect(page).toHaveURL(new RegExp(`${en ? "/en" : ""}/tools/asa-keyword-finder$`));
}

for (const locale of ["ko", "en"]) {
  test(`analysis map: ${locale} filters, reference scope, keyboard and tool entry`, async ({ page }) => {
    await verifyLibrary(page, locale);
  });
}

test("analysis map: English light theme @light-en", async ({ page }) => {
  await verifyLibrary(page, "en");
});

test("guide responses contain the analysis map in both locales", async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "HTTP output does not depend on viewport.");
  for (const prefix of ["", "/en"]) {
    const response = await request.get(`${prefix}/guide`);
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).toContain('id="analysis-library"');
    expect(html).toContain("CUPED");
    expect(html).toContain('id="analysis-pipeline-conversion"');
    expect(html).toContain(prefix ? "Marketing Analysis Map and Playbooks" : "마케팅 분석 지도·실무 가이드");
  }
});
