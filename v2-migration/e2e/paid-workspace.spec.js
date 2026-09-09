import { test, expect } from "@playwright/test";
import { expectNoSeriousAccessibilityViolations } from "./support/quality";

for (const locale of ["ko", "en"]) {
  const en = locale === "en", prefix = en ? "/en" : "", tag = en ? " @light-en" : "";
  test(`unpaid report gate and seller product page (${locale})${tag}`, async ({ page }) => {
    await page.goto(`${prefix}/dashboard`);
    await expect(page.locator('.csv-uploader[data-hydrated="true"]')).toBeVisible();
    await page.getByRole("button", { name: en ? "Run the example and see results" : "예시 데이터로 결과 바로 보기", exact: true }).click();
    const demo = page.getByRole("dialog", { name: en ? "You're currently viewing demo data" : "지금은 데모 데이터를 이용 중입니다" });
    await demo.getByRole("button", { name: en ? "Not now" : "나중에", exact: true }).click();
    const downloads = []; page.on("download", download => downloads.push(download));
    const trigger = page.locator(".dashboard-briefing .result-action-card").getByRole("button", { name: en ? "Download" : "결과 받기", exact: true });
    await trigger.focus(); await page.keyboard.press("Enter");
    const gate = page.getByRole("dialog", { name: en ? "Take your analysis into your next meeting" : "분석을 다음 회의에서 바로 쓰세요" });
    await expect(gate).toBeVisible(); await expect(gate).toContainText("Word"); await expect(gate).toContainText("Excel");
    await expectNoSeriousAccessibilityViolations(page);
    await page.keyboard.press("Escape"); await expect(gate).toBeHidden(); await expect(trigger).toBeFocused();
    await trigger.click();
    await gate.getByRole("link").click();
    await expect(page).toHaveURL(new RegExp(`${prefix}/subscription#purchase$`));
    await expect(page.locator("#purchase")).toContainText("5,900");
    await expect(page.locator(".seller-information").first()).toContainText("856-07-03210");
    await expect(page.locator("#refund-policy")).toContainText(en ? "7 days" : "7일");
    await expectNoSeriousAccessibilityViolations(page);
    expect(downloads).toHaveLength(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  });
  test(`mock checkout approval and recovery (${locale})${tag}`, async ({ page }) => {
    const sent = [];
    await page.route("**/api/payments/config", route => route.fulfill({ json: { enabled: true, mode: "test", clientKey: "test_gck_fixture" } }));
    await page.route("**/api/payments/confirm", route => { sent.push(route.request().postDataJSON()); return route.fulfill({ json: { mode: "test", recoveryCode: "test-recovery-code", entitlement: { plan: "paid", payment: true, verifiedAt: Date.now(), expiresAt: Date.now() + 86400000, offlineUntil: Date.now() + 86400000 } } }); });
    await page.route("**/api/payments/access", route => route.fulfill({ json: { entitlement: null } }));
    await page.goto(`${prefix}/subscription?payment=confirm#purchase`);
    await expect(page.locator(".subscription-checkout")).toContainText(en ? "Payment confirmed" : "결제를 확인했습니다");
    await expect(page).toHaveURL(new RegExp(`${prefix}/subscription#purchase$`));
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: en ? "Save pass recovery code" : "이용권 복원 코드 보관", exact: true }).click();
    expect((await download).suggestedFilename()).toBe("growthopt-pass-recovery.txt");
    expect(sent).toEqual([{}]);
  });
}
