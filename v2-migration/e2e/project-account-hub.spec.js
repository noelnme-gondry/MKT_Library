import { test, expect } from "@playwright/test";

for (const locale of ["ko", "en"]) {
  test(`signed-in account copy stays aligned (${locale})${locale === "en" ? " @light-en" : ""}`, async ({ page }) => {
    const en = locale === "en";
    const email = "long.account.address.for.layout@example.com";
    await page.route("**/api/account/session", route => route.fulfill({ json: { enabled: true, mailEnabled: true, account: { id: "layout", email, serviceReminders: false }, entitlement: { plan: "paid", account: true, trial: false, expiresAt: Date.now() + 86400000, offlineUntil: Date.now() + 3600000 } } }));
    await page.goto(`${en ? "/en" : ""}/weekly-review`);
    await expect(page.locator(".header-price")).toHaveText(en ? "About Pro" : "Pro 안내");
    await page.locator(".my-account-menu > summary").click();
    const panel = page.locator(".my-account-menu__panel");
    await expect(panel.locator(".account-identity__email")).toHaveText(email);
    const checkbox = panel.getByRole("checkbox", { name: en ? /Email reminders/ : /이메일 알림 받기/ });
    await expect(checkbox).toBeVisible();
    const emailBox = await panel.locator(".account-identity__email").boundingBox();
    const planBox = await panel.locator(".account-identity__plan").boundingBox();
    expect(planBox.y).toBeGreaterThanOrEqual(emailBox.y + emailBox.height);
    const inputBox = await checkbox.boundingBox();
    const copyBox = await panel.locator(".account-reminder__copy").boundingBox();
    expect(copyBox.x).toBeGreaterThan(inputBox.x + inputBox.width);
    expect(Math.abs(copyBox.y - inputBox.y)).toBeLessThan(5);
    await expect(panel.locator(".account-identity__plan time")).toHaveCSS("white-space", "nowrap");
    expect(await panel.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  });
  test(`account entry and unified project review (${locale})`, async ({ page }) => {
    const en = locale === "en";
    const prefix = en ? "/en" : "";
    await page.route("**/api/account/session", route => route.fulfill({ json: { enabled: true, mailEnabled: false, account: null, entitlement: null } }));
    await page.goto(`${prefix}/weekly-review`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(en ? "New review" : "새 리뷰");
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
      expect(await links.count()).toBe(3);
      for (const link of await links.all()) {
        await expect(link).toHaveCSS("text-decoration-line", "none");
        expect((await link.boundingBox()).height).toBeGreaterThanOrEqual(44);
        await expect(link.locator("svg")).toBeVisible();
        await link.hover();
        const contrast = await link.evaluate(node => {
          const luminance = color => {
            const values = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => value / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
            return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
          };
          const style = getComputedStyle(node);
          const text = luminance(getComputedStyle(node.querySelector("span")).color);
          const background = luminance(style.backgroundColor);
          return (Math.max(text, background) + 0.05) / (Math.min(text, background) + 0.05);
        });
        expect(contrast).toBeGreaterThanOrEqual(4.5);
      }
      const login = panel.locator(".account-profile-login");
      expect((await login.boundingBox()).height).toBeGreaterThanOrEqual(44);
      await expect(login).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    }
    await panel.getByRole("button", { name: en ? "Close my account" : "마이페이지 닫기", exact: true }).click();
    await expect(trigger).toBeFocused();
    await expect(panel).not.toBeVisible();
    await trigger.click();
    await panel.getByRole("link", { name: en ? "My projects" : "내 프로젝트", exact: true }).click();
    await expect(page.getByRole("heading", { name: en ? "My projects" : "내 프로젝트", exact: true })).toBeVisible();
    await page.getByRole("button", { name: en ? "Start your first review" : "첫 리뷰 시작하기", exact: true }).click();
    await expect(page.locator("#wr-upload")).toBeVisible();
    await trigger.click();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await expect(panel).not.toBeVisible();
    await page.goto(`${prefix}/projects`);
    await expect(page).toHaveURL(new RegExp(`${prefix}/weekly-review#project-management$`));
    await expect(page.getByRole("heading", { name: en ? "My projects" : "내 프로젝트", exact: true })).toBeVisible();
  });
}
