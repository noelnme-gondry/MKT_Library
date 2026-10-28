import { expect } from "@playwright/test";

/**
 * 대시보드 보기 하나를 연다. 넓은 화면은 탭을, 폰(탭이 숨는 폭)은 "보기 고르기" 창을 쓴다 —
 * 사용자가 그 폭에서 실제로 누르는 길을 밟는다.
 */
export async function chooseDashboardView(page, view) {
  const id = String(view).replace(/^dashboard-tab-/, "");
  await expect(page.locator("#dashboard-tabpanel")).toBeAttached();
  const picker = page.locator(".dashboard-view-picker__button");
  if (await picker.isVisible()) {
    await picker.click();
    const sheet = page.locator(".dashboard-view-sheet");
    await expect(sheet).toBeVisible();
    await sheet.locator(`[data-view-id="${id}"]`).click();
    await expect(sheet).toHaveCount(0);
  } else {
    await page.locator(`#dashboard-tab-${id}`).click();
  }
  await expect(page.locator("#dashboard-tabpanel")).toHaveAttribute("aria-labelledby", `dashboard-tab-${id}`);
}
