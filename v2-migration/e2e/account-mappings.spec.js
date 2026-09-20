import { test, expect } from "@playwright/test";
import { expectNoSeriousAccessibilityViolations } from "./support/quality";

for (const en of [false, true]) {
  test(`account rules travel to another browser and apply to CSV and Sheets (${en ? "en" : "ko"})`, async ({ browser, page }) => {
    const prefix = en ? "/en" : "";
    let rules = [];
    const writes = [];
    const setup = async target => {
      await target.route("**/api/account/session", route => route.fulfill({ json: { enabled: true, account: { id: "mapping-owner", email: "mapping@example.com" }, entitlement: { plan: "paid", account: true, expiresAt: Date.now() + 86400000, offlineUntil: Date.now() + 3600000 } } }));
      await target.route("**/api/payments/access", route => route.fulfill({ json: { entitlement: null } }));
      await target.route("**/api/account/mappings", route => {
        if (route.request().method() === "POST") { const body = route.request().postDataJSON(); writes.push(body); rules = body.rules; }
        return route.fulfill({ json: { accountId: "mapping-owner", rules, enabled: true, canApply: true } });
      });
    };
    await setup(page);
    await page.goto(`${prefix}/account`);
    const settings = page.locator(".account-mapping");
    const manual = settings.getByLabel(en ? "Enter manually" : "직접 입력", { exact: true });
    await expect(manual).toBeEnabled();
    await manual.fill("custom_budget");
    await settings.getByRole("combobox", { name: en ? "Field this tool uses" : "이 도구가 쓰는 항목", exact: true }).selectOption("media_spend");
    await settings.getByRole("button", { name: en ? "Add" : "추가", exact: true }).click();
    await expect(settings.getByRole("rowheader", { name: "custom_budget" })).toBeVisible();
    expect(writes).toEqual([{ rules: [{ normalizedColumnName: "custom_budget", canonicalKey: "media_spend" }] }]);
    await expectNoSeriousAccessibilityViolations(page);

    const context = await browser.newContext({ viewport: page.viewportSize(), storageState: { cookies: [], origins: [] } });
    const other = await context.newPage();
    try {
      await setup(other);
      await other.goto(`${prefix}/account`);
      await expect(other.locator(".account-mapping").getByRole("rowheader", { name: "custom_budget" })).toBeVisible();
      const csv = "Date,Channel,custom_budget,Installs\n2026-09-01,Meta,123456,20\n2026-09-02,Meta,654321,30";
      const posts = [];
      other.on("request", request => { if (request.method() === "POST") posts.push(request.postData() || ""); });
      for (const source of ["csv", "sheets"]) {
        await other.goto(`${prefix}/dashboard`);
        const uploader = other.locator('.csv-uploader[data-hydrated="true"]').first();
        if (source === "csv") await uploader.locator('input[type="file"][accept*="csv"]').first().setInputFiles({ name: "private-source.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
        else {
          await other.locator(".header-utility-menu__trigger").click();
          await other.getByRole("button", { name: en ? "Change CSV" : "CSV 변경", exact: true }).click();
          await other.route("https://docs.google.com/spreadsheets/**/export?**", route => route.fulfill({ contentType: "text/csv", body: csv }));
          await uploader.getByRole("button", { name: /Google Sheet/ }).click();
          await uploader.getByLabel(en ? "Google Sheets link" : "구글 시트 링크", { exact: true }).fill("https://docs.google.com/spreadsheets/d/fixtureSheet123456789012345/edit#gid=0");
          await uploader.getByRole("button", { name: en ? "Import" : "불러오기", exact: true }).click();
        }
        await expect(uploader.locator(".csv-account-mapping-notice")).toContainText(en ? "Account rules applied: 1" : "계정 규칙 1개 적용");
        await expect(uploader.getByRole("combobox", { name: /^custom_budget:/ })).toHaveValue("cost");
      }
      expect(posts.join(" ")).not.toMatch(/123456|654321|private-source/);
    } finally { await context.close(); }
  });
}
