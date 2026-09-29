import { expect, test } from "@playwright/test";

// 폰(≤480px) 헤더는 한 줄이다(2026-09-30). 예전엔 두 줄(104px)에 글자 없는 아이콘 넷이 늘어서
// 화면의 15%를 먹었다. 한 줄로 줄여도 메뉴(사이드바)와 가격 링크는 바로 보여야 하고(그게 두 줄의
// 원래 이유였다), 숨긴 "내 프로젝트"는 ••• 메뉴에서 열린다. 넓은 화면에서는 메뉴에 같은 항목이 두 번
// 보이지 않는다.
const PAGES = [["ko", "/", "Pro 안내"], ["ko", "/tools/campaign-saturation", "Pro 안내"], ["en", "/en/tools/campaign-saturation", "About Pro"]];

for (const width of [320, 390]) {
  for (const [locale, path, priceText] of PAGES) {
    test(`phone header is one row and keeps menu + price (${width}px ${locale} ${path})`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(path);
      const header = page.locator("header[role=banner]");
      const box = await header.boundingBox();
      expect(box.height).toBeLessThanOrEqual(64);
      const toggle = page.locator(".header-sidebar-toggle");
      const price = page.locator(".header-price");
      await expect(toggle).toBeVisible();
      await expect(price).toHaveText(priceText);
      await expect(price).toBeVisible();
      // 한 줄: 메뉴 버튼과 가격 링크의 세로 중심이 같다.
      const [t, p] = [await toggle.boundingBox(), await price.boundingBox()];
      expect(Math.abs((t.y + t.height / 2) - (p.y + p.height / 2))).toBeLessThanOrEqual(2);
      await expect(page.locator(".topbar .header-decision-inbox")).toBeHidden();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await page.locator(".header-utility-menu__trigger").click();
      await expect(page.locator(".utility-popover-panel .header-utility-review")).toBeVisible();
    });
  }
}

test("wide screens keep the header icon and do not repeat it in the menu", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/tools/campaign-saturation");
  await expect(page.locator(".topbar .header-decision-inbox")).toBeVisible();
  await page.locator(".header-utility-menu__trigger").click();
  await expect(page.locator(".utility-popover-panel")).toBeVisible();
  await expect(page.locator(".utility-popover-panel .header-utility-review")).toBeHidden();
});
