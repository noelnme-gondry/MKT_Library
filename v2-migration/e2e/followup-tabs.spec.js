import { test, expect } from '@playwright/test';
import { ROUTES } from '../src/lib/routeMap';
import { openResultDetails } from './support/resultDetails';
for (const locale of ['ko', 'en']) for (const [toolId, selector, panel] of [
  ['5-4', '[id^="ab-primary-tab-"]', '#ab-primary-panel'],
  ['5-23', '[id^="incrementality-tab-"]', '#incrementality-method-panel'],
  ['9-6', '[id^="creative-problem-tab-"]', '#creative-problem-panel'],
]) {
  test(`follow-up tab states ${toolId} (${locale})`, async ({ page }) => {
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const path = ROUTES.find(route => route.id === toolId).slug;
    await page.goto(`${locale === 'en' ? '/en' : ''}${path}?example=1`);
    // 예시 준비가 끝난 뒤 사용자의 탭 전환을 검사한다. 준비 전에 클릭하면
    // 예시의 기본 판독 탭 전환이 사용자의 선택보다 나중에 실행될 수 있다.
    await expect(page).toHaveURL(new RegExp(`${locale === 'en' ? '/en' : ''}${path}$`));
    if (toolId === '5-4') await expect(page.locator('#ab-primary-tab-readout')).toHaveAttribute('aria-selected', 'true');
    // 9-6 운영 패널 탭은 결과 카드의 "자세히 보기"(기본 닫힘) 안에 있다(임원 보고 형식 §5.5).
    if (toolId === '9-6') { await expect(page.locator('.result-action-card').first()).toBeVisible(); await openResultDetails(page); }
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
