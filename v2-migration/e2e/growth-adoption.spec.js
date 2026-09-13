import { test, expect } from "@playwright/test";
import { expectNoSeriousAccessibilityViolations } from "./support/quality";

for (const locale of ["ko", "en"]) {
  const en = locale === "en", prefix = en ? "/en" : "";
  test(`task inputs and editorial hierarchy (${locale})`, async ({ page, request }) => {
    await page.goto(`${prefix}/templates`);
    const tasks = page.locator(".task-template-paths");
    await expect(tasks.locator("li")).toHaveCount(3);
    for (const href of await tasks.locator("nav a").evaluateAll(nodes => nodes.map(node => node.getAttribute("href")))) {
      expect((await request.get(href)).ok(), href).toBe(true);
    }
    await expect(page.getByRole("button", { name: en ? "Download sample Word" : "Word 샘플 받기" })).toBeVisible();
    for (const button of await tasks.getByRole("button").all()) {
      const bounds = await button.boundingBox();
      expect(bounds.height).toBeGreaterThanOrEqual(44);
      expect(bounds.width).toBeGreaterThanOrEqual(44);
    }
    await page.getByText(en ? "Private Google Sheets → CSV upload" : "비공개 Google Sheets → CSV 업로드", { exact: true }).click();
    await expect(page.locator(".source-export-guide details[open]")).toContainText(en ? "Keep the sheet private" : "공개 범위를 바꾸지");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.goto(`${prefix}/blog/budget-scaling-limit`);
    await expect(page.locator(".content-answer__action")).toHaveCount(0);
    await expect(page.locator(".content-answer__label")).toHaveText(en ? "Key takeaway" : "핵심 요약");
    await expect(page.locator(".blog-practice-prep")).toBeVisible();
    for (const light of [false, true]) {
      await page.evaluate(value => localStorage.setItem("mkt-library-theme", value ? "light" : "dark"), light);
      await page.reload();
      if (light) await expect(page.locator("body")).toHaveClass(/light-mode/);
      else await expect(page.locator("body")).not.toHaveClass(/light-mode/);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await expectNoSeriousAccessibilityViolations(page);
    }
  });

  test(`free actual report preview preserves focus and paid download boundary (${locale})`, async ({ page }) => {
    await page.route("**/api/payments/config", route => route.fulfill({ json: { enabled: false, mode: "test" } }));
    await page.route("**/api/payments/access", route => route.fulfill({ json: { entitlement: null } }));
    await page.route("**/api/account/session", route => route.fulfill({ json: { enabled: true, signupRestricted: true, account: null } }));
    const downloads = []; page.on("download", download => downloads.push(download));
    await page.goto(`${prefix}/dashboard`);
    await expect(page.locator('.csv-uploader[data-hydrated="true"]')).toBeVisible();
    await page.getByRole("button", { name: en ? "Run the example and see results" : "예시 데이터로 결과 바로 보기", exact: true }).click();
    await page.getByRole("dialog", { name: en ? "You're currently viewing demo data" : "지금은 데모 데이터를 이용 중입니다" }).getByRole("button", { name: en ? "Not now" : "나중에", exact: true }).click();
    const card = page.locator(".dashboard-briefing .result-action-card");
    const headline = await card.locator(".result-action-card__headline").textContent();
    const trigger = card.getByRole("button", { name: en ? "Download" : "결과 받기", exact: true });
    await trigger.click();
    await page.getByRole("menuitem", { name: en ? /Preview my report/ : /내 보고서 미리보기/ }).click();
    const preview = page.getByRole("dialog", { name: en ? "Your report preview" : "내 보고서 미리보기" });
    await expect(preview).toContainText(headline);
    await expect(preview).toContainText(en ? "limitations" : "해석 한계");
    const closeBounds = await preview.getByRole("button", { name: en ? "Close" : "닫기", exact: true }).boundingBox();
    expect(closeBounds.height).toBeGreaterThanOrEqual(44);
    expect(closeBounds.width).toBeGreaterThanOrEqual(44);
    expect(await preview.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    await expectNoSeriousAccessibilityViolations(page);
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await trigger.click();
    await page.getByRole("menuitem", { name: /Word/ }).click();
    await expect(page.locator(".purchase-dialog")).toBeVisible();
    expect(downloads).toHaveLength(0);
  });
}
