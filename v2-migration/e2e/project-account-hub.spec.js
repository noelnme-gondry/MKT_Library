import { test, expect } from "@playwright/test";

for (const locale of ["ko", "en"]) {
  test(`decision library shows records before controls (${locale})${locale === "en" ? " @light-en" : ""}`, async ({ page }) => {
    const en = locale === "en";
    let memos = [];
    await page.route("**/api/account/session", route => route.fulfill({ json: { enabled: true, mailEnabled: true, account: { id: "library", email: "reader@example.com", serviceReminders: false }, entitlement: null } }));
    await page.route("**/api/account/memos", route => route.fulfill({ json: { memos } }));
    await page.goto(`${en ? "/en" : ""}/weekly-review#wr-history`);
    // 이 기기와 계정의 결정은 이제 한 목록이다. 따로 두면 한 기기에서는 거의 같아
    // 보여 차이를 아무도 설명할 수 없었다.
    const history = page.locator(".wr-history-list");
    // 이용권이 없어도 기록은 읽을 수 있다 — 사이트가 "만료 후 열람 유지"를 약속했다.
    // 막히는 것은 계정 보관과 새 저장뿐이고, 화면이 그 사실을 말한다.
    await expect(history.getByText(en ? /keep reading and exporting your records/ : /기록은 계속 읽고 내보낼 수 있습니다/)).toBeVisible();
    memos = [{ id: "memo-1", action: "Review the campaign budget", conclusion: "Check the next period before increasing spend.", reviewDate: "2026-10-01" }];
    await page.route("**/api/account/session", route => route.fulfill({ json: { enabled: true, mailEnabled: true, account: { id: "library", email: "reader@example.com", serviceReminders: false }, entitlement: { plan: "paid", account: true, trial: true, expiresAt: Date.now() + 86400000, offlineUntil: Date.now() + 3600000 } } }));
    await page.reload();
    await expect(history.getByRole("button", { name: new RegExp(memos[0].action) })).toBeVisible();
    // 계정에만 있는 결정은 이 기기로 가져올 수 있어야 한다(옛 보관함이 하던 일).
    await history.getByRole("button", { name: new RegExp(memos[0].action) }).click();
    await expect(history.getByRole("button", { name: en ? "Continue review" : "검토 이어하기", exact: true })).toBeVisible();
    expect(await history.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    await expect(page.locator(".csv-uploader")).toHaveCount(0);
    await expect(page.getByRole("button", { name: en ? "Decision review" : "결정 검토", exact: true })).toHaveAttribute("aria-pressed", "true");
  });
  test(`signed-in account copy stays aligned (${locale})${locale === "en" ? " @light-en" : ""}`, async ({ page }) => {
    const en = locale === "en";
    const email = "long.account.address.for.layout@example.com";
    await page.route("**/api/account/session", route => route.fulfill({ json: { enabled: true, mailEnabled: true, account: { id: "layout", email, serviceReminders: false }, entitlement: { plan: "paid", account: true, trial: false, expiresAt: Date.now() + 86400000, offlineUntil: Date.now() + 3600000 } } }));
    await page.goto(`${en ? "/en" : ""}/weekly-review`);
    await expect(page.locator(".header-price")).toHaveText(en ? "About Pro" : "Pro 안내");
    await page.locator(".my-account-menu__trigger").click();
    const panel = page.locator(".account-page");
    await expect(panel.getByText(email, { exact: true })).toBeVisible();
    const checkbox = panel.getByRole("checkbox", { name: en ? /Email reminders/ : /이메일 알림 받기/ });
    await expect(checkbox).toBeVisible();
    const inputBox = await checkbox.boundingBox();
    const copyBox = await panel.locator(".account-reminder__copy").boundingBox();
    expect(copyBox.x).toBeGreaterThan(inputBox.x + inputBox.width);
    expect(Math.abs(copyBox.y - inputBox.y)).toBeLessThan(5);
    expect(await panel.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  });
  test(`account entry and unified project review (${locale})`, async ({ page }) => {
    const en = locale === "en";
    const prefix = en ? "/en" : "";
    await page.route("**/api/account/session", route => route.fulfill({ json: { enabled: true, mailEnabled: false, account: null, entitlement: null } }));
    await page.goto(`${prefix}/weekly-review`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(en ? "New project" : "새 프로젝트");
    await expect(page.locator(".csv-uploader")).toHaveCount(0);
    await expect(page.getByRole("button", { name: en ? "Decision review" : "결정 검토", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".wr-screen .journey-progress a")).toHaveCount(0);
    await expect(page.locator(".wr-screen__eyebrow")).toHaveCount(0);
    const trigger = page.locator(".my-account-menu__trigger");
    await expect(trigger).toHaveText(en ? "My account" : "마이페이지");
    const box = await trigger.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize().width);
    await trigger.click();
    const panel = page.locator(".account-page");
    await expect(panel.getByRole("button", { name: en ? "Continue with Google" : "Google로 계속", exact: true })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${prefix}/account$`));
    await expect(panel.locator('input[type="password"]')).toHaveCount(0);
    await expect(panel.getByRole("heading", { name: en ? /My column mappings/ : /내 컬럼 매핑/ })).toBeVisible();
    await panel.getByRole("link", { name: en ? "Open projects" : "프로젝트 열기", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${prefix}/weekly-review`));
    await page.goto(`${prefix}/projects`);
    await expect(page).toHaveURL(new RegExp(`${prefix}/weekly-review#project-management$`));
    await expect(page.getByRole("heading", { name: en ? "My projects" : "내 프로젝트", exact: true })).toBeVisible();
  });
}
