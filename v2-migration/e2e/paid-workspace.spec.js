import { test, expect } from "@playwright/test";
import { expectNoSeriousAccessibilityViolations } from "./support/quality";

for (const locale of ["ko", "en"]) {
  const en = locale === "en", prefix = en ? "/en" : "", tag = en ? " @light-en" : "";
  for (const state of ["trial", "expired", "purchased"]) {
    test(`analysis download requires a current purchase: ${state} (${locale})${tag}`, async ({ page }) => {
      const entitlement = { plan: "paid", account: true, trial: state === "trial", expiresAt: Date.now() + (state === "expired" ? -60000 : 86400000), offlineUntil: Date.now() + 3600000 };
      await page.route("**/api/payments/config", route => route.fulfill({ json: { enabled: true, mode: "test", clientKey: "test_gck_fixture" } }));
      await page.route("**/api/payments/access", route => route.fulfill({ json: { entitlement: null } }));
      await page.route("**/api/account/session", route => route.fulfill({ json: { enabled: true, account: { id: "download-test", email: "test@example.com", trialStartedAt: new Date().toISOString() }, entitlement } }));
      await page.addInitScript(() => { window.__prints = 0; window.print = () => { window.__prints += 1; }; });
      const downloads = []; page.on("download", download => downloads.push(download));
      await page.goto(`${prefix}/dashboard`);
      await page.locator(".my-account-menu > summary").click();
      await expect(page.locator(".my-account-menu__panel")).toContainText("test@example.com");
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: en ? "Run the example and see results" : "예시 데이터로 결과 바로 보기", exact: true }).click();
      await page.getByRole("dialog", { name: en ? "You're currently viewing demo data" : "지금은 데모 데이터를 이용 중입니다" }).getByRole("button", { name: en ? "Not now" : "나중에", exact: true }).click();
      await page.locator(".dashboard-briefing .result-action-card").getByRole("button", { name: en ? "Download" : "결과 받기", exact: true }).click();
      if (state === "purchased") {
        await expect(page.getByRole("menuitem", { name: /Word/ })).toBeVisible();
      } else {
        const gate = page.locator(".purchase-dialog");
        await expect(gate).toBeVisible();
        await expect(gate).toContainText(en ? "14-day trial do not unlock downloads" : "14일 체험만으로는 다운로드할 수 없습니다");
        await page.keyboard.press("Escape");
        await page.locator(".header-utility-menu > summary").click();
        await page.locator(".header-print").click();
        await expect(gate).toBeVisible();
        expect(await page.evaluate(() => window.__prints)).toBe(0);
        await gate.getByRole("link", { name: en ? "View the pass and purchase" : "이용권 확인하고 구매", exact: true }).click();
        await expect(page).toHaveURL(new RegExp(`${prefix}/subscription#purchase$`));
      }
      expect(downloads).toHaveLength(0);
    });
  }
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
    // Anonymous negative checks expire after five minutes. A server-only change
    // does not represent this tab's explicit purchase/restore (which clears it).
    await expect(pro).not.toContainText(en ? "Your current plan" : "현재 이용 플랜");
    await page.clock.setSystemTime(new Date(Date.now() + 300001));
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
    await expect(page).not.toHaveTitle("");
    await expectNoSeriousAccessibilityViolations(page);
    await page.keyboard.press("Escape"); await expect(gate).toBeHidden(); await expect(trigger).toBeFocused();
    await trigger.click();
    await expect(gate.getByRole("link", { name: en ? "Save or back up my work" : "작업 보관·백업하기" })).toHaveCount(0);
    await expect(gate).toContainText(en ? "browser" : "브라우저");
    await gate.getByRole("link", { name: en ? "View free sample reports" : "무료 샘플 보고서 보기" }).click();
    await expect(page).toHaveURL(new RegExp(`${prefix}/subscription#report-preview-title$`));
    await page.goto(`${prefix}/subscription#purchase`);
    await expect(page.locator("#purchase")).toContainText("5,900");
    await expect(page.locator(".seller-information").first()).toContainText("856-07-03210");
    await expect(page.locator("#refund-policy")).toContainText(en ? "7 days" : "7일");
    await expect(page).not.toHaveTitle("");
    await expectNoSeriousAccessibilityViolations(page);
    expect(downloads).toHaveLength(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  });
  test(`payment action follows methods and agreement (${locale})${tag}`, async ({ page }) => {
    const orders = [];
    await page.route("**/api/payments/config", route => route.fulfill({ json: { enabled: true, mode: "test", clientKey: "test_gck_fixture" } }));
    await page.route("**/api/payments/access", route => route.fulfill({ json: { entitlement: null } }));
    await page.route("**/api/payments/order", route => { orders.push(route.request()); return route.fulfill({ json: { customerKey: "fixture", orderId: "fixture", amount: 5900 } }); });
    await page.addInitScript(() => {
      window.TossPayments = () => ({ widgets: () => ({
        setAmount: async () => {},
        renderPaymentMethods: async ({ selector }) => { document.querySelector(selector).textContent = "Payment methods fixture"; },
        renderAgreement: async ({ selector }) => { document.querySelector(selector).textContent = "Agreement fixture"; },
      }) });
    });
    await page.goto(`${prefix}/subscription#purchase`);
    await expect(page.getByRole("button", { name: en ? "Choose payment method" : "결제수단 선택", exact: true })).toHaveCount(0);
    const pay = page.getByRole("button", { name: en ? "Pay KRW 5,900" : "5,900원 결제하기", exact: true });
    await expect(pay).toBeEnabled();
    expect(orders).toHaveLength(0);
    expect(await pay.evaluate(button => Boolean(document.querySelector("#toss-payment-agreement").compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
    expect((await pay.boundingBox()).y).toBeGreaterThan((await page.locator("#toss-payment-agreement").boundingBox()).y);
  });
  test(`pending deposits do not offer another payment (${locale})${tag}`, async ({ page }) => {
    await page.route("**/api/payments/config", route => route.fulfill({ json: { enabled: true, mode: "test", clientKey: "test_gck_fixture" } }));
    await page.route("**/api/payments/access", route => route.fulfill({ json: { entitlement: null, status: "waiting_for_deposit", orderId: "gop_fixture_pending" } }));
    await page.goto(`${prefix}/subscription#purchase`);
    await expect(page.getByRole("heading", { name: en ? "Waiting for your deposit" : "입금 확인을 기다리고 있습니다" })).toBeVisible();
    await expect(page.getByRole("button", { name: en ? "Pay KRW 5,900" : "5,900원 결제하기", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: en ? "Check deposit status" : "입금 상태 확인" }).click();
    await expect(page.getByText(en ? /Deposit has not been confirmed/ : /아직 입금 완료가 확인되지 않았습니다/)).toBeVisible();
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
    await page.locator(".checkout-existing > summary").click();
    await expect(page.getByLabel(en ? "Private recovery code" : "이용권 복원 코드", { exact: true })).toBeVisible();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: en ? "Save pass recovery code" : "이용권 복원 코드 보관", exact: true }).click();
    expect((await download).suggestedFilename()).toBe("growthopt-pass-recovery.txt");
    expect(sent).toEqual([{}]);
  });
  test(`trial entry and trial-to-purchase state (${locale})${tag}`, async ({ page }) => {
    let started = false;
    const trialStartedAt = Date.now();
    await page.route("**/api/payments/config", route => route.fulfill({ json: { enabled: false, mode: "test" } }));
    await page.route("**/api/payments/access", route => route.fulfill({ json: { entitlement: null } }));
    await page.route("**/api/account/memos", route => route.fulfill({ json: { memos: [] } }));
    await page.route("**/api/account/session", route => route.fulfill({ json: { enabled: true, mailEnabled: false, account: { id: "fixture", email: "reader@example.com", trialStartedAt: started ? new Date(trialStartedAt).toISOString() : null }, entitlement: started ? { plan: "paid", account: true, trial: true, expiresAt: trialStartedAt + 14 * 86400000, offlineUntil: Date.now() + 300000 } : null } }));
    await page.goto(`${prefix}/subscription`);
    await expect(page.locator(".subscription-page .account-archive")).toHaveCount(0);
    await page.getByRole("link", { name: en ? "Save a decision to try Pro" : "결정 저장하고 Pro 체험하기", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${prefix}/weekly-review#account-archive$`));
    await expect(page.locator("#account-archive")).toBeInViewport();
    await expect(page.locator("#account-archive")).toContainText(en ? "First analyze your CSV" : "먼저 이 프로젝트에서 CSV를 분석");
    started = true;
    await page.goto(`${prefix}/subscription`);
    const pro = page.getByRole("article", { name: "Pro", exact: true });
    await expect(pro).toContainText(en ? "Pro trial · 14 days left" : "Pro 체험 중 · 14일 남음");
    await expect(pro).not.toContainText(en ? "Your current plan" : "현재 이용 플랜");
    await expect(pro.getByRole("link", { name: en ? "Choose Pro" : "Pro 이용권 선택" })).toBeVisible();
    await expectNoSeriousAccessibilityViolations(page);
  });
}
