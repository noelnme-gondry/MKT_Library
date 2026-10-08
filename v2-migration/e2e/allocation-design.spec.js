import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';

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
    const views = page.getByRole('tablist', { name: en ? 'Allocation views' : '배분 보기' });
    await expect(views.getByRole('tab')).toHaveCount(4);
    await expect(page.locator('.result-action-card__evidence .issue-mark')).toHaveCount(1);
    await expect(page.locator('.result-action-card__evidence .issue-mark')).toHaveAttribute('aria-label', en ? '3 things to check' : '확인할 점 3개');
    await expect(page.locator('.prism-result-grid, .alloc-total-card')).toHaveCount(0);
    const analysis = page.locator('.allocation-result-workspace');
    const review = page.locator('.decision-review-preview');
    await expect(review).toBeVisible();
    expect(await analysis.evaluate(el => Boolean(el.compareDocumentPosition(document.querySelector('.decision-review-preview')) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
    await expect(page.locator('#s-table')).toBeHidden();
    await page.getByRole('radio', { name: en ? 'Full table' : '전체 배분표', exact: true }).click();
    await expect(page.locator('#s-table')).toBeVisible();
    await expect(page.locator('.result-shift')).toBeHidden();
    await page.getByRole('radio', { name: en ? 'Changes' : '변경 요약', exact: true }).click();
    const allocationTab = views.getByRole('tab', { name: en ? 'Allocation' : '배분안', exact: true });
    await allocationTab.focus();
    await allocationTab.press('End');
    const checks = views.getByRole('tab', { name: en ? 'Checks' : '확인', exact: true });
    await expect(checks).toBeFocused();
    await expect(checks).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.alloc-verify-strip')).toBeVisible();
    const panelId = await checks.getAttribute('aria-controls');
    await expect(page.locator(`[id="${panelId}"]`)).toHaveAttribute('aria-labelledby', await checks.getAttribute('id'));
    const tabAudit = await new AxeBuilder({ page }).include('.allocation-result-workspace').withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(tabAudit.violations).toEqual([]);
    await checks.press('Home');
    await expect(allocationTab).toBeFocused();
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
    await page.getByRole('radio', { name: en ? 'Full table' : '전체 배분표', exact: true }).click();
    await expect(page.locator('#s-table')).toBeVisible();
    await expect(scope).toContainText('KR');
    await expect(scope).toContainText('Meta AAP');
    await expect(period).toContainText('2024-01-15');
    await page.getByRole('tab', { name: en ? 'Checks' : '확인', exact: true }).click();
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
  const surfaces = await page.locator('#s-controls, .result-action-card, .allocation-data').evaluateAll(els => els.map(el => ({ bg: getComputedStyle(el).backgroundColor, padding: parseFloat(getComputedStyle(el).paddingLeft) })));
  expect(surfaces).toHaveLength(3);
  for (const surface of surfaces) {
    expect(surface.bg).toBe('rgb(255, 255, 255)');
    expect(surface.padding).toBeGreaterThanOrEqual(16);
  }
});

for (const locale of ['ko', 'en']) {
  test(`budget comparison groups each entity and exports labeled amounts (${locale})`, async ({ page }) => {
    const en = locale === 'en';
    const entitlement = { plan: 'paid', account: true, expiresAt: Date.now() + 86400000, offlineUntil: Date.now() + 3600000 };
    await page.route('**/api/account/session', route => route.fulfill({ json: { enabled: true, account: { id: 'figure-test', email: 'figure@example.com' }, entitlement } }));
    await page.route('**/api/payments/access', route => route.fulfill({ json: { entitlement } }));
    await page.goto(`${en ? '/en' : ''}/tools/budget-allocation?example=1`);
    const figure = page.locator('.result-shift');
    const entities = figure.locator('.result-shift__entity');
    await expect(entities).toHaveCount(8);
    await expect(figure.locator('.result-shift__efficiency')).toHaveCount(8);
    await expect(figure.locator('.result-shift__efficiency').first()).toContainText('CPI');
    await expect(page.locator('.result-action-card > .result-action-card__points')).toHaveCount(0);
    await expect(page.locator('.allocation-distribution li')).toHaveCount(4);
    await page.getByRole('tab', { name: en ? 'Curves' : '곡선', exact: true }).click();
    const grouping = page.getByRole('group', { name: en ? 'Scatterplot grouping' : '산점도 보기 단위' });
    const combined = grouping.getByRole('button', { name: en ? 'Country · channel' : '국가·채널별', exact: true });
    await expect(combined).toHaveAttribute('aria-pressed', 'true');
    const chartTargets = page.locator('#s-scatter button.ab-pill[aria-pressed]');
    await expect(chartTargets).toHaveCount(8);
    await expect(chartTargets.filter({ hasText: 'Android' })).toHaveCount(0);
    const countries = page.getByRole('group', { name: en ? 'Chart countries' : '차트 국가 선택', exact: true });
    const allCountries = countries.getByRole('button', { name: en ? 'All' : '전체', exact: true });
    const us = countries.getByRole('button', { name: 'US', exact: true });
    const kr = countries.getByRole('button', { name: 'KR', exact: true });
    const canvas = page.locator('#chart-alloc-scatter');
    const allPixels = await canvas.evaluate(el => el.toDataURL());
    await us.click();
    await expect(us).toHaveAttribute('aria-pressed', 'false');
    await expect(kr).toHaveAttribute('aria-pressed', 'true');
    await expect(allCountries).toHaveAttribute('aria-pressed', 'mixed');
    await expect(chartTargets.filter({ hasText: /^US/ }).and(page.locator('[aria-pressed="true"]'))).toHaveCount(0);
    await expect.poll(() => canvas.evaluate(el => el.toDataURL())).not.toBe(allPixels);
    await kr.click();
    await expect(allCountries).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('.allocation-chart-empty')).toBeVisible();
    await expect(canvas).not.toBeVisible();
    await allCountries.click();
    await expect(chartTargets.and(page.locator('[aria-pressed="true"]'))).toHaveCount(8);
    await expect(canvas).toBeVisible();
    await chartTargets.filter({ hasText: /^KR/ }).first().click();
    await expect(kr).toHaveAttribute('aria-pressed', 'mixed');
    await kr.click();
    await expect(kr).toHaveAttribute('aria-pressed', 'true');
    await allCountries.click();
    await expect(canvas).not.toBeVisible();
    await allCountries.click();
    await expect(canvas).toBeVisible();
    const allocationBefore = await figure.textContent();
    await grouping.getByRole('button', { name: en ? 'Allocation detail' : '배분 단위별', exact: true }).click();
    await expect(chartTargets).toHaveCount(16);
    await expect(figure).toHaveText(allocationBefore);
    await combined.click();
    await expect(chartTargets).toHaveCount(8);
    await expect(page.locator('.allocation-response-status')).not.toContainText(en ? 'not yet reached' : '아직 과포화');
    await page.getByRole('radio', { name: en ? 'Spend & outcomes' : '지출·성과', exact: true }).click();
    const curveSelect = page.getByLabel(en ? 'Allocation to inspect' : '확인할 배분 대상', { exact: true });
    await expect(curveSelect).toBeVisible();
    const options = await curveSelect.locator('option').evaluateAll(els => els.map(el => el.value));
    await curveSelect.selectOption(options[1]);
    await expect(curveSelect).toHaveValue(options[1]);
    // Lower charts share one country view while the allocation remains untouched.
    const linked = page.getByRole('group', { name: en ? 'Linked chart countries' : '차트 공통 국가', includeHidden: true });
    await expect(linked).toHaveCount(3);
    const allocationSnapshot = await figure.textContent();
    await page.getByRole('tab', { name: en ? 'Budget comparison' : '예산 비교', exact: true }).click();
    const scenarioCanvas = page.locator('#alloc-scenario-chart');
    const scenarioPixels = await scenarioCanvas.evaluate(el => el.toDataURL());
    const shareBefore = await page.locator('.allocation-distribution ul').textContent();
    const fullScenarioTable = await page.locator('#s-scenario tbody').textContent();
    await linked.nth(1).getByRole('button', { name: 'US' }).click();
    for (const controls of await linked.all()) await expect(controls.getByRole('button', { name: 'US', includeHidden: true })).toHaveAttribute('aria-pressed', 'false');
    await expect(curveSelect.locator('option')).toHaveCount(8);
    expect((await curveSelect.locator('option').allTextContents()).every(name => name.startsWith('KR'))).toBe(true);
    await expect(page.locator('.allocation-distribution ul')).not.toHaveText(shareBefore);
    await expect(page.locator('#s-scenario tbody')).not.toHaveText(fullScenarioTable);
    await expect.poll(() => scenarioCanvas.evaluate(el => el.toDataURL())).not.toBe(scenarioPixels);
    await expect(figure).toHaveText(allocationSnapshot);
    await linked.nth(1).getByRole('button', { name: 'KR' }).click();
    for (const section of ['s-bar', 's-scenario', 's-response']) await expect(page.locator(`#${section} .allocation-chart-empty`)).toHaveCount(1);
    await expect(scenarioCanvas).toHaveCount(0);
    await expect(curveSelect).toHaveCount(0);
    await linked.nth(1).getByRole('button', { name: en ? 'All' : '전체' }).click();
    await expect(curveSelect.locator('option')).toHaveCount(16);
    await expect(page.locator('#s-scenario tbody')).toHaveText(fullScenarioTable);
    await expect(figure).toHaveText(allocationSnapshot);
    await page.getByRole('tab', { name: en ? 'Checks' : '확인', exact: true }).click();
    const periodCheck = page.locator('.analysis-design-check--allocation');
    await expect(periodCheck.locator('.allocation-period-inputs')).toContainText('2024-01-01');
    await expect(periodCheck.locator('.allocation-period-inputs')).toContainText('2024-03-30');
    await periodCheck.getByRole('button', { name: en ? 'Compare recommendations' : '기간별 추천 비교' }).click();
    await expect(periodCheck.locator('tbody tr')).toHaveCount(16);
    await expect(periodCheck.locator('.allocation-period-counts')).toContainText(en ? 'Not comparable' : '비교 불가');
    const saveSection = page.locator('.analysis-setup--actions[data-tool-id="5-3"]');
    await expect(saveSection.locator('h2')).toBeVisible();
    expect(await saveSection.evaluate(el => {
      const button = el.querySelector('button').getBoundingClientRect();
      const title = el.querySelector('h2').getBoundingClientRect();
      return Math.abs(button.x - title.x);
    })).toBeLessThanOrEqual(1);
    await page.getByRole('tab', { name: en ? 'Allocation' : '배분안', exact: true }).click();
    for (const entity of await entities.all()) {
      await expect(entity.locator('.result-shift__measure')).toHaveCount(2);
      await expect(entity.locator('.result-shift__delta strong')).toContainText(/[+−]/);
      expect(await entity.evaluate(el => {
        const outer = el.getBoundingClientRect();
        return [...el.querySelectorAll('strong, .result-shift__direction')].every(child => {
          const r = child.getBoundingClientRect();
          return r.x >= outer.x && r.right <= outer.right;
        });
      })).toBe(true);
    }
    const count = await entities.count();
    await figure.getByRole('button', { name: en ? /^Show all/ : /^전체 .* 보기/ }).click();
    expect(await entities.count()).toBeGreaterThan(count);
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#tool-core-figure-budget-allocation-baseline').getByRole('button', { name: en ? 'Download PNG' : 'PNG 받기' }).click();
    const download = await downloadPromise;
    expect(await download.failure()).toBeNull();
    const png = await readFile(await download.path());
    // HTML figures export at 2× their rendered width, including mobile.
    expect(png.readUInt32BE(16)).toBeGreaterThanOrEqual(Math.floor((await figure.boundingBox()).width * 2));
    await download.saveAs(`/tmp/budget-shift-${locale}-${page.viewportSize().width}.png`);
    for (const section of ['s-bar', 's-scatter', 's-scenario', 's-response']) {
      const tab = section === 's-bar' ? (en ? 'Allocation' : '배분안') : section === 's-scenario' ? (en ? 'Budget comparison' : '예산 비교') : (en ? 'Curves' : '곡선');
      await page.getByRole('tab', { name: tab, exact: true }).click();
      if (section !== 's-scenario') {
        const view = section === 's-bar' ? (en ? 'Share' : '비중') : section === 's-scatter' ? (en ? 'Efficiency & observations' : '효율·관측점') : (en ? 'Spend & outcomes' : '지출·성과');
        await page.getByRole('radio', { name: view, exact: true }).click();
      }
      await expect(page.locator(`#${section}`)).toBeVisible();
      const pending = page.waitForEvent('download');
      await page.locator(`#${section}`).getByRole('button', { name: en ? 'Download PNG' : 'PNG 받기' }).click();
      const exported = await pending;
      expect(await exported.failure()).toBeNull();
      await exported.saveAs(`/tmp/budget-${section}-${locale}-${page.viewportSize().width}.png`);
    }
    const firstEfficiency = figure.locator('.result-shift__efficiency').first();
    const before = await firstEfficiency.textContent();
    const budget = page.locator('#prism-total-budget-exact');
    const amount = Number((await budget.inputValue()).replaceAll(',', ''));
    await budget.fill(String(Math.round(amount * 0.8)));
    await budget.blur();
    await expect(firstEfficiency).not.toHaveText(before);
    await page.locator('#s-controls').getByRole('radio', { name: /ROAS/ }).click();
    await expect(firstEfficiency).toContainText('ROAS');
    await expect(firstEfficiency.locator('strong')).toContainText('%');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  });
}

for (const locale of ['ko', 'en']) {
  test(`allocation recipe saves public settings and restores blocks without changing the plan (${locale})`, async ({ page }) => {
    const en = locale === 'en';
    const entitlement = { plan: 'paid', account: true, expiresAt: Date.now() + 86400000, offlineUntil: Date.now() + 3600000 };
    await page.route('**/api/account/session', route => route.fulfill({ json: { enabled: true, account: { id: 'recipe-test', email: 'recipe@example.com' }, entitlement } }));
    await page.route('**/api/payments/access', route => route.fulfill({ json: { entitlement } }));
    const saved = [];
    const posted = [];
    await page.route('**/api/account/recipes', async route => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        posted.push(body.recipe);
        saved.push(body.recipe);
      }
      await route.fulfill({ json: { recipes: saved, canApply: true } });
    });
    await page.goto(`${en ? '/en' : ''}/tools/budget-allocation?example=1`);
    const command = page.locator('.allocation-context-controls .recipe-command');
    const input = command.getByRole('combobox');
    const plan = page.locator('.result-shift');
    await expect(plan).toBeVisible();
    const initial = await plan.textContent();
    await page.getByRole('tab', { name: en ? 'Budget comparison' : '예산 비교', exact: true }).click();
    await input.fill(en ? 'Hide Budget scenarios' : '예산 시나리오 숨기기');
    await page.getByRole('option', { name: en ? /Hide Budget scenarios/ : /예산 시나리오 숨기기/ }).click();
    await expect(page.locator('#s-scenario')).toBeHidden();
    await expect(page.locator('#s-table')).toBeHidden();
    await expect(plan).toHaveText(initial);
    const amount = await page.locator('#prism-total-budget-exact').inputValue();
    await input.fill('');
    await input.press('Backspace');
    await expect(page.locator('#s-scenario')).toBeVisible();
    await input.press('Backspace');
    await expect(page.locator('#prism-total-budget-exact')).toHaveValue(amount);
    await input.fill(en ? 'Hide Budget scenarios' : '예산 시나리오 숨기기');
    await page.getByRole('option', { name: en ? /Hide Budget scenarios/ : /예산 시나리오 숨기기/ }).click();
    await command.getByRole('button', { name: en ? 'Save this setup' : '이 설정 저장' }).click();
    await command.locator('form input').fill('Weekly allocation');
    await command.getByRole('button', { name: en ? 'Save' : '저장', exact: true }).click();
    await expect.poll(() => posted.length).toBe(1);
    expect(posted[0].toolId).toBe('5-3');
    expect(posted[0].steps.some(step => step.id === 'view.hide')).toBe(true);
    expect(posted[0].steps.some(step => step.id === 'allocation.recentDays')).toBe(true);
    expect(posted[0].steps.some(step => Object.hasOwn(step.params, 'values'))).toBe(false);
    await command.getByRole('button', { name: en ? 'Remove Hide Budget scenarios' : '예산 시나리오 숨기기 빼기' }).click();
    await expect(page.locator('#s-scenario')).toBeVisible();
    await input.fill('Weekly allocation');
    await page.getByRole('option', { name: /Weekly allocation/ }).click();
    await expect(page.locator('#s-scenario')).toBeHidden();
    await expect(page.locator('#prism-total-budget-exact')).toHaveValue(amount);
    await expect(plan).toHaveText(initial);
    await input.fill(en ? 'File name: tool_period' : '파일 이름: 도구_기간');
    await page.getByRole('option', { name: en ? /File name: tool_period/ : /파일 이름: 도구_기간/ }).click();
    const pending = page.waitForEvent('download');
    await page.getByRole('tab', { name: en ? 'Allocation' : '배분안', exact: true }).click();
    await page.getByRole('radio', { name: en ? 'Share' : '비중', exact: true }).click();
    await page.locator('#s-bar').getByRole('button', { name: en ? 'Download PNG' : 'PNG 받기' }).click();
    const exported = await pending;
    expect(await exported.failure()).toBeNull();
    expect(exported.suggestedFilename()).toContain('20240101-20240330');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  });
}
