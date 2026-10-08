import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

for (const locale of ['ko', 'en']) {
  test(`chart height survives export controls and dashboard resizing (${locale}) ${locale === 'en' ? '@light-en' : ''}`, async ({ page }) => {
    const entitlement = { plan: 'paid', account: true, expiresAt: Date.now() + 86400000, offlineUntil: Date.now() + 3600000 };
    await page.route('**/api/account/session', route => route.fulfill({ json: { enabled: true, account: { id: 'chart-test', email: 'chart@example.com' }, entitlement } }));
    await page.route('**/api/payments/access', route => route.fulfill({ json: { entitlement } }));
    await page.addInitScript(() => localStorage.setItem('mkt-library-source-survey-answered', '1'));
    await page.goto(`${locale === 'en' ? '/en' : ''}/dashboard?example=1`);
    await page.locator('#dashboard-tab-viz').click();
    const plots = page.locator('.dashboard-supporting-chart__canvas');
    await expect(plots).toHaveCount(5);
    // Default plot height belongs to the plot, not to the heading/export row.
    // A revert-layer fallback previously erased this height and produced 150px canvases.
    for (const plot of await plots.all()) {
      await expect.poll(() => plot.evaluate(el => el.getBoundingClientRect().height)).toBe(300);
      await expect.poll(() => plot.locator('canvas').evaluate(el => el.getBoundingClientRect().height)).toBe(300);
    }
    const first = page.locator('.chart-card').first();
    const exportButton = first.locator('.figure-png-button');
    await expect(exportButton).toBeVisible();
    const downloadPromise = page.waitForEvent('download');
    await exportButton.click();
    const download = await downloadPromise;
    const png = readFileSync(await download.path());
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(png.readUInt32BE(20)).toBeGreaterThanOrEqual(600);
    await expect.poll(() => plots.first().locator('canvas').evaluate(el => el.getBoundingClientRect().height)).toBe(300);
    const plotBefore = await plots.first().boundingBox();
    await exportButton.locator('..').evaluate(el => { el.hidden = true; el.style.display = 'none'; });
    await expect.poll(() => plots.first().evaluate(el => el.getBoundingClientRect().height)).toBe(plotBefore.height);
    // Exercise the same CSS custom property used by the saved dashboard height control.
    await first.evaluate(el => el.closest('.dashboard-layout-block').style.setProperty('--dashboard-chart-height', '420px'));
    await expect.poll(() => plots.first().locator('canvas').evaluate(el => el.getBoundingClientRect().height)).toBe(420);
    await first.evaluate(el => el.closest('.dashboard-layout-block').removeAttribute('style'));
    await expect.poll(() => plots.first().locator('canvas').evaluate(el => el.getBoundingClientRect().height)).toBe(300);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  });
}
