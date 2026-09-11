import { test, expect } from "@playwright/test";

for (const locale of ["ko", "en"]) {
  test(`account entry and unified project review (${locale})`, async ({ page }) => {
    const en = locale === "en";
    const prefix = en ? "/en" : "";
    await page.route("**/api/account/session", route => route.fulfill({ json: { enabled: true, mailEnabled: false, account: null, entitlement: null } }));
    await page.goto(`${prefix}/weekly-review`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(en ? "Project review" : "프로젝트 리뷰");
    await expect(page.locator(".wr-screen__eyebrow")).toHaveCount(0);
    const trigger = page.locator(".my-account-menu > summary");
    await expect(trigger).toHaveText(en ? "My account" : "마이페이지");
    const box = await trigger.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize().width);
    await trigger.click();
    const panel = page.locator(".my-account-menu__panel");
    await expect(panel.getByRole("button", { name: en ? "Continue with Google" : "Google로 계속", exact: true })).toBeVisible();
    for (const light of [false, true]) {
      await page.evaluate(value => document.body.classList.toggle("light-mode", value), light);
      const links = panel.locator("nav a");
      expect(await links.count()).toBe(4);
      for (const link of await links.all()) {
        await expect(link).toHaveCSS("text-decoration-line", "none");
        expect((await link.boundingBox()).height).toBeGreaterThanOrEqual(44);
        await expect(link.locator("svg")).toBeVisible();
      }
      const login = panel.locator(".account-profile-login");
      expect((await login.boundingBox()).height).toBeGreaterThanOrEqual(44);
      await expect(login).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    }
    await panel.getByRole("button", { name: en ? "Close my account" : "마이페이지 닫기", exact: true }).click();
    await expect(trigger).toBeFocused();
    await expect(panel).not.toBeVisible();
    await trigger.click();
    await panel.getByRole("link", { name: en ? "Manage my projects" : "내 프로젝트 관리", exact: true }).click();
    await expect(page.getByRole("heading", { name: en ? "Manage my projects" : "내 프로젝트 관리", exact: true })).toBeVisible();
    await page.getByRole("button", { name: en ? "Weekly review" : "이번 주 리뷰", exact: true }).click();
    await expect(page.locator("#wr-upload")).toBeVisible();
    await trigger.click();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await expect(panel).not.toBeVisible();
    await page.goto(`${prefix}/projects`);
    await expect(page).toHaveURL(new RegExp(`${prefix}/weekly-review#project-management$`));
    await expect(page.getByRole("heading", { name: en ? "Manage my projects" : "내 프로젝트 관리", exact: true })).toBeVisible();
  });
}
