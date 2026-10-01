import { test, expect } from '@playwright/test';
import { FOLLOWUP_INPUTS, decodeFollowupStep } from '../src/lib/recipe/followupInputs';
import { ROUTES } from '../src/lib/routeMap';
for (const locale of ['ko', 'en']) for (const toolId of Object.keys(FOLLOWUP_INPUTS)) {
  test(`analysis recipe saves effective controls without user data: ${toolId} (${locale})`, async ({ page }) => {
    test.setTimeout(120000);
    const en = locale === 'en', t = (ko, english) => en ? english : ko;
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const entitlement = { plan: 'paid', account: true, payment: true, expiresAt: Date.now() + 86400000, offlineUntil: Date.now() + 3600000 };
    let recipes = [], posted = null;
    await page.route('**/api/account/session', route => route.fulfill({ json: { enabled: true, account: { id: 'recipe-test', email: 'test@example.com' }, entitlement } }));
    await page.route('**/api/payments/access', route => route.fulfill({ json: { entitlement } }));
    await page.route('**/api/account/recipes', route => {
      if (route.request().method() === 'POST') { posted = route.request().postDataJSON().recipe; recipes = [posted]; }
      return route.fulfill({ json: { recipes, canApply: true } });
    });
    await page.goto(`${en ? '/en' : ''}${ROUTES.find(route => route.id === toolId).slug}?example=1`);
    const root = page.locator('.tool-autonomy');
    await expect(root.locator('.tool-recipe-controls')).toBeVisible({ timeout: 45000 });
    // Wait for child controls, not just the wrapper's account controls.
    await expect(page.locator('.tool-next-step-panel')).toBeVisible({ timeout: 45000 });
    if (toolId === '5-4') await root.locator('#ab-primary-tab-design').click();
    const publicPaths = Object.entries(FOLLOWUP_INPUTS[toolId]).filter(([, option]) => !option.private).map(([path]) => path);
    await root.getByRole('button', { name: t('이 설정 저장', 'Save this setup'), exact: true }).click();
    await root.getByLabel(t('설정 이름', 'Setup name'), { exact: true }).fill('Daily setup');
    await root.getByRole('button', { name: t('저장', 'Save'), exact: true }).click();
    await expect.poll(() => posted, { timeout: 10000 }).not.toBeNull();
    expect(posted.toolId).toBe(toolId);
    const inputSteps = posted.steps.filter(step => step.id.startsWith('input.'));
    // Suppression has no DiD control mounted. That input belongs to pre/post mode.
    for (const path of publicPaths.filter(path => !(toolId === '5-23' && path === 'useDiD'))) expect(inputSteps.some(step => step.id === `input.${path}`), path).toBe(true);
    for (const step of inputSteps) expect(() => decodeFollowupStep(toolId, step)).not.toThrow();
    expect(posted.steps.every(step => !Object.hasOwn(step.params, 'values'))).toBe(true);
    expect(JSON.stringify(posted)).not.toMatch(/analysisSignature|confirmedDesign|demo_.*csv|privateChannel/);
    const command = root.getByRole('combobox', { name: t('분석·보기 설정', 'Analysis and view settings') });
    if (toolId === '5-28') {
      const unit = root.locator('select').filter({ has: page.locator('option[value="month"]') });
      await unit.selectOption('week');
      await expect(unit).toHaveValue('week');
    }
    if (toolId === '5-4') await root.locator('select').filter({ has: page.locator('option[value="0.01"]') }).first().selectOption('0.01');
    if (toolId === '5-18-forecast') await root.locator('input[type="number"][max="52"]').fill('26');
    if (toolId === '5-23') await root.locator('#incrementality-tab-off').click();
    if (toolId === '5-20') await root.locator('input.map-select[type="number"]').fill('90');
    await command.fill('Daily setup');
    await expect(root.getByRole('option', { name: /Daily setup/ })).toBeVisible();
    await command.press('Enter');
    await expect(root.locator('.tool-recipe-controls [role="alert"]')).toHaveCount(0);
    if (toolId === '5-28') await expect(root.locator('select').filter({ has: page.locator('option[value="month"]') })).toHaveValue('month');
    if (toolId === '5-4') await expect(root.locator('select').filter({ has: page.locator('option[value="0.01"]') }).first()).toHaveValue('0.05');
    if (toolId === '5-18-forecast') {
      await expect(root.locator('input[type="number"][max="52"]')).toHaveValue('13');
      await expect(root.getByRole('button', { name: t('예측 다시 계산', 'Recalculate forecast'), exact: true })).toBeDisabled();
    }
    if (toolId === '5-23') await expect(root.locator('#incrementality-tab-suppression')).toHaveAttribute('aria-selected', 'true');
    if (toolId === '5-20') await expect(root.locator('input.map-select[type="number"]')).toHaveValue('30');
    expect(errors).toEqual([]);
  });
}
