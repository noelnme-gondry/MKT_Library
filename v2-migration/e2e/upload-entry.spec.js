import { test, expect } from "@playwright/test";

for (const locale of ["ko", "en"]) {
  const en = locale === "en", prefix = en ? "/en" : "";
  test(`compact upload and honest CSV continuation (${locale})`, async ({ page }) => {
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${prefix}/dashboard`);
    const uploader = page.locator('.csv-uploader[data-hydrated="true"]').first();
    await expect(uploader).toBeVisible();
    const help = uploader.getByRole("button", { name: en ? "How to upload" : "업로드 방법 보기", exact: true });
    await expect(uploader.locator(".csv-guide-actions")).toContainText(en ? "How to upload" : "업로드 방법 보기");
    await expect(page.locator(".analysis-setup__context")).toHaveCount(0);
    await expect(page.locator(".tool-connection-card.is-same-data")).toHaveCount(0);
    const drop = await uploader.locator(".csv-dropzone").boundingBox();
    expect(drop.height).toBeLessThan(260);
    await help.click();
    await expect(page.getByRole("dialog", { name: en ? "Video guide" : "영상 사용 안내", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(help).toBeFocused();
    await uploader.locator('input[type="file"][accept*="csv"]').first().setInputFiles("public/examples/weekly-report-campaigns.csv");
    await expect(uploader.locator(".file-state")).toContainText("weekly-report-campaigns.csv");
    const next = page.locator(`.tool-connection-card[href="${prefix}/tools/campaign-variance"]`);
    await expect(next).toContainText(en ? "Continue with the same CSV" : "같은 CSV로 이어보기");
    await next.click();
    await expect(page).toHaveURL(new RegExp(`${prefix}/tools/campaign-variance`));
    await expect(page.locator(".analysis-setup__context")).toContainText(en ? /[1-9][\d,]* source rows/ : /[1-9][\d,]* 원본 행/);
    await expect(page.getByRole("banner")).toContainText("weekly-report-campaigns.csv");
    expect(errors).toEqual([]);
  });

  for (const route of ["/tools/campaign-variance", "/tools/campaign-saturation", "/tools/budget-allocation", "/content/freshness"]) {
  test(`empty entry has one title and no pretend summary (${locale}, ${route})`, async ({ page }) => {
    await page.goto(`${prefix}${route}`);
    await expect(page.locator('.csv-uploader[data-hydrated="true"]')).toBeVisible();
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator(".tool-page-shell__main > .summary")).toHaveCount(0);
    await expect(page.locator(".analysis-setup__context")).toHaveCount(0);
    await expect(page.locator(".tool-upload-entry .callout.warning")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    const help = page.locator(".csv-guide-actions .tutorial-inline");
    await expect(help).toBeVisible();
    const controls = await page.locator(".csv-guide-actions > button").all();
    for (const control of controls) {
      const box = await control.boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });
  }
}
