import { test, expect } from "@playwright/test";
import { expectNoSeriousAccessibilityViolations } from "./support/quality";

async function storedProjects(page) {
  return page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("mkt_workspace");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise((resolve, reject) => {
        const request = db.transaction("meta").objectStore("meta").getAll();
        request.onsuccess = () => resolve(request.result.filter(item => item.key === `project:${item.id}`));
        request.onerror = () => reject(request.error);
      });
    } finally { db.close(); }
  });
}
for (const locale of ["ko", "en"]) {
  test(`free analysis → explicit trial → saved project → expired read-only (${locale})${locale === "en" ? " @light-en" : ""}`, async ({ page }) => {
    const en = locale === "en", prefix = en ? "/en" : "";
    let trial = false, expired = false;
    const sentMemos = [];
    const pageErrors = []; page.on("pageerror", error => pageErrors.push(error.message));
    await page.route("**/api/payments/config", route => route.fulfill({ json: { enabled: false, mode: "test" } }));
    await page.route("**/api/payments/access", route => route.fulfill({ json: { entitlement: null } }));
    await page.route("**/api/account/session", route => route.fulfill({ json: {
      enabled: true, mailEnabled: false,
      account: { id: "trial-test", email: "trial@example.com", trialStartedAt: trial ? "2026-09-01T00:00:00Z" : null },
      entitlement: trial && !expired ? { plan: "paid", account: true, trial: true, expiresAt: Date.now() + 86400000, offlineUntil: Date.now() + 86400000 } : null,
    } }));
    await page.route("**/api/account/memos", route => {
      if (route.request().method() === "POST") { sentMemos.push(route.request().postDataJSON()); trial = true; return route.fulfill({ json: { trialStarted: true } }); }
      return route.fulfill({ json: { memos: [] } });
    });
    await page.addInitScript(() => {
      window.__saveFailures = [];
      window.dataLayer = [];
      const push = window.dataLayer.push.bind(window.dataLayer);
      window.dataLayer.push = (...items) => { for (const item of items) if (item?.[0] === "event" && item[1] === "weekly_review_save_failed") window.__saveFailures.push(item[1]); return push(...items); };
    });
    await page.goto(`${prefix}/weekly-review`);
    const rows = Array.from({ length: 14 }, (_, day) => `${new Date(Date.UTC(2026, 7, 24 + day)).toISOString().slice(0, 10)},PrivateCampaign,Google,${day < 7 ? 1000 : 1500},100,1000,10000`);
    const uploader = page.locator('.csv-uploader[data-hydrated="true"]').first();
    await uploader.locator('input[type="file"][accept*="csv"]').first().setInputFiles({ name: "private-source.csv", mimeType: "text/csv", buffer: Buffer.from(`Date,Campaign,Channel,Cost,Actions,Clicks,Impressions\r\n${rows.join("\r\n")}`) });
    await expect(uploader.locator(".file-state")).toContainText("private-source.csv");
    await uploader.locator('[data-currency-scope="declare"]').getByRole("button", { name: /^(원 ₩|KRW ₩)$/ }).click();
    await uploader.getByRole("button", { name: en ? "Analyze data" : "데이터 분석하기", exact: true }).click();
    await expect(page.locator("#wr-verdict")).toBeVisible();
    expect(await storedProjects(page)).toEqual([]);
    await expect(uploader).not.toContainText(en ? "Saving on this device" : "이 기기에 저장하는 중");
    await page.getByRole("button", { name: en ? "Record decision for: Google / PrivateCampaign" : "결정 기록: Google / PrivateCampaign", exact: true }).click();
    await page.getByRole("button", { name: en ? "Save this decision" : "이 결정 저장", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: en ? "Save review" : "리뷰 저장", exact: true });
    await dialog.getByRole("textbox", { name: en ? "Project name" : "프로젝트 이름", exact: true }).fill("Trial project");
    const localSave = dialog.getByRole("button", { name: en ? "Create project and save" : "프로젝트 만들고 저장", exact: true });
    const accountSave = dialog.getByRole("button", { name: en ? "Save decision to account" : "결정 메모 계정에 저장", exact: true });
    await expect(localSave).toBeDisabled();
    await expect(accountSave).toBeDisabled();
    expect(sentMemos).toEqual([]);
    await expectNoSeriousAccessibilityViolations(page);
    expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    await dialog.getByRole("checkbox", { name: en ? "Store this selected memo in my account." : "선택한 메모를 계정에 보관합니다.", exact: true }).check();
    await accountSave.click();
    await expect(localSave).toBeEnabled();
    expect(sentMemos).toHaveLength(1);
    expect(JSON.stringify(sentMemos)).not.toMatch(/private-source.csv|"raw"|"mapping"|"snapshots"/);
    expect(await storedProjects(page)).toEqual([]);
    await localSave.click();
    await expect(dialog.getByRole("heading", { name: en ? "Review saved" : "리뷰를 저장했습니다" })).toBeVisible();
    await dialog.getByRole("button", { name: en ? "Done" : "닫기", exact: true }).click();
    await expect.poll(async () => (await storedProjects(page)).length).toBe(1);
    await expect.poll(async () => (await storedProjects(page))[0].snapshots.length).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.__saveFailures)).toEqual([]);
    const saved = (await storedProjects(page))[0];
    expect(saved.decisions).toHaveLength(1);
    expired = true;
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Trial project");
    await expect(page.locator(".file-state").first()).toContainText("private-source.csv");
    await page.goto(`${prefix}/weekly-review#project-management`);
    const project = page.locator(".project-card").filter({ has: page.getByRole("heading", { name: /Trial project/ }) });
    await expect(project).toBeVisible();
    const download = page.waitForEvent("download");
    await project.getByRole("button", { name: en ? "Export backup" : "백업 내보내기", exact: true }).click();
    expect((await download).suggestedFilename()).toBe("growthopt-project-backup.json");
    const backupPanel = page.locator("#project-backup");
    await backupPanel.getByRole("button", { name: en ? "Create project" : "프로젝트 만들기", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${prefix}/subscription$`));
    const after = await storedProjects(page);
    expect(after).toHaveLength(1);
    expect(after[0].decisions).toEqual(saved.decisions);
    expect(pageErrors).toEqual([]);
  });
}
