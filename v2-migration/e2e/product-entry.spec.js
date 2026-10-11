import { test, expect } from "@playwright/test";

for (const locale of ["ko", "en"]) {
  test(`mobile sample entry and readable evidence (${locale})`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    const prefix = locale === "en" ? "/en" : "";
    await page.goto(prefix || "/");
    await expect(page.locator('.dc-action-route--primary')).toBeVisible();
    const mobile = page.locator(".mobile-quick-start").first();
    const sample = page.locator(".dc-hero__actions .dc-action-route--sample");
    await expect(sample).toBeVisible();
    await expect(page.locator(".dc-hero .mobile-quick-start")).toHaveCount(0);
    await expect(page.locator(".home-result-preview > h2")).toBeVisible();
    await expect(mobile.locator(`a[href="${prefix}/calculator"]`)).toBeVisible();
    await expect(mobile.locator(`a[href="${prefix}/templates"]`)).toBeVisible();
    await expect(page.locator(".operations-sample-preview ol li")).toHaveCount(3);
    const currentCpi = (await page.locator(".operations-sample-preview__metric strong").textContent()).split("→").at(-1).trim();
    for (const light of [true, false]) {
      await page.evaluate(value => document.body.classList.toggle("light-mode", value), light);
      await expect(page.locator(".home-result-preview h2")).toHaveCSS("font-size", "20px");
      await expect(sample.locator("strong")).toHaveCSS("font-size", "14px");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    }
    await sample.click();
    await expect(page).toHaveURL(new RegExp(`${prefix}/tools/operations-planner$`));
    await expect(page.locator(".operations-planner__demo")).toBeVisible();
    await expect(page.locator(".result-action-card__stats")).toContainText(currentCpi);
    await expect(page.locator(".operations-priorities ol > li")).toHaveCount(3);
    await expect(page.locator(".operations-priorities a")).toHaveCount(3);
  });
}
