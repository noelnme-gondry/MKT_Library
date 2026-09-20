import { test, expect } from "@playwright/test";
import { expectNoSeriousAccessibilityViolations } from "./support/quality";

for (const locale of ["ko", "en"]) {
  test(`free analysis → actual report preview → Pro download (${locale})${locale === "en" ? " @light-en" : ""}`, async ({ page }) => {
    const en = locale === "en";
    await page.route("**/api/payments/access", route => route.fulfill({ json: { entitlement: null } }));
    await page.goto(`${en ? "/en" : ""}/dashboard`);
    await expect(page.locator('.csv-uploader[data-hydrated="true"]')).toBeVisible();
    await page.getByRole("button", { name: en ? "Run the example and see results" : "예시 데이터로 결과 바로 보기", exact: true }).click();
    await page.getByRole("dialog", { name: en ? "You're currently viewing demo data" : "지금은 데모 데이터를 이용 중입니다" }).getByRole("button", { name: en ? "Not now" : "나중에", exact: true }).click();
    const result = page.locator(".dashboard-briefing .result-action-card");
    const preview = result.getByRole("button", { name: en ? "Preview my report · free" : "내 보고서 미리보기 · 무료", exact: true });
    await preview.click();
    const dialog = page.getByRole("dialog", { name: en ? "Your report preview" : "내 보고서 미리보기" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(en ? "Sample data" : "샘플 데이터");
    await expect(page.locator(".purchase-dialog")).toHaveCount(0);
    await expectNoSeriousAccessibilityViolations(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await dialog.getByRole("button", { name: en ? "Close" : "닫기", exact: true }).click();
    await expect(preview).toBeFocused();
    await preview.click();
    await dialog.getByRole("button", { name: en ? "Download Word report · Pro" : "Word 보고서 다운로드 · Pro", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator(".purchase-dialog")).toBeVisible();
  });
}
