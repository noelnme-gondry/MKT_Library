import { test, expect } from "@playwright/test";

for (const en of [false, true]) {
  test(`NICEPAY checkout respects provider cutover ${en ? "@light-en" : "ko"}`, async ({ page }) => {
    await page.route("**/*", route => ["127.0.0.1", "localhost"].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
    let orderProvider = "toss";
    await page.route("**/api/payments/config", route => route.fulfill({ json: {
      enabled: true, provider: "nicepay", mode: "live", clientKey: "fixture", requiresAccount: false,
    } }));
    await page.route("**/api/payments/access", route => route.fulfill({ json: { entitlement: null } }));
    await page.route("**/api/payments/order", route => route.fulfill({ json: {
      orderId: "gop_00000000-0000-4000-8000-000000000001", amount: 5900, provider: orderProvider, mode: "live",
    } }));
    await page.addInitScript(() => {
      window.__niceCalls = [];
      window.AUTHNICE = { requestPay: input => window.__niceCalls.push({ method: input.method, amount: input.amount, language: input.language, returnUrl: input.returnUrl }) };
    });
    const path = `${en ? "/en" : ""}/subscription#purchase`;
    await page.goto(path);
    const pay = page.getByRole("button", { name: en ? "Pay KRW 5,900" : "5,900원 결제하기", exact: true });
    await pay.click();
    await expect(page.getByText(en ? /Checkout settings changed/ : /결제 설정이 변경됐습니다/)).toBeVisible();
    expect(await page.evaluate(() => window.__niceCalls)).toEqual([]);
    orderProvider = "nicepay";
    await page.reload();
    await pay.click();
    await expect.poll(() => page.evaluate(() => window.__niceCalls.length)).toBe(1);
    expect(await page.evaluate(() => window.__niceCalls[0])).toEqual({ method: "card", amount: 5900, language: en ? "EN" : "KO", returnUrl: `http://127.0.0.1:3100/api/payments/nicepay/return?locale=${en ? "en" : "ko"}` });
    await expect(page.getByText(en ? /Payment confirmed\./ : /결제를 확인했습니다\./)).toHaveCount(0);
  });
}
