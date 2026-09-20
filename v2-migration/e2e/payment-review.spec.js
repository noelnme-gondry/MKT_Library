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
          renderPaymentMethods: async ({ selector }) => { const host = document.querySelector(selector); host.textContent = "Card payment methods (test fixture)"; host.style.minHeight = "500px"; },
          renderAgreement: async ({ selector }) => { document.querySelector(selector).textContent = "Payment agreement (test fixture)"; },
          requestPayment: async options => { window.__reviewCalls.push({ name: "request", ...options }); },
        }) };
      };
    });
    await page.goto(`${en ? "/en" : ""}/subscription#purchase`);
    const review = page.locator(".checkout-review");
    await expect(review.getByRole("heading", { name: en ? "Test checkout for integration review" : "심사용 테스트 결제창" })).toBeVisible();
    expect(await page.evaluate(() => window.__reviewCalls)).toEqual([]);
    // 심사 경로가 열려 있어도 일반 방문자는 구매 불가 사유와 무료 대안을 먼저 봐야 한다.
    await expect(page.getByText(en ? "Purchases are currently unavailable." : "지금은 구매할 수 없습니다.", { exact: false })).toBeVisible();
    await expect(page.getByRole("link", { name: en ? "Free sample reports" : "무료 샘플 보고서" })).toBeVisible();
    const details = page.locator(".checkout-purchase-info");
    await expect(details).toBeVisible();
    await expect(details.getByText(en ? /Sign in before purchasing/ : /구매 시 로그인이 필요/)).toBeVisible();

    await review.getByRole("button", { name: en ? "Show test payment methods" : "테스트 결제수단 확인" }).click();
    const open = review.getByRole("button", { name: en ? "Open KRW 5,900 test checkout" : "5,900원 테스트 결제창 열기" });
    await expect(open).toBeVisible();
    const layout = await page.locator("#purchase").evaluate(panel => {
      const summary = panel.querySelector(".purchase-summary").getBoundingClientRect();
      const payment = panel.querySelector(".purchase-payment").getBoundingClientRect();
      const button = panel.querySelector(".checkout-review button");
      const style = getComputedStyle(button);
      return { sideBySide: summary.right <= payment.left + 1, summaryHeight: summary.height, paymentHeight: payment.height, rowHeight: panel.getBoundingClientRect().height,
        buttonCentered: style.justifyContent === "center" && style.textAlign === "center", buttonHeight: button.getBoundingClientRect().height,
        overflow: panel.scrollWidth > panel.clientWidth + 1 };
    });
    expect(layout.buttonCentered).toBe(true);
    expect(layout.buttonHeight).toBeGreaterThanOrEqual(52);
    expect(layout.overflow).toBe(false);
    // 뷰포트별 기대 배치를 먼저 단언한다. `if (sideBySide)`로 감싸면 좁은 화면에서는
    // 아무것도 검사하지 않고, 데스크톱 그리드가 바뀌어도 조용히 통과한다.
    expect(layout.sideBySide).toBe(page.viewportSize().width > 1000);
    // 요약 칼럼이 열 구분선과 배경을 소유하므로 나란히 설 때는 행 전체 높이를 채워야 한다.
    if (layout.sideBySide) expect(layout.summaryHeight).toBeGreaterThanOrEqual(layout.rowHeight - 2);
    await expect(details.getByText(en ? /Sign in before purchasing/ : /구매 시 로그인이 필요/)).toBeVisible();

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
