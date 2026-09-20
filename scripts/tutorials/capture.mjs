// Capture real local UI with synthetic fixtures only. Never point at production.
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const app = path.resolve('v2-migration');
const require = createRequire(path.join(app, 'package.json'));
const { chromium } = require('playwright');
const out = process.env.TUTORIAL_CAPTURE_DIR || '/tmp/gop-tutorial-videos/assets';
const base = 'http://localhost:3100';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const source = await readFile(path.join(app, 'public/examples/weekly-report-campaigns.csv'));
for (const locale of ['ko', 'en']) {
  const en = locale === 'en', prefix = en ? '/en' : '';
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, colorScheme: 'light', locale: en ? 'en-US' : 'ko-KR' });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('dialog', dialog => dialog.accept()); // Only synthetic local project switch confirmations.
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  // Local fixture: signed-in synthetic account with an active trial.
  // Device save and optional account memo storage are exercised separately.
  let trial = false;
  await page.route('**/api/payments/config', route => route.fulfill({ json: { enabled: false, mode: 'test' } }));
  await page.route('**/api/payments/access', route => route.fulfill({ json: { entitlement: null } }));
  await page.route('**/api/account/session', route => route.fulfill({ json: { enabled: true, mailEnabled: false, account: { id: 'tutorial-demo', email: 'tutorial@example.com', trialStartedAt: trial ? '2026-09-14T00:00:00Z' : null }, entitlement: trial ? { plan: 'paid', account: true, trial: true, expiresAt: Date.now() + 86400000 * 14, offlineUntil: Date.now() + 86400000 } : null } }));
  await page.route('**/api/account/memos', route => { if (route.request().method() === 'POST') { trial = true; return route.fulfill({ json: { trialStarted: true } }); } return route.fulfill({ json: { memos: [] } }); });
  await page.addInitScript(() => { localStorage.setItem('mkt-library-theme', 'light'); localStorage.setItem('gop:sidebar', 'collapsed'); localStorage.setItem('mkt-library-source-survey-answered', '1'); });
  const snap = async (name, selector) => {
    const target = page.locator(selector).filter({visible:true}).first();
    await target.waitFor({ state: 'visible' });
    await target.scrollIntoViewIfNeeded();
    await page.addStyleTag({ content: 'html{scroll-behavior:auto!important}' });
    if (!await target.evaluate(node => !!node.closest('[role="dialog"]'))) {
      await target.evaluate(node => window.scrollBy(0, node.getBoundingClientRect().top - 144));
    }
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.evaluate(async () => { await document.fonts.ready; });
    await page.addStyleTag({ content: '.tutorial-launcher,.tutorial-inline{visibility:hidden!important}' });
    const box = await target.boundingBox();
    // Focus the actual UI; keep its text at native resolution. No recreated UI.
    const width = ['downloads', 'preview-entry'].includes(name) ? 600 : 1000;
    const height = width * .56;
    const x = Math.max(0, Math.min(box.x - 16, 1280 - width));
    const y = Math.max(0, Math.min(box.y - 16, 800 - height));
    await writeFile(path.join(out, `${name}-${locale}.focus.json`), JSON.stringify({x: Math.max(10, Math.min(90, (box.x - x + Math.min(box.width, 400) / 2) / (width / 100))), y: Math.max(10, Math.min(90, (box.y - y + Math.min(box.height, 180) / 2) / (height / 100)))}));
    await page.screenshot({ path: path.join(out, `${name}-${locale}.png`), clip: { x, y, width, height }, animations: 'disabled' });
    console.log(`${locale}: ${name}`);
  };
  const upload = async (data = source) => {
    const uploader = page.locator('.csv-uploader[data-hydrated="true"]').first();
    await uploader.waitFor();
    const changeCsv = uploader.locator('.csv-change-btn');
    if (data !== source) await changeCsv.waitFor(); // Wait for restored file before replacing it.
    if (await changeCsv.isVisible()) await changeCsv.click();
    await uploader.locator('input[type="file"][accept*="csv"]').first().waitFor({state:'attached'}).catch(async error => {await writeFile(path.join(out, 'upload-failure.txt'), await page.locator('body').innerText()); throw error;});
    await uploader.locator('input[type="file"][accept*="csv"]').first().setInputFiles({ name: 'tutorial-campaigns.csv', mimeType: 'text/csv', buffer: data });
    await page.locator('.file-state').first().getByText('tutorial-campaigns.csv', { exact: false }).waitFor();
    await uploader.locator('[data-currency-scope="declare"]').getByRole('button', { name: /^(원 ₩|KRW ₩)$/ }).click();
    return uploader;
  };
  const selectCpi = async () => { await page.getByRole('button', {name: en ? 'Edit project settings' : '프로젝트 기준 편집', exact:true}).click();
  await page.getByRole('combobox', {name: en ? 'Headline metric' : '핵심 지표', exact:true}).selectOption('cpi');
  await page.getByRole('button', {name: en ? 'Close settings' : '설정 접기', exact:true}).click(); };
  await page.goto(`${base}${prefix}/dashboard`);
  await page.locator('.csv-uploader[data-hydrated="true"]').first().waitFor();
  await snap('empty', '.csv-dropzone');
  await page.getByRole('button', { name: en ? '📊 Import from a public Google Sheet' : '📊 공개 Google Sheets에서 불러오기', exact: true }).click();
  await snap('sheets', 'form:has(input[type="url"])');
  await writeFile(path.join(out, `sheets-dom-${locale}.txt`), await page.locator('form:has(input[type="url"])').innerText());
  const guides = page.locator('form:has(input[type="url"]) details');
  for (const detail of await guides.all()) { await detail.locator(':scope > summary').click(); }
  await snap('sheets-guide', '.google-sheets-guide');
  const uploader = await upload();
  await snap('uploaded', '.file-state');
  // Open mapping only if the uploader collapsed it after recognition.
  const mapping = page.locator('.mapping-grid');
  if (!await mapping.isVisible()) {
    const details = page.locator('details').filter({ has: mapping });
    await details.locator(':scope > summary').click();
  }
  await snap('mapping', '.mapping-grid');
  await writeFile(path.join(out, `upload-dom-${locale}.txt`), await uploader.innerText());
  await snap('analyze', '.csv-analysis-action');
  await uploader.getByRole('button', { name: en ? 'Analyze data' : '데이터 분석하기', exact: true }).click();
  await page.getByRole('tab', { name: en ? 'Scorecard' : '스코어카드', exact: true }).click();
  await snap('dashboard', '[role="tabpanel"]');
  await snap('filters', '.dashboard-filter-bar');
  // Full demo adds cohort data; these are explicitly labelled synthetic frames.
  await page.goto(`${base}${prefix}/blog/cac-payback-period`);
  await page.locator('#blog-practice').getByRole('button', { name: en ? 'Open analysis with demo' : '데모로 분석 열기', exact: true }).click();
  const replace = page.getByRole('checkbox', {name: en ? "Replace the current dataset in the detailed tool with this CSV." : '상세 도구의 기존 데이터를 이 CSV로 교체합니다.', exact:true});
  await replace.or(page.locator('.csv-uploader')).first().waitFor();
  if (await replace.isVisible()) { await replace.check(); await page.locator('#blog-practice').getByRole('button', {name: en ? 'Open detailed analysis' : '더 자세한 분석 보기', exact:true}).click(); }
  const demoNotice = page.getByRole('dialog').getByRole('button', { name: en ? 'Not now' : '나중에', exact: true });
  if (await demoNotice.isVisible()) await demoNotice.click();
  await writeFile(path.join(out, `ltv-entry-${locale}.txt`), await page.locator('body').innerText());
  await page.getByRole('button', { name: en ? 'Analyze data' : '데이터 분석하기', exact: true }).click();
  await page.getByRole('tab', { name: 'LTV & ROAS', exact: true }).click();
  await snap('ltv', '[role="tabpanel"]');
  await page.goto(`${base}${prefix}/start`);
  await snap('start', 'main');
  await page.goto(`${base}${prefix}/tools/incrementality`);
  await writeFile(path.join(out, `causal-dom-${locale}.txt`), await page.locator('main').innerText());
  await page.locator('#tab-incr[data-hydrated="true"]').waitFor();
  await page.getByRole('button', { name: en ? /Run the example and see results/ : /예시 데이터로 결과 바로 보기/ }).first().click();
  const notice = page.getByRole('dialog').filter({ visible: true });
  if (await notice.count()) await notice.getByRole('button', { name: en ? 'Not now' : '나중에', exact: true }).click();
  await writeFile(path.join(out, `causal-loaded-dom-${locale}.txt`), await page.locator('main').innerText());
  await snap('causal', '.analysis-design-check');
  trial = true;
  await page.goto(`${base}${prefix}/dashboard`);
  const preparedReviewUpload = await upload();
  await preparedReviewUpload.getByRole('button', { name: en ? 'Analyze data' : '데이터 분석하기', exact: true }).click();
  await page.locator('header a[href="'+prefix+'/weekly-review"]').first().click();
  await page.getByRole('button', {name: en ? 'Compare weekly performance' : '주간 성과 비교', exact:true}).click();
  await snap('review-empty', '.project-review-workspace');
  // The same uploaded efficiency dataset follows the in-app navigation.
  await selectCpi();
  await snap('periods', '.wr-screen__period');
  await snap('verdict', '#wr-verdict');
  await page.getByRole('button', { name: /^(결정 기록:|Record decision for:)/ }).first().click();
  await page.locator('.wr-mine').getByRole('button', {name: en ? 'Hold' : '유지', exact:true}).click();
  await page.locator('#wr-decision-target').fill(en ? 'Campaign A · hold further scaling' : '캠페인 A · 추가 증액 보류');
  await snap('decision', '.wr-mine');
  await page.getByRole('button', { name: en ? 'Save this decision' : '이 결정 저장', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: en ? 'Save review' : '리뷰 저장', exact: true });
  await dialog.getByRole('textbox', { name: en ? 'Project name' : '프로젝트 이름', exact: true }).fill(en ? 'Demo app · weekly review' : '데모 앱 · 주간 리뷰');
  await snap('save', '[role="dialog"]');
  await dialog.getByRole('button', { name: en ? /^(Create project and save|Save review)$/ : /^(프로젝트 만들고 저장|리뷰 저장)$/ }).click();
  await dialog.getByRole('heading', { name: en ? 'Review saved' : '리뷰를 저장했습니다' }).waitFor();
  await snap('saved', '[role="dialog"]');
  await dialog.locator('details > summary').filter({hasText: en ? 'Keep a memo in my account' : '계정에 메모 보관'}).click();
  await dialog.getByRole('checkbox', {name: en ? 'Store this selected memo in my account.' : '선택한 메모를 계정에 보관합니다.', exact:true}).check();
  await dialog.getByRole('button', {name: en ? 'Save decision to account' : '결정 메모 계정에 저장', exact:true}).click();
  await dialog.getByRole('button', { name: en ? 'Done' : '닫기', exact: true }).click();
  await snap('report', '.wr-report');
  await snap('preview-entry', '.wr-report-actions button:has-text("'+(en ? 'Preview my report' : '내 보고서 미리보기')+'")');
  await page.getByRole('button', { name: en ? 'Download Word / Excel' : 'Word / Excel 보고서 받기', exact: true }).click();
  await snap('downloads', '[role="menu"]');
  await page.getByRole('menuitem', { name: en ? /Preview my report/ : /내 보고서 미리보기/ }).click();
  await snap('preview', '.analysis-report-preview__next');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: en ? 'My projects' : '내 프로젝트', exact: true }).click();
  await snap('projects', '#project-management');
  const backupDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: en ? 'Export backup' : '백업 내보내기', exact: true }).first().click();
  const backup = await backupDownload;
  const backupPath = path.join(out, `demo-backup-${locale}.json`);
  await backup.saveAs(backupPath);
  await snap('backup', '.project-actions');
  await page.locator('#project-backup input[type="file"]').setInputFiles(backupPath);
  await snap('restore', '.project-import-preview');
  await page.getByRole('button', { name: en ? 'Open review' : '리뷰 열기', exact: true }).first().click();
  await snap('project-open', '.project-review-workspace__bar');
  await page.goto(`${base}${prefix}/dashboard`);
  const nextUpload = await upload(await readFile(path.join(app, 'public/examples/weekly-report-three-weeks.csv')));
  await nextUpload.getByRole('button', {name: en ? 'Analyze data' : '데이터 분석하기', exact:true}).click();
  await page.locator('header a[href="'+prefix+'/weekly-review"]').first().click();
  await page.getByRole('button', {name: en ? 'Compare weekly performance' : '주간 성과 비교', exact:true}).click();
  await selectCpi();
  await snap('followup', '#wr-verdict');
  if (errors.length) throw new Error(errors.join('\n'));
  await context.close();
}
await browser.close();
