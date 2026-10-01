// Isolated PostgreSQL + production Next + two independent browser contexts.
// Never connects to PAYMENTS_DATABASE_URL or any existing database. No API mocks.
// Prerequisites: npm run build; PostgreSQL binaries in PG_BIN or PATH; Playwright Chromium.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, scryptSync } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { chromium, expect } from '@playwright/test';
import { SOURCE_SURVEY_ANSWERED_KEY } from '../e2e/support/sourceSurvey.js';

const app = fileURLToPath(new URL('../', import.meta.url));
const bin = name => process.env.PG_BIN ? path.join(process.env.PG_BIN, name) : name;
const root = await mkdtemp(path.join(tmpdir(), 'gop-storage-check-'));
const data = path.join(root, 'data');
const password = randomBytes(24).toString('hex');
const user = 'gop_storage_check';
const checks = [];
let database, browser, server, pgStarted = false, stage = 'setup';
const check = name => { checks.push(name); console.log(`PASS ${name}`); };
const freePort = async () => {
  const socket = createServer(); socket.listen(0, '127.0.0.1'); await once(socket, 'listening');
  const port = socket.address().port; await new Promise(resolve => socket.close(resolve)); return port;
};
const run = (name, args) => execFileSync(bin(name), args, { stdio: 'pipe', timeout: 30000 });
const waitReady = async url => {
  for (let count = 0; count < 100; count++) {
    if (server.exitCode !== null) throw new Error('LOCAL_APP_EXITED');
    try { if ((await fetch(url)).ok) return; } catch { /* Starting. */ }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('LOCAL_APP_TIMEOUT');
};
const board = name => ({ version: 1, name, tabs: { pacing: {
  order: ['s-pace'], blocks: { 's-pace': { width: 'half', height: '360', hidden: false } }, charts: [],
} } });
const recipe = name => ({ toolId: '5-28', name, steps: [{ id: 'export.png.full', params: {} }] });

try {
  await readFile(path.join(app, '.next/BUILD_ID'));
  await writeFile(path.join(root, 'password'), password, { mode: 0o600 });
  run('initdb', ['-D', data, '-U', user, '--auth-host=scram-sha-256', '--auth-local=scram-sha-256', `--pwfile=${path.join(root, 'password')}`, '--encoding=UTF8', '--no-locale', ...(process.env.PG_SHARE ? ['-L', process.env.PG_SHARE] : [])]);
  const dbPort = await freePort(), appPort = await freePort();
  run('pg_ctl', ['-D', data, '-l', path.join(root, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${dbPort} -k ${root}`, '-w', 'start']);
  pgStarted = true;
  const connectionString = `postgresql://${user}:${password}@127.0.0.1:${dbPort}/postgres`;
  database = new pg.Client({ connectionString }); await database.connect();
  stage = 'schema';
  for (const file of ['../scripts/payments-schema.sql', '../scripts/accounts-schema.sql', 'scripts/payment-periods.sql']) {
    await database.query(await readFile(path.resolve(app, file), 'utf8'));
  }
  // Exercise the exact deployed additive SQL twice, including preservation of existing rows.
  const applyStorage = async () => {
    await database.query('BEGIN');
    try {
      await database.query("SET LOCAL lock_timeout='10s'");
      await database.query('SELECT pg_advisory_xact_lock(71692501)');
      for (const file of ['account-recipes.sql', 'account-boards.sql']) await database.query(await readFile(new URL(file, import.meta.url), 'utf8'));
      await database.query('COMMIT');
    } catch (error) { await database.query('ROLLBACK'); throw error; }
  };
  await applyStorage();
  const salt = randomBytes(16);
  const hash = `scrypt$16384$8$1$${salt.toString('hex')}$${scryptSync(password, salt, 64).toString('hex')}`;
  const owner = randomUUID(), other = randomUUID();
  const emails = ['storage-owner@example.test', 'storage-other@example.test'];
  for (const [index, id] of [owner, other].entries()) await database.query(
    'INSERT INTO gop_accounts(id,email,password_hash,trial_started_at) VALUES($1,$2,$3,NOW())', [id, emails[index], hash]);
  await database.query('INSERT INTO gop_account_boards(account_id,boards) VALUES($1,$2)', [owner, JSON.stringify([board('Migration sentinel')])]);
  await database.query('INSERT INTO gop_account_recipes(account_id,recipes) VALUES($1,$2)', [owner, JSON.stringify([recipe('Migration sentinel')])]);
  await applyStorage();
  assert.equal((await database.query('SELECT boards FROM gop_account_boards WHERE account_id=$1', [owner])).rows[0].boards[0].name, 'Migration sentinel');
  assert.equal((await database.query('SELECT recipes FROM gop_account_recipes WHERE account_id=$1', [owner])).rows[0].recipes[0].name, 'Migration sentinel');
  check('migration rerun preserves existing boards and recipes');

  const origin = `http://127.0.0.1:${appPort}`;
  // Override all account/mail/payment environment entry points. OAuth is never called.
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', String(appPort)], {
    cwd: app, stdio: 'ignore', env: { ...process.env, PAYMENTS_DATABASE_URL: connectionString,
      ACCOUNTS_ENABLED: 'true', ACCOUNTS_ORIGIN: origin, ACCOUNT_ALLOWED_EMAILS: emails.join(','),
      ACCOUNT_PASSWORD_LOGINS: emails.join(','), GOOGLE_CLIENT_ID: 'local-storage-check', GOOGLE_CLIENT_SECRET: 'local-storage-check',
      RAILWAY_ENVIRONMENT_NAME: '', RAILWAY_ENVIRONMENT_ID: '', ACCOUNT_MAIL_ENABLED: 'false', GOP_SERVICE_WORKER: 'false',
    },
  });
  await waitReady(`${origin}/api/account/session`);
  browser = await chromium.launch();
  const makeContext = () => browser.newContext({ baseURL: origin, viewport: { width: 1440, height: 1000 } });
  const deviceA = await makeContext(), deviceB = await makeContext(), stranger = await makeContext();
  const request = (context, endpoint, method = 'GET', body, requestOrigin = origin) => context.request.fetch(`/api/account/${endpoint}`, {
    method, headers: { Origin: requestOrigin }, ...(body === undefined ? {} : { data: body }),
  });
  const login = async (context, email) => {
    const response = await request(context, 'password-login', 'POST', { email, password });
    assert.equal(response.status(), 200, 'real password login');
    const session = await (await request(context, 'session')).json();
    assert.ok(session.account?.id && session.entitlement?.account, 'real account entitlement');
  };
  await login(deviceA, emails[0]); await login(deviceB, emails[0]); await login(stranger, emails[1]);
  assert.notEqual((await deviceA.cookies()).find(c => c.name === 'gop_account').value,
    (await deviceB.cookies()).find(c => c.name === 'gop_account').value, 'independent real sessions');
  check('independent authenticated sessions use actual account and Pro checks');

  stage = 'browser save and restore';
  const errors = [];
  for (const context of [deviceA, deviceB]) {
    await context.addInitScript(({ key, origin }) => {
      if (location.origin === origin) localStorage.setItem(key, '1');
    }, { key: SOURCE_SURVEY_ANSWERED_KEY, origin });
    context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
  }
  const pageA = await deviceA.newPage(), pageB = await deviceB.newPage();
  for (const locale of ['ko', 'en']) {
    const t = (ko, en) => locale === 'en' ? en : ko;
    const prefix = locale === 'en' ? '/en' : '';
    const name = `Device layout ${locale}`;
    await pageA.goto(`${origin}${prefix}/dashboard?example=1`);
    await expect(pageA.locator('#s-kpi')).toBeVisible({ timeout: 45000 });
    await pageA.getByRole('button', { name: t('대시보드 편집 · Pro', 'Edit dashboard · Pro'), exact: true }).click();
    const editor = pageA.locator('.dashboard-editor');
    await editor.getByRole('button', { name: t('차트 추가', 'Add chart'), exact: true }).click();
    await editor.getByLabel(t('차트 제목', 'Chart title')).fill('Private data title');
    await editor.getByRole('button', { name: t('배치', 'Layout'), exact: true }).click();
    await editor.getByLabel(t('구역 폭', 'Block width')).selectOption('half');
    await pageA.getByRole('button', { name: t('편집 저장', 'Save edits'), exact: true }).click();
    await pageA.getByRole('button', { name: t('보드 동기화·팀 공유', 'Board sync / team sharing'), exact: true }).click();
    const dialogA = pageA.getByRole('dialog');
    await dialogA.getByLabel(t('구성 이름', 'Layout name'), { exact: true }).fill(name);
    await dialogA.getByRole('button', { name: t('계정에 저장', 'Save to account'), exact: true }).click();
    await expect(dialogA.getByRole('status')).toContainText(t('계정에 저장했습니다.', 'Saved to your account.'));
    await pageB.goto(`${origin}${prefix}/dashboard?example=1`);
    await expect(pageB.locator('#s-kpi')).toBeVisible({ timeout: 45000 });
    await pageB.getByRole('button', { name: t('보드 동기화·팀 공유', 'Board sync / team sharing'), exact: true }).click();
    const row = pageB.getByRole('dialog').locator('.dashboard-board-row').filter({ hasText: name });
    await row.getByRole('button', { name: t('미리보기 적용', 'Apply to preview'), exact: true }).click();
    await pageB.getByRole('dialog').getByRole('button', { name: t('닫기', 'Close'), exact: true }).click();
    await pageB.getByRole('button', { name: t('편집 저장', 'Save edits'), exact: true }).click();
    await expect(pageB.locator('.dashboard-layout-block[data-block-id="custom-0"]')).toHaveAttribute('data-width', 'half');
    await expect(pageB.locator('.dashboard-custom-block').first()).not.toContainText('Private data title');
    check(`board saved in browser A and restored in browser B (${locale})`);

    const setup = `Device recipe ${locale}`;
    await pageA.goto(`${origin}${prefix}/tools/subscription-survival?example=1`);
    const rootA = pageA.locator('.tool-autonomy');
    await expect(pageA.locator('.tool-next-step-panel')).toBeVisible({ timeout: 45000 });
    const unitA = rootA.locator('select').filter({ has: pageA.locator('option[value="month"]') });
    await unitA.selectOption('week');
    await rootA.getByRole('button', { name: t('이 설정 저장', 'Save this setup'), exact: true }).click();
    await rootA.getByLabel(t('설정 이름', 'Setup name'), { exact: true }).fill(setup);
    await rootA.getByRole('button', { name: t('저장', 'Save'), exact: true }).click();
    await expect.poll(async () => (await (await request(deviceB, 'recipes')).json()).recipes.some(r => r.name === setup)).toBe(true);
    await pageB.goto(`${origin}${prefix}/tools/subscription-survival?example=1`);
    await expect(pageB.locator('.tool-next-step-panel')).toBeVisible({ timeout: 45000 });
    const rootB = pageB.locator('.tool-autonomy');
    const unitB = rootB.locator('select').filter({ has: pageB.locator('option[value="month"]') });
    await unitB.selectOption('day');
    const command = rootB.getByRole('combobox', { name: t('분석·보기 설정', 'Analysis and view settings') });
    await command.fill(setup);
    await expect(rootB.getByRole('option', { name: new RegExp(setup) })).toBeVisible();
    await command.press('Enter');
    await expect(unitB).toHaveValue('week');
    check(`analysis controls saved in browser A and restored in browser B (${locale})`);
  }
  assert.deepEqual(errors, []);

  stage = 'database and API contracts';
  for (const [endpoint, field, make] of [['boards', 'board', board], ['recipes', 'recipe', recipe]]) {
    const responses = await Promise.all(Array.from({ length: 6 }, (_, i) => request(i % 2 ? deviceA : deviceB, endpoint, 'POST', { [field]: make(`Concurrent ${i}`) })));
    assert.ok(responses.every(response => response.status() === 200));
    let records = (await (await request(deviceB, endpoint)).json())[endpoint];
    assert.equal(records.filter(record => record.name.startsWith('Concurrent ')).length, 6);
    assert.deepEqual((await (await request(stranger, endpoint)).json())[endpoint], []);
    assert.equal((await request(deviceA, endpoint, 'POST', { [field]: make('Spoof'), accountId: other })).status(), 400);
    assert.equal((await request(deviceA, endpoint, 'POST', { [field]: make('Foreign origin') }, 'https://other.invalid')).status(), 403);
    assert.equal((await request(deviceA, endpoint, 'POST', { [field]: { ...make('Private'), raw: [{ cost: 123 }] } })).status(), 400);
    check(`${endpoint}: concurrent saves, owner isolation, origin and raw-data rejection`);
    const stored = (await database.query(`SELECT ${endpoint} FROM gop_account_${endpoint} WHERE account_id=$1`, [owner])).rows[0][endpoint];
    assert.equal(stored.length, records.length);
    assert.doesNotMatch(JSON.stringify(stored), /Private data title|demo_efficiency|csvData|"raw"|"values"/);
  }
  for (const [endpoint, make, limit] of [['boards', board, 20], ['recipes', recipe, 100]]) {
    const before = (await (await request(deviceB, endpoint)).json())[endpoint];
    await database.query('BEGIN');
    let rejected = false;
    try {
      await database.query(`UPDATE gop_account_${endpoint} SET ${endpoint}=$2 WHERE account_id=$1`,
        [owner, JSON.stringify(Array.from({ length: limit + 1 }, (_, i) => make(`Limit ${i}`)))]);
    } catch (error) { rejected = error.code === '23514'; }
    finally { await database.query('ROLLBACK'); }
    assert.equal(rejected, true, `${endpoint} database constraint`);
    assert.deepEqual((await (await request(deviceB, endpoint)).json())[endpoint], before);
    check(`${endpoint}: PostgreSQL limit rejects invalid write and rollback preserves records`);
  }
  const connectionCount = (await database.query('SELECT count(*)::int AS n FROM gop_account_sessions WHERE account_id=$1', [owner])).rows[0].n;
  assert.equal(connectionCount, 2);
  await database.query("UPDATE gop_accounts SET trial_started_at=NOW()-INTERVAL '30 days' WHERE id=$1", [owner]);
  for (const [endpoint, field, make] of [['boards', 'board', board], ['recipes', 'recipe', recipe]]) {
    const saved = await (await request(deviceB, endpoint)).json();
    assert.equal(saved.canApply, false); assert.ok(saved[endpoint].length > 0);
    assert.equal((await request(deviceA, endpoint, 'POST', { [field]: make('Expired') })).status(), 402);
    assert.equal((await request(deviceA, endpoint, 'DELETE', { name: 'Concurrent 0', ...(endpoint === 'recipes' ? { toolId: '5-28' } : {}) })).status(), 200);
    assert.ok(!(await (await request(deviceB, endpoint)).json())[endpoint].some(r => r.name === 'Concurrent 0'));
  }
  check('expired Pro retains reads and exact deletion while rejecting writes');
  assert.equal((await request(deviceA, 'session', 'DELETE')).status(), 200);
  assert.equal((await request(deviceA, 'boards')).status(), 401);
  assert.equal((await request(deviceB, 'boards')).status(), 200);
  check('logout revokes only its own session');
  console.log(JSON.stringify({ environment: 'isolated-local-postgresql', operationalVerified: false, checks: checks.length }));
} catch (error) {
  console.error(`FAIL ${stage}: ${error.message}`); process.exitCode = 1;
} finally {
  await browser?.close();
  if (server && server.exitCode === null) { server.kill('SIGTERM'); await once(server, 'exit'); }
  await database?.end().catch(() => {});
  if (pgStarted) run('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop']);
  await rm(root, { recursive: true, force: true });
}
