import { expect, test } from "@playwright/test";
import { expectNoSeriousAccessibilityViolations } from "./support/quality";

for (const locale of ["ko", "en"]) {
  const en = locale === "en";
  test(`anonymous test widget does not start a real purchase (${locale})${en ? " @light-en" : ""}`, async ({ page }) => {
    const posts = [];
    page.on("request", request => { if (request.method() === "POST" && request.url().includes("/api/payments/")) posts.push(request.url()); });
    await page.route("**/*", route => ["127.0.0.1", "localhost"].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
    await page.route("**/api/payments/config", route => route.fulfill({ json: {
      enabled: false, clientKey: null, reviewClientKey: "test_gck_fixture", mode: "test", requiresAccount: true, accountAvailable: true,
      product: { name: "Growth Opt Playbook 1개월 보고서 이용권", amount: 5900, currency: "KRW" },
    } }));
    await page.addInitScript(() => {
      window.__reviewCalls = [];
      window.TossPayments = key => {
        window.__reviewCalls.push({ name: "initialize", key });
        return { widgets: () => ({
          setAmount: async amount => { window.__reviewCalls.push({ name: "amount", ...amount }); },
          renderPaymentMethods: async ({ selector }) => { document.querySelector(selector).textContent = "Card payment methods (test fixture)"; },
          renderAgreement: async ({ selector }) => { document.querySelector(selector).textContent = "Payment agreement (test fixture)"; },
          requestPayment: async options => { window.__reviewCalls.push({ name: "request", ...options }); },
        }) };
      };
    });
    await page.goto(`${en ? "/en" : ""}/subscription#purchase`);
    const review = page.locator(".checkout-review");
    await expect(review.getByRole("heading", { name: en ? "Test checkout for integration review" : "심사용 테스트 결제창" })).toBeVisible();
    expect(await page.evaluate(() => window.__reviewCalls)).toEqual([]);
    await review.getByRole("button", { name: en ? "Show test payment methods" : "테스트 결제수단 확인" }).click();
    const open = review.getByRole("button", { name: en ? "Open KRW 5,900 test checkout" : "5,900원 테스트 결제창 열기" });
    await expect(open).toBeVisible();
    await open.click();
    await expect.poll(() => page.evaluate(() => window.__reviewCalls.filter(call => call.name === "request").length)).toBe(1);
    const calls = await page.evaluate(() => window.__reviewCalls);
    expect(calls.find(call => call.name === "amount")).toMatchObject({ value: 5900, currency: "KRW" });
    expect(calls.find(call => call.name === "request")).toMatchObject({ orderId: expect.stringMatching(/^gop_review_/), successUrl: expect.stringContaining("/api/payments/review-return?") });
    expect(posts).toEqual([]);
    await expect(page.locator(".checkout-signin")).toHaveCount(0);
    expect(await review.evaluate(node => node.getBoundingClientRect().right <= innerWidth + 1)).toBe(true);
    await expectNoSeriousAccessibilityViolations(page);
  });
}
