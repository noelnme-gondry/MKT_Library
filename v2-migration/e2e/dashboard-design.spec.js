import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const locale of ['ko', 'en']) {
  test(`dashboard dates, grouping and keyboard dialogs (${locale})`, async ({ page }) => {
    const en = locale === 'en';
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(`${en ? '/en' : ''}/dashboard?example=1`);
    await expect(page.locator('#s-kpi')).toBeVisible();
    const header = page.locator('.dashboard-workspace__header');
    expect(await header.evaluate(el => getComputedStyle(el).position)).toBe('static');
    expect(await header.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)');
    await expect(header.locator('details')).toHaveCount(0);
    expect(await page.locator('#s-custom-charts').evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)');
    expect(await page.locator('.dashboard-next-actions').evaluate(el => el.compareDocumentPosition(document.querySelector('#s-charts')) & Node.DOCUMENT_POSITION_PRECEDING)).toBeTruthy();
    const period = page.getByRole('button', { name: en ? /^Comparison period/ : /^비교 기간/ });
    const original = await period.textContent();
    const initialStats = await page.locator('.result-action-card__stats').textContent();
    await period.click();
    const dialog = page.getByRole('dialog', { name: en ? 'Comparison period' : '비교 기간', exact: true });
    await dialog.getByLabel(en ? 'Start date' : '시작일').fill('2024-03-01');
    await dialog.getByRole('button', { name: en ? 'Cancel' : '취소', exact: true }).click();
    await expect(period).toHaveText(original);
    await period.click();
    await dialog.getByLabel(en ? 'Start date' : '시작일').fill('2024-03-01');
    await dialog.getByLabel(en ? 'End date' : '종료일').fill('2024-03-07');
    await dialog.getByRole('button', { name: en ? 'Apply' : '적용', exact: true }).click();
    await expect(period).toContainText('2024-03-01');
    await expect(page.locator('.result-action-card__stats')).not.toHaveText(initialStats);
    const installs = await page.locator('.result-action-card__stats > div').nth(1).locator('strong').textContent();
    await page.locator('#dashboard-tab-scorecard').click();
    await expect(page.locator('#s-score')).toContainText(en ? 'Selected-period KPIs' : '선택 기간 KPI 비교');
    // Both views must use the same current period, independent of the comparison.
    const card = page.locator('#s-score .ab-stat-button').nth(1);
    expect((await card.locator('.ab-stat-value').textContent()).replace(/\D/g, '')).toBe(installs.replace(/\D/g, ''));
    await page.locator('#dashboard-tab-viz').click();
    const history = page.getByRole('button', { name: en ? 'View decision history' : '판단 기록 보기' });
    await history.click();
    const historyDialog = page.getByRole('dialog', { name: en ? 'Decision history' : '판단 기록', exact: true });
    await expect(historyDialog).toBeVisible();
    await historyDialog.press('Escape');
    await expect(history).toBeFocused();
    const audit = await new AxeBuilder({ page }).include('.dashboard-workspace__header').withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(audit.violations).toEqual([]);
    const command = page.locator('.dashboard-workspace__header .recipe-command');
    await command.getByRole('combobox').fill('Meta');
    await page.getByRole('option', { name: en ? 'Analyze Meta AAP only' : 'Meta AAP만 분석', exact: true }).click();
    await expect(command.getByRole('button', { name: en ? 'Remove Channel: Meta AAP' : '채널: Meta AAP 빼기' })).toBeVisible();
    await expect(page.locator('.result-action-card__stats')).not.toContainText(installs);
    await command.getByRole('button', { name: en ? 'Remove Channel: Meta AAP' : '채널: Meta AAP 빼기' }).click();
    await expect(page.locator('.result-action-card__stats')).toContainText(installs);
    const appliedPeriod = await period.textContent();
    const appliedStats = await page.locator('.result-action-card__stats').textContent();
    await period.click();
    await dialog.getByLabel(en ? 'Start date' : '시작일').fill('2023-12-01');
    await dialog.getByLabel(en ? 'End date' : '종료일').fill('2023-12-07');
    await dialog.getByRole('button', { name: en ? 'Apply' : '적용', exact: true }).click();
    // Out-of-file dates are drafts, not an empty analysis to apply. Preserve
    // the current result and period until the user chooses a valid range.
    const dataStart = await dialog.getByLabel(en ? 'Start date' : '시작일').getAttribute('min');
    expect(dataStart).toBeTruthy();
    await expect(dialog.getByRole('alert')).toContainText(dataStart);
    await expect(period).toHaveText(appliedPeriod);
    await expect(page.locator('.result-action-card__stats')).toHaveText(appliedStats);
    await dialog.press('Escape');
    await page.locator('.dashboard-period-presets').getByRole('button').first().click();
    await expect(page.locator('.result-action-card')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  });

  test(`dashboard keeps a genuine in-file empty comparison explicit (${locale})`, async ({ page }) => {
    const en = locale === 'en';
    await page.goto(`${en ? '/en' : ''}/dashboard`);
    const lines = ['Date,Channel,Cost,Installs'];
    for (const start of [1, 20]) {
      for (let n = 0; n < 7; n++) lines.push(`2026-01-${String(start + n).padStart(2, '0')},Meta,200,100`);
    }
    const uploader = page.locator('.csv-uploader[data-hydrated="true"]').first();
    await uploader.locator('input[type="file"][accept*="csv"]').first().setInputFiles({ name: 'gap-periods.csv', mimeType: 'text/csv', buffer: Buffer.from(lines.join('\r\n')) });
    await uploader.getByRole('button', { name: en ? 'Analyze data' : '데이터 분석하기', exact: true }).click();
    await expect(page.locator('.result-action-card')).toBeVisible();
    await page.getByRole('button', { name: en ? /^Comparison period/ : /^비교 기간/ }).click();
    const dialog = page.getByRole('dialog', { name: en ? 'Comparison period' : '비교 기간', exact: true });
    await dialog.getByLabel(en ? 'Start date' : '시작일').fill('2026-01-08');
    await dialog.getByLabel(en ? 'End date' : '종료일').fill('2026-01-14');
    await dialog.getByRole('button', { name: en ? 'Apply' : '적용', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('.dashboard-content')).toContainText(en ? 'Not enough data to compare' : '비교할 데이터가 부족합니다');
    await expect(page.locator('.result-action-card')).toHaveCount(0);
    await page.locator('.dashboard-period-presets').getByRole('button').first().click();
    await expect(page.locator('.result-action-card')).toBeVisible();
  });

  test(`dashboard recipe restores blocks and exports actual dates (${locale})`, async ({ page }) => {
    const en = locale === 'en';
    const entitlement = { plan: 'paid', account: true, expiresAt: Date.now() + 86400000, offlineUntil: Date.now() + 3600000 };
    await page.route('**/api/account/session', route => route.fulfill({ json: { enabled: true, account: { id: 'recipe-test', email: 'recipe@example.com' }, entitlement } }));
    await page.route('**/api/payments/access', route => route.fulfill({ json: { entitlement } }));
    const saved = [];
    await page.route('**/api/account/recipes', async route => {
      if (route.request().method() === 'POST') saved.push(route.request().postDataJSON().recipe);
      await route.fulfill({ json: { recipes: saved, canApply: true } });
    });
    await page.goto(`${en ? '/en' : ''}/dashboard?example=1`);
    await expect(page.locator('#s-kpi')).toBeVisible();
    const command = page.locator('.dashboard-workspace__header .recipe-command');
    const input = command.getByRole('combobox');
    const initial = await page.locator('.result-action-card__stats').textContent();
    await input.fill(en ? 'Hide Supporting charts' : '보조 차트 숨기기');
    await page.getByRole('option', { name: en ? /Hide Supporting charts/ : /보조 차트 숨기기/ }).click();
    await expect(page.locator('#s-custom-charts')).toBeHidden();
    await expect(page.locator('#s-kpi')).toBeVisible();
    await expect(page.locator('.result-action-card__stats')).toHaveText(initial);
    await command.getByRole('button', { name: en ? 'Save this setup' : '이 설정 저장' }).click();
    await command.locator('form input').fill('Weekly dashboard');
    await command.getByRole('button', { name: en ? 'Save' : '저장', exact: true }).click();
    await expect.poll(() => saved.length).toBe(1);
    expect(saved[0].toolId).toBe('5-2');
    expect(saved[0].steps.some(s => s.id === 'dashboard.dashWindowDays')).toBe(true);
    expect(saved[0].steps.some(s => Object.hasOwn(s.params, 'values'))).toBe(false);
    await command.getByRole('button', { name: en ? 'Remove Hide Supporting charts' : '보조 차트 숨기기 빼기' }).click();
    await expect(page.locator('#s-custom-charts')).toBeVisible();
    await input.fill('Weekly dashboard');
    await page.getByRole('option', { name: /Weekly dashboard/ }).click();
    await expect(page.locator('#s-custom-charts')).toBeHidden();
    await input.fill(en ? 'File name: tool_period' : '파일 이름: 도구_기간');
    await page.getByRole('option', { name: en ? /File name: tool_period/ : /파일 이름: 도구_기간/ }).click();
    const pending = page.waitForEvent('download');
    await page.locator('#s-charts').getByRole('button', { name: en ? 'Download PNG' : 'PNG 받기' }).click();
    const download = await pending;
    expect(await download.failure()).toBeNull();
    expect(download.suggestedFilename()).toContain('20240101-20240330');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  });
}
