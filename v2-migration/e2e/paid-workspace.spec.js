import { test, expect } from "@playwright/test";
import { expectNoSeriousAccessibilityViolations } from "./support/quality";

for (const locale of ["ko", "en"]) {
  const en = locale === "en", prefix = en ? "/en" : "", tag = en ? " @light-en" : "";
  test(`plan comparison, current plan and purchase navigation (${locale})${tag}`, async ({ page }) => {
    let paid = false;
    await page.route("**/api/payments/config", route => route.fulfill({ json: { enabled: false, mode: "test" } }));
    await page.route("**/api/payments/access", route => route.fulfill({ json: { entitlement: paid ? { plan: "paid", payment: true, verifiedAt: Date.now(), expiresAt: Date.now() + 86400000, offlineUntil: Date.now() + 86400000 } : null } }));
    await page.goto(`${prefix}/subscription`);
    const free = page.getByRole("article", { name: en ? "Free" : "무료", exact: true });
    const pro = page.getByRole("article", { name: "Pro", exact: true });
    await expect(free).toContainText(en ? "Your current plan" : "현재 이용 플랜");
    await expect(pro).toContainText("5,900");
    await expect(pro).toContainText(en ? "no automatic renewal" : "자동 갱신 없음");
    await expect(free.getByRole("link")).toHaveAttribute("href", `${prefix}/start`);
    const choose = pro.getByRole("link", { name: en ? "Choose Pro" : "Pro 이용권 선택", exact: true });
    await choose.focus(); await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`${prefix}/subscription#purchase$`));
    await expect(page.locator("#purchase")).toContainText("5,900");
    for (const light of [false, true]) {
      // Reload with the chosen theme; sampling during a color transition creates false contrast failures.
      await page.evaluate(lightMode => localStorage.setItem("mkt-library-theme", lightMode ? "light" : "dark"), light);
      await page.reload();
      await expect(pro).toBeVisible();
      if (light) await expect(page.locator("body")).toHaveClass(/light-mode/);
      else await expect(page.locator("body")).not.toHaveClass(/light-mode/);
      await expectNoSeriousAccessibilityViolations(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    }
    paid = true;
    await page.reload();
    await expect(pro).toContainText(en ? "Your current plan" : "현재 이용 플랜");
    await expect(free).not.toContainText(en ? "Your current plan" : "현재 이용 플랜");
  });
  test(`unpaid report gate and seller product page (${locale})${tag}`, async ({ page }) => {
    await page.route("**/api/payments/config", route => route.fulfill({ json: { enabled: false, mode: "test" } }));
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
    await expect(gate.getByRole("link", { name: en ? "Save or back up my work" : "작업 보관·백업하기" })).toHaveAttribute("href", `${prefix}/projects`);
    await gate.getByRole("link", { name: en ? "Contact support" : "고객센터 문의" }).click();
    await expect(page).toHaveURL(new RegExp(`${prefix}/contact$`));
    await page.goto(`${prefix}/subscription#purchase`);
    await expect(page.locator("#purchase")).toContainText("5,900");
    await expect(page.locator(".seller-information").first()).toContainText("856-07-03210");
    await expect(page.locator("#refund-policy")).toContainText(en ? "7 days" : "7일");
    await expectNoSeriousAccessibilityViolations(page);
    expect(downloads).toHaveLength(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  });
  test(`payment action follows methods and agreement (${locale})${tag}`, async ({ page }) => {
    await page.route("**/api/payments/config", route => route.fulfill({ json: { enabled: true, mode: "test", clientKey: "test_gck_fixture" } }));
    await page.route("**/api/payments/access", route => route.fulfill({ json: { entitlement: null } }));
    await page.route("**/api/payments/order", route => route.fulfill({ json: { customerKey: "fixture", orderId: "fixture", amount: 5900 } }));
    await page.addInitScript(() => {
      window.TossPayments = () => ({ widgets: () => ({
        setAmount: async () => {},
        renderPaymentMethods: async ({ selector }) => { document.querySelector(selector).textContent = "Payment methods fixture"; },
        renderAgreement: async ({ selector }) => { document.querySelector(selector).textContent = "Agreement fixture"; },
      }) });
    });
    await page.goto(`${prefix}/subscription#purchase`);
    await page.getByRole("button", { name: en ? "Choose payment method" : "결제수단 선택", exact: true }).click();
    const pay = page.getByRole("button", { name: en ? "Pay KRW 5,900" : "5,900원 결제하기", exact: true });
    await expect(pay).toBeEnabled();
    expect(await pay.evaluate(button => Boolean(document.querySelector("#toss-payment-agreement").compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
    expect((await pay.boundingBox()).y).toBeGreaterThan((await page.locator("#toss-payment-agreement").boundingBox()).y);
  });
  test(`mock checkout approval and recovery (${locale})${tag}`, async ({ page }) => {
    const sent = [];
    await page.route("**/api/payments/config", route => route.fulfill({ json: { enabled: true, mode: "test", clientKey: "test_gck_fixture" } }));
    await page.route("**/api/payments/confirm", route => { sent.push(route.request().postDataJSON()); return route.fulfill({ json: { mode: "test", recoveryCode: "test-recovery-code", entitlement: { plan: "paid", payment: true, verifiedAt: Date.now(), expiresAt: Date.now() + 86400000, offlineUntil: Date.now() + 86400000 } } }); });
    await page.route("**/api/payments/access", route => route.fulfill({ json: { entitlement: null } }));
    await page.goto(`${prefix}/subscription?payment=confirm#purchase`);
    await expect(page.locator(".subscription-checkout")).toContainText(en ? "Payment confirmed" : "결제를 확인했습니다");
    await expect(page).toHaveURL(new RegExp(`${prefix}/subscription#purchase$`));
    await expect(page.locator(".checkout-widgets")).toBeHidden();
    await expect(page.locator(".checkout-access-card").getByRole("button")).toBeVisible();
    await expect(page.getByLabel(en ? "Private recovery code" : "이용권 복원 코드", { exact: true })).toBeVisible();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: en ? "Save pass recovery code" : "이용권 복원 코드 보관", exact: true }).click();
    expect((await download).suggestedFilename()).toBe("growthopt-pass-recovery.txt");
    expect(sent).toEqual([{}]);
  });
}
