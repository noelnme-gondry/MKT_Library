import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const locale of ['ko', 'en']) {
  test(`allocation workspace keeps scope, dates, evidence and methods coherent (${locale})`, async ({ page }) => {
    const en = locale === 'en';
    await page.goto(`${en ? '/en' : ''}/tools/budget-allocation?example=1`);
    await expect(page.locator('#s-controls')).toBeVisible();
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('.analysis-setup__context')).toHaveCount(0);
    await expect(page.locator('#s-controls details')).toHaveCount(0);
    await expect(page.locator('.tool-instrument-header select')).toHaveCount(0);
    expect(await page.locator('.tool-instrument-header').evaluate(el => getComputedStyle(el).position)).toBe('static');
    const header = await page.locator('.tool-instrument-header').evaluate(el => {
      const outer = el.getBoundingClientRect();
      const heading = el.querySelector('h1').getBoundingClientRect();
      const date = el.querySelector('.result-period-picker').getBoundingClientRect();
      return { padding: heading.x - outer.x, alignment: Math.abs(heading.x - date.x) };
    });
    expect(header.padding).toBeGreaterThanOrEqual(16);
    expect(header.alignment).toBeLessThanOrEqual(1);
    const order = await page.locator('.allocation-workspace [id]').evaluateAll(els => els.map(el => el.id));
    expect(order.indexOf('s-table')).toBeLessThan(order.indexOf('s-scatter'));
    expect(order.indexOf('s-response')).toBeLessThan(order.indexOf('s-scatter'));
    const period = page.getByRole('button', { name: en ? /^Analysis period/ : /^분석 기간/ });
    const original = await period.textContent();
    await period.click();
    const dateDialog = page.getByRole('dialog', { name: en ? 'Analysis period' : '분석 기간', exact: true });
    await dateDialog.getByLabel(en ? 'Start date' : '시작일').fill('2024-01-15');
    await dateDialog.getByRole('button', { name: en ? 'Cancel' : '취소', exact: true }).click();
    await expect(period).toHaveText(original);
    await period.click();
    await dateDialog.getByLabel(en ? 'Start date' : '시작일').fill('2024-01-15');
    await dateDialog.getByRole('button', { name: en ? 'Apply' : '적용', exact: true }).click();
    await expect(period).toContainText('2024-01-15');
    const scope = page.getByRole('button', { name: en ? /^Allocation scope:/ : /^배분 대상:/ });
    expect(await scope.evaluate(el => {
      const header = el.closest('.tool-instrument-header');
      return el.getBoundingClientRect().right - (header.getBoundingClientRect().right - parseFloat(getComputedStyle(header).paddingRight) - 1);
    })).toBeLessThanOrEqual(1);
    await scope.click();
    const dialog = page.getByRole('dialog', { name: en ? 'Allocation scope' : '배분 대상', exact: true });
    await dialog.getByLabel(en ? 'Country' : '국가', { exact: true }).selectOption('KR');
    await dialog.getByLabel(en ? 'Channel' : '채널', { exact: true }).selectOption('Meta AAP');
    const bounds = await dialog.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(page.viewportSize().width + 1);
    const audit = await new AxeBuilder({ page }).include('.allocation-scope-panel').withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(audit.violations).toEqual([]);
    await dialog.press('Escape');
    await expect(scope).toBeFocused();
    await expect(scope).not.toContainText('Meta AAP');
    await scope.click();
    await dialog.getByLabel(en ? 'Country' : '국가', { exact: true }).selectOption('KR');
    await dialog.getByLabel(en ? 'Channel' : '채널', { exact: true }).selectOption('Meta AAP');
    await dialog.getByRole('button', { name: en ? 'Apply and review curves' : '적용 후 곡선 검토' }).click();
    await expect(page.locator('#s-verify')).toBeVisible();
    await expect(page.locator('h1')).toHaveCount(1);
    page.on('dialog', d => d.accept());
    await page.getByRole('button', { name: en ? /Finish verification/ : /검증 완료 및 예산 배분/ }).first().click();
    await expect(page.locator('#s-controls')).toBeVisible();
    // Narrowing to one channel preserves the entered budget. Bring it within
    // this scope's observed ceiling before expecting an executable plan.
    const ceiling = Number(await page.locator('#prism-total-budget').getAttribute('max'));
    await page.locator('#prism-total-budget-exact').fill(String(Math.floor(ceiling * 0.8)));
    await page.locator('#prism-total-budget-exact').blur();
    await expect(page.locator('#s-table')).toBeVisible();
    await expect(scope).toContainText('KR');
    await expect(scope).toContainText('Meta AAP');
    await expect(period).toContainText('2024-01-15');
    const method = page.getByRole('button', { name: en ? 'View calculation method' : '계산 방법 보기' });
    await method.click();
    const methodDialog = page.getByRole('dialog', { name: en ? 'Calculation details' : '계산 기준', exact: true });
    await expect(methodDialog.locator('pre')).toBeVisible();
    await methodDialog.press('Escape');
    await expect(method).toBeFocused();
    await expect(page.locator('.tool-next-step-panel')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  });
}

test('allocation content surfaces and alignment in light mode', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/tools/budget-allocation?example=1');
  await expect(page.locator('#s-controls')).toBeVisible();
  const surfaces = await page.locator('#s-controls, #s-table, #s-scenario, #s-response, #s-scatter, .allocation-data').evaluateAll(els => els.map(el => ({ bg: getComputedStyle(el).backgroundColor, padding: parseFloat(getComputedStyle(el).paddingLeft) })));
  expect(surfaces).toHaveLength(6);
  for (const surface of surfaces) {
    expect(surface.bg).toBe('rgb(255, 255, 255)');
    expect(surface.padding).toBeGreaterThanOrEqual(16);
  }
});
