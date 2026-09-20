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
      // 메모 저장은 더 이상 체험을 시작하지 않는다 — 트리거는 프로젝트 생성 하나다.
      if (route.request().method() === "POST") { sentMemos.push(route.request().postDataJSON()); return route.fulfill({ json: { memo: {} } }); }
      return route.fulfill({ json: { memos: [] } });
    });
    await page.route("**/api/account/trial", route => {
      trial = true;
      return route.fulfill({ json: { trialStarted: true, entitlement: { plan: "paid", account: true, trial: true, expiresAt: Date.now() + 86400000, offlineUntil: Date.now() + 86400000 } } });
    });
    await page.addInitScript(() => {
      window.__saveFailures = [];
      window.dataLayer = [];
      const push = window.dataLayer.push.bind(window.dataLayer);
      window.dataLayer.push = (...items) => { for (const item of items) if (item?.[0] === "event" && item[1] === "weekly_review_save_failed") window.__saveFailures.push(item[1]); return push(...items); };
    });
    await page.goto(`${prefix}/weekly-review#weekly-performance`);
    // 프로젝트가 없으면 업로더가 아니라 관문이 먼저 선다. 여기가 14일 체험을 켜는
    // 유일한 자리다 — 예전에는 "첫 계정 메모 저장"이었다.
    //
    // 하이드레이션 전에 누른 클릭은 핸들러가 아직 없어 먹지 않는다. 버튼은 SSR
    // HTML에 이미 있으므로 Playwright는 바로 누를 수 있고, 그래서 재시도해야 한다.
    const createProject = page.getByRole("button", { name: en ? "Create a project" : "새 프로젝트 만들기", exact: true });
    const rows = Array.from({ length: 14 }, (_, day) => `${new Date(Date.UTC(2026, 7, 24 + day)).toISOString().slice(0, 10)},PrivateCampaign,Google,${day < 7 ? 1000 : 1500},100,1000,10000`);
    const uploader = page.locator('.csv-uploader[data-hydrated="true"]').first();
    // 이미 로그인돼 있으면 관문은 로그인 버튼을 다시 누르게 하지 않고 바로 통과시킨다.
    // 그래서 기다릴 것은 모달 제목이 아니라 업로더다.
    await expect(async () => {
      await createProject.click();
      await expect(uploader).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 25000 });
    await uploader.locator('input[type="file"][accept*="csv"]').first().setInputFiles({ name: "private-source.csv", mimeType: "text/csv", buffer: Buffer.from(`Date,Campaign,Channel,Cost,Actions,Clicks,Impressions\r\n${rows.join("\r\n")}`) });
    await expect(uploader.locator(".file-state")).toContainText("private-source.csv");
    // 분석을 돌리면 결과 화면으로 바뀌며 업로더가 사라진다("다음 주 CSV" 접기를 없앴다).
    // 그래서 "몰래 저장하지 않는다" 확인은 업로더가 살아 있는 지금 한다.
    await expect(uploader).not.toContainText(en ? "Saving on this device" : "이 기기에 저장하는 중");
    await uploader.locator('[data-currency-scope="declare"]').getByRole("button", { name: /^(원 ₩|KRW ₩)$/ }).click();
    await uploader.getByRole("button", { name: en ? "Analyze data" : "데이터 분석하기", exact: true }).click();
    await expect(page.locator("#wr-verdict")).toBeVisible();
    // 프로젝트 자체는 사용자가 "새 프로젝트 만들기"로 명시적으로 만든 것이라 있어도 된다.
    // 지켜야 할 계약은 **저장을 누르기 전에는 결정이 담기지 않는다**는 쪽이다.
    expect((await storedProjects(page)).flatMap((project) => project.decisions || [])).toEqual([]);
    await page.getByRole("button", { name: en ? "Record decision for: Google / PrivateCampaign" : "결정 기록: Google / PrivateCampaign", exact: true }).click();
    await page.getByRole("button", { name: en ? "Save this decision" : "이 결정 저장", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: en ? "Save review" : "리뷰 저장", exact: true });
    // 관문에서 체험을 켜며 이 기기에 프로젝트 자리가 생겼다. 분석 집계(스냅샷)도
    // 그 프로젝트에 붙으므로, 여기서 또 새 프로젝트를 만들면 집계가 따라오지 않는다.
    // 실제 흐름대로 방금 만든 그 프로젝트에 이름을 붙여 저장한다.
    await dialog.getByRole("textbox", { name: en ? "Project name" : "프로젝트 이름", exact: true }).fill("Trial project");
    // 이미 있는 프로젝트에 저장하면 "리뷰 저장", 새로 만들면 "프로젝트 만들고 저장"이다.
    const localSave = dialog.getByRole("button", { name: en ? /^(Create project and save|Save review)$/ : /^(프로젝트 만들고 저장|리뷰 저장)$/ });
    // 체험은 관문에서 이미 켜졌으므로 이 기기 저장은 열려 있다.
    await expect(localSave).toBeEnabled();
    expect(sentMemos).toEqual([]);
    await expectNoSeriousAccessibilityViolations(page);
    expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    await localSave.click();
    await expect(dialog.getByRole("heading", { name: en ? "Review saved" : "리뷰를 저장했습니다" })).toBeVisible();

    // 계정 보관은 저장 이후에 별개 동의로 제안된다 — 이 기기 저장과 다른 결정이다.
    await dialog.getByText(en ? "Keep a memo in my account (optional)" : "계정에 메모 보관 (선택)", { exact: true }).click();
    const accountSave = dialog.getByRole("button", { name: en ? "Save decision to account" : "결정 메모 계정에 저장", exact: true });
    await expect(accountSave).toBeDisabled();
    expect(sentMemos).toEqual([]);
    await dialog.getByRole("checkbox", { name: en ? "Store this selected memo in my account." : "선택한 메모를 계정에 보관합니다.", exact: true }).check();
    await accountSave.click();
    await expect.poll(() => sentMemos.length).toBe(1);
    // 원본 CSV·매핑·집계는 계정으로 보내지 않는다(§2.2).
    expect(JSON.stringify(sentMemos)).not.toMatch(/private-source.csv|"raw"|"mapping"|"snapshots"/);
    await dialog.getByRole("button", { name: en ? "Done" : "닫기", exact: true }).click();
    // 결정이 담긴 프로젝트는 방금 이름 붙인 하나뿐이다(관문이 만든 빈 자리는 비어 있다).
    await expect.poll(async () => (await storedProjects(page)).filter((project) => (project.decisions || []).length).length).toBe(1);
    expect(await page.evaluate(() => window.__saveFailures)).toEqual([]);
    const saved = (await storedProjects(page)).find((project) => (project.decisions || []).length);
    expect(saved.decisions).toHaveLength(1);
    await expect.poll(async () => ((await storedProjects(page)).find((project) => (project.decisions || []).length)?.snapshots || []).length).toBeGreaterThan(0);
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
    const after = (await storedProjects(page)).filter((project) => (project.decisions || []).length);
    expect(after).toHaveLength(1);
    expect(after[0].decisions).toEqual(saved.decisions);
    expect(pageErrors).toEqual([]);
  });
}
