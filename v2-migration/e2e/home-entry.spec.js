import { test, expect } from "@playwright/test";
import { expectNoSeriousAccessibilityViolations } from "./support/quality";

async function checkHome(page, locale) {
  const hydrationErrors = [];
  page.on("console", message => { if (/hydration|hydrated/i.test(message.text())) hydrationErrors.push(message.text()); });
  const en = locale === "en";
  await page.addInitScript((lang) => {
    localStorage.setItem("mkt-library-dochi-welcome-dismissed", "1");
    if (lang === "en") localStorage.setItem("mkt-library-theme", "light");
  }, locale);
  await page.goto(en ? "/en" : "/");
  await expect(page.locator("#dochi-upload")).not.toBeVisible();
  const purposes = page.locator(".home-tool-finder__purposes button");
  await expect(purposes).toHaveCount(7);
  await purposes.first().focus();
  await page.keyboard.press("Enter");
  await expect(purposes.first()).toHaveAttribute("aria-expanded", "true");
  const links = page.locator(".home-tool-finder__results a");
  await expect(links.first()).toBeVisible();
  const subset = await links.count();
  await page.getByRole("button", { name: en ? "View all tools" : "전체 도구 보기", exact: true }).click();
  expect(await links.count()).toBeGreaterThan(subset);
  await expectNoSeriousAccessibilityViolations(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.locator(".dc-action-route--primary").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#dochi-upload")).toBeVisible();
  await expect(page.locator("#dochi-upload")).toBeFocused();
  expect(await page.locator("#dochi-upload").evaluate(node => getComputedStyle(node).position)).toBe("relative");
  await expect(page).toHaveURL(/#dochi-upload$/);
  await page.reload();
  await expect(page.locator("#dochi-upload")).toBeVisible();
  await page.locator(".dc-intake > summary").click();
  await expect(page.locator("#dochi-upload")).not.toBeVisible();
  await expect(page.locator(".dc-action-route--primary")).toBeFocused();
  expect(hydrationErrors).toEqual([]);
}

test("home purpose selection and keyboard intake", async ({ page }) => checkHome(page, "ko"));
test("@light-en home purpose selection and keyboard intake", async ({ page }) => checkHome(page, "en"));
