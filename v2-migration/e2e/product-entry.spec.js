import { test, expect } from "@playwright/test";

for (const locale of ["ko", "en"]) {
  test(`mobile sample entry and readable evidence (${locale})`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    const prefix = locale === "en" ? "/en" : "";
    await page.goto(prefix || "/");
    await expect(page.locator('.csv-uploader[data-hydrated="true"]')).toBeAttached();
    const mobile = page.locator(".mobile-quick-start").first();
    const sample = page.locator(".dc-hero__actions .dc-action-route--sample");
    await expect(sample).toBeVisible();
    await expect(page.locator(".dc-hero .mobile-quick-start")).toHaveCount(0);
    await expect(page.locator(".home-result-preview header img")).toBeVisible();
    await expect(mobile.locator(`a[href="${prefix}/calculator"]`)).toBeVisible();
    await expect(mobile.locator(`a[href="${prefix}/templates"]`)).toBeHidden();
    await expect(page.locator(".home-result-preview__kpis dd")).toHaveCount(3);
    for (const light of [true, false]) {
      await page.evaluate(value => document.body.classList.toggle("light-mode", value), light);
      await expect(page.locator(".home-result-preview__insight p")).toHaveCSS("font-size", "14px");
      await expect(sample.locator("strong")).toHaveCSS("font-size", "14px");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    }
    await sample.click();
    await expect(page).toHaveURL(new RegExp(`${prefix}/dochi-result$`));
    await expect(page.locator('.dochi-result-workspace[data-phase="mapping"]')).toBeVisible();
    await page.getByRole("button", { name: locale === "en" ? "Confirm and open results" : "확인하고 결과 가져오기", exact: true }).click();
    await expect(page.locator('.dochi-result-workspace[data-phase="results"]')).toBeVisible();
    await expect(page.locator(".dochi-workspace__findings-summary")).toBeVisible();
  });
}
