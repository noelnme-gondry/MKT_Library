import { test, expect } from '@playwright/test';
import { ROUTES } from '../src/lib/routeMap';
for (const locale of ['ko', 'en']) for (const [toolId, selector, panel] of [
  ['5-4', '[id^="ab-primary-tab-"]', '#ab-primary-panel'],
  ['5-23', '[id^="incrementality-tab-"]', '#incrementality-method-panel'],
  ['9-6', '[id^="creative-problem-tab-"]', '#creative-problem-panel'],
]) {
  test(`follow-up tab states ${toolId} (${locale})`, async ({ page }) => {
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const path = ROUTES.find(route => route.id === toolId).slug;
    await page.goto(`${locale === 'en' ? '/en' : ''}${path}?example=1`);
    const tabs = page.locator(selector); await expect(tabs.first()).toBeVisible();
    for (let index = 0; index < await tabs.count(); index++) {
      await tabs.nth(index).click();
      await expect(tabs.nth(index)).toHaveAttribute('aria-selected', 'true');
      await expect(page.locator(panel)).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    }
    expect(errors).toEqual([]);
  });
}
