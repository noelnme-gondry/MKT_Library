import { test, expect } from "@playwright/test";
import path from "node:path";
import { expectNoSeriousAccessibilityViolations } from "./support/quality";

for (const locale of ["ko", "en"]) {
  const en = locale === "en";
  const prefix = en ? "/en" : "";
  const tag = en ? " @light-en" : "";
  test(`shared typography and interior layouts (${locale})${tag}`, async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const route of ["/dashboard", "/weekly-review", "/blog", "/guide", "/guide/dev-collaboration", "/subscription"]) {
      await page.goto(`${prefix}${route}`);
      const heading = page.locator("h1").first();
      await expect(heading).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await expect(heading).toHaveCSS("font-family", /pretendard/i);
      expect(await page.evaluate(() => [...document.fonts].some((font) => /pretendard/i.test(font.family) && font.status === "loaded")), route).toBe(true);
      // Long SOP code tokens must wrap without making the entire page scroll.
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), route).toBe(true);
    }
    expect(errors).toEqual([]);
  });
  test(`library question entry and persistent navigation (${locale})${tag}`, async ({ page }) => {
    await page.goto(prefix || "/");
    await expect(page.locator('.csv-uploader[data-hydrated="true"]')).toBeAttached();
    await expect(page.getByRole("dialog")).toBeHidden();
    // Legacy centered-hero rules must not distort the approved card layout.
    await expect(page.locator(".dc-hero__copy")).toHaveCSS("text-align", "left");
    const hero = await page.locator(".dc-hero").boundingBox();
    const primary = await page.locator(".dc-action-route--primary").boundingBox();
    expect(Math.abs(primary.x - hero.x)).toBeLessThan(1);
    expect(primary.height).toBeLessThanOrEqual(56);
    await page.locator(".dc-action-route--question").click();
    await expect(page.locator("#questions")).toBeFocused();
    await expect(page.locator(".home-tool-finder__purposes button")).toHaveCount(3);
    await expect(page.locator("#dochi-upload")).toBeHidden();
    await expect(page.locator(".library-reading__grid a")).toHaveCount(4);
    await expectNoSeriousAccessibilityViolations(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    const toggle = page.locator(".header-sidebar-toggle");
    const mobile = await toggle.getAttribute("aria-haspopup") === "dialog";
    if (mobile) {
      await toggle.click();
      await expect(page.getByRole("dialog", { name: en ? "Site navigation" : "사이트 메뉴" })).toBeVisible();
      await expectNoSeriousAccessibilityViolations(page);
      await page.keyboard.press("Escape");
      await expect(toggle).toBeFocused();
      await toggle.click();
    }
    for (const path of ["/blog", "/guide", "/weekly-review", "/subscription", "/start", "/dochi-result"]) {
      await expect(page.locator(`.library-nav-item[href="${prefix}${path}"]`)).toBeVisible();
    }
    await page.locator(`.library-nav-item[href="${prefix}/blog"]`).click();
    await expect(page).toHaveURL(new RegExp(`${prefix}/blog$`));
    await expect(page.locator("main h1")).toBeVisible();
    if (mobile) await expect(page.getByRole("dialog")).toBeHidden();
  });

  test(`home sample retains column confirmation and weekly handoff (${locale})${tag}`, async ({ page }) => {
    await page.goto(prefix || "/");
    await expect(page.locator('.csv-uploader[data-hydrated="true"]')).toBeAttached();
    await page.locator(".dc-hero__utility-actions button").click();
    await expect(page).toHaveURL(new RegExp(`${prefix}/dochi-result$`));
    await expect(page.locator('.dochi-result-workspace[data-phase="mapping"]')).toBeVisible();
    await expect(page.locator(".dochi-workspace__findings-summary")).toHaveCount(0);
    await page.getByRole("button", { name: en ? "Confirm and open results" : "확인하고 결과 가져오기", exact: true }).click();
    await expect(page.locator('.dochi-result-workspace[data-phase="results"]')).toBeVisible();
    await expect(page.locator(".dochi-workspace__findings-summary")).toBeVisible();
    await expect(page.locator(".dochi-workspace__queue")).not.toContainText(en ? "Running" : "실행 중");
    await page.getByRole("button", { name: en ? "Build weekly review" : "주간 리뷰 만들기", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${prefix}/weekly-review$`));
    await expect(page.locator("main h1")).toBeVisible();
    await expect(page.locator("#wr-verdict")).toBeVisible();
    await expect(page.locator(".header-data-context")).toContainText("demo_efficiency.csv");
  });

  test(`home CSV upload reaches unified analysis (${locale})${tag}`, async ({ page }) => {
    await page.goto(prefix || "/");
    await expect(page.locator('.csv-uploader[data-hydrated="true"]')).toBeAttached();
    await page.locator(".dc-action-route--primary").click();
    await page.locator('#dochi-upload input[type="file"]').first().setInputFiles(path.resolve("e2e/fixtures/efficiency.csv"));
    await expect(page).toHaveURL(new RegExp(`${prefix}/dochi-result$`));
    await expect(page.locator(".header-data-context")).toContainText("efficiency.csv");
    // A real CSV must declare its currency; the sample already owns one.
    await page.getByRole("button", { name: en ? "KRW ₩" : "원 ₩", exact: true }).click();
    await page.getByRole("button", { name: en ? "Confirm and open results" : "확인하고 결과 가져오기", exact: true }).click();
    await expect(page.locator(".dochi-workspace__findings-summary")).toBeVisible();
    await expect(page.locator(".dochi-result-workspace__context")).toContainText("efficiency.csv");
    await expect(page.locator(".dochi-result-workspace__context")).not.toContainText("demo_");
  });
}
