import { expect, test } from "@playwright/test";

// OS가 라이트여도 새 방문은 다크다. 저장한 선택은 첫 페인트와 복원 뒤에 같아야 한다.
test.use({ colorScheme: "light" });

for (const locale of ["ko", "en"]) {
  for (const preference of [null, "light", "dark", "invalid"]) {
    test(`theme preference: ${preference ?? "first visit"} (${locale})`, async ({ page }) => {
      const en = locale === "en", initialLight = preference === "light", errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.addInitScript(saved => {
        if (saved === null) localStorage.removeItem("mkt-library-theme");
        else localStorage.setItem("mkt-library-theme", saved);
        document.addEventListener("DOMContentLoaded", () => {
          window.__themeAtDomReady = document.body.classList.contains("light-mode");
        }, { once: true });
      }, preference);
      await page.goto(en ? "/en" : "/");
      expect(await page.evaluate(() => window.__themeAtDomReady)).toBe(initialLight);
      await page.getByRole("button", { name: en ? "More settings" : "기타 설정", exact: true }).click();
      expect(await page.locator("body").evaluate(node => node.classList.contains("light-mode"))).toBe(initialLight);
      await expect(page.locator('meta[name="theme-color"]')).toHaveCount(1);
      expect(await page.locator('meta[name="theme-color"]').getAttribute("content"))
        .toBe(await page.locator("body").evaluate(node => getComputedStyle(node).backgroundColor));
      await page.getByRole("button", { name: en ? "Toggle theme" : "테마 전환", exact: true }).click();
      await expect.poll(() => page.evaluate(() => document.body.classList.contains("light-mode"))).toBe(!initialLight);
      await expect.poll(() => page.evaluate(() => localStorage.getItem("mkt-library-theme"))).toBe(initialLight ? "dark" : "light");
      await page.keyboard.press("Escape");
      // 테스트 시드가 새로고침 때 선택을 덮지 않도록 새 페이지에서 같은 저장소로 복원한다.
      const restored = await page.context().newPage();
      await restored.goto(en ? "/" : "/en");
      await restored.getByRole("button", { name: en ? "기타 설정" : "More settings", exact: true }).click();
      expect(await restored.locator("body").evaluate(node => node.classList.contains("light-mode"))).toBe(!initialLight);
      expect(await restored.locator('meta[name="theme-color"]').getAttribute("content"))
        .toBe(await restored.locator("body").evaluate(node => getComputedStyle(node).backgroundColor));
      await restored.close();
      expect(errors).toEqual([]);
    });
  }
}
