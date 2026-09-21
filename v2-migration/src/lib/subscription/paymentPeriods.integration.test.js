import { afterAll, beforeAll, expect, it, vi } from "vitest";
import pg from "pg";
import { readFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";

const identity = vi.hoisted(() => ({ account: { id: "00000000-0000-4000-8000-000000000001" } }));
vi.mock("@/lib/account/accountServer", () => ({ readAccount: async () => identity.account, accountsEnabled: () => true }));
const enabled = Boolean(process.env.PAYMENTS_TEST_DATABASE_URL);
let db, schema, server;
const query = (...args) => db.query(...args);
beforeAll(async () => {
  if (!enabled) return;
  schema = `gop_test_${randomUUID().replaceAll("-", "")}`;
  db = new pg.Client({ connectionString: process.env.PAYMENTS_TEST_DATABASE_URL });
  await db.connect();
  await query("SET TIME ZONE 'UTC'");
  await query(`CREATE SCHEMA ${schema}`);
  await query(`SET search_path TO ${schema}`);
  await query(await readFile(new URL("../../../../scripts/payments-schema.sql", import.meta.url), "utf8"));
  await query(await readFile(new URL("../../../../scripts/accounts-schema.sql", import.meta.url), "utf8"));
  const migration = await readFile(new URL("../../../scripts/payment-periods.sql", import.meta.url), "utf8");
  await query(migration); await query(migration);
  const mappings = await readFile(new URL("../../../scripts/account-mappings.sql", import.meta.url), "utf8");
  await query(mappings); await query(mappings);
  await query("INSERT INTO gop_accounts(id,google_sub,email) VALUES($1,'fixture','fixture@example.com')", [identity.account.id]);
  const url = new URL(process.env.PAYMENTS_TEST_DATABASE_URL);
  url.searchParams.set("options", `-c search_path=${schema}`);
  vi.stubEnv("PAYMENTS_DATABASE_URL", url.href);
  vi.stubEnv("TOSS_CLIENT_KEY", "test_gck_fixture"); vi.stubEnv("TOSS_SECRET_KEY", "test_gsk_fixture");
  server = await import("./paymentServer");
});
afterAll(async () => {
  vi.unstubAllGlobals(); vi.unstubAllEnvs();
  if (db) {
    if (/^gop_test_[a-f0-9]{32}$/.test(schema)) await query(`DROP SCHEMA ${schema} CASCADE`);
    await db.end();
  }
});
const request = cookie => new Request("https://example.com/api/payments/confirm", { method: "POST", headers: { origin: "https://example.com", cookie: cookie || "" } });
it.skipIf(!enabled)("allocates concurrent renewals once under real PostgreSQL transactions", async () => {
  const { passExpiresAt } = await import("./paymentProduct");
  const orders = await Promise.all([server.createPaymentOrder(request()), server.createPaymentOrder(request())]);
  const approvedAt = new Date().toISOString();
  const inputs = orders.map((order, i) => ({ orderId: order.body.orderId, amount: 5900, paymentKey: `fixture-${i}` }));
  vi.stubGlobal("fetch", vi.fn(async url => {
    const input = inputs.find(value => url.endsWith(value.paymentKey));
    return Response.json({ ...input, totalAmount: 5900, currency: "KRW", status: "DONE", approvedAt });
  }));
  await Promise.all(inputs.map((input, i) => server.confirmPayment(request(orders[i].cookie.split(";")[0]), input)));
  const first = (await query("SELECT starts_at,expires_at FROM gop_payment_orders ORDER BY expires_at")).rows;
  expect(first.map(row => row.expires_at.toISOString())).toEqual([passExpiresAt(approvedAt), passExpiresAt(passExpiresAt(approvedAt))]);
  expect(first[1].starts_at.toISOString()).toBe(first[0].expires_at.toISOString());
  await Promise.all(inputs.map((input, i) => server.confirmPayment(request(orders[i].cookie.split(";")[0]), input)));
  expect((await query("SELECT starts_at,expires_at FROM gop_payment_orders ORDER BY expires_at")).rows).toEqual(first);
});
it.skipIf(!enabled)("retains legacy periods, caps expiry and does not bridge a refunded gap", async () => {
  await query("UPDATE gop_payment_orders SET status='revoked'");
  const id = `gop_${randomUUID()}`;
  await query("INSERT INTO gop_payment_orders(id,access_hash,amount,product_id,idempotency_key,mode,status,account_id,approved_at,starts_at,expires_at) VALUES($1,'fixture',5900,'fixture',$2,'live','paid',$3,'2026-09-01','2026-10-01','2026-11-01')", [id, randomUUID(), identity.account.id]);
  const until = async time => (await query("SELECT gop_paid_until($1,'live',$2) AS until", [identity.account.id, time])).rows[0].until;
  expect(await until("2026-09-15")).toBeNull();
  expect((await until("2026-10-01")).toISOString()).toBe("2026-11-01T00:00:00.000Z");
  expect(await until("2026-11-01")).toBeNull();
  await query("UPDATE gop_payment_orders SET starts_at=NULL WHERE id=$1", [id]);
  expect((await until("2026-09-15")).toISOString()).toBe("2026-11-01T00:00:00.000Z");
  await query("UPDATE gop_payment_orders SET starts_at='2026-10-01' WHERE id=$1", [id]);
  await query("UPDATE gop_accounts SET trial_started_at='2026-09-17' WHERE id=$1", [identity.account.id]);
  expect((await until("2026-09-20")).toISOString()).toBe("2026-11-01T00:00:00.000Z");
});

it.skipIf(!enabled)("preserves mixed PG periods and applies refunds while new checkout is closed", async () => {
  await query("UPDATE gop_payment_orders SET status='revoked'");
  await query("UPDATE gop_accounts SET trial_started_at=NULL WHERE id=$1", [identity.account.id]);
  vi.stubEnv("PAYMENTS_PROVIDER", "toss");
  vi.stubEnv("TOSS_CLIENT_KEY", "live_gck_fixture");
  vi.stubEnv("TOSS_SECRET_KEY", "live_gsk_fixture");
  vi.stubEnv("PAYMENTS_LIVE_ENABLED", "true");
  const approvedAt = new Date().toISOString();
  const old = await server.createPaymentOrder(request());
  const oldInput = { orderId: old.body.orderId, paymentKey: "old-toss-payment", amount: 5900 };
  const toss = { ...oldInput, totalAmount: 5900, currency: "KRW", status: "DONE", approvedAt };
  vi.stubGlobal("fetch", vi.fn(async () => Response.json(toss)));
  await server.confirmPayment(request(old.cookie.split(";")[0]), oldInput);
  vi.stubEnv("PAYMENTS_PROVIDER", "nicepay");
  vi.stubEnv("NICEPAY_APPROVAL_MODEL", "server-basic");
  vi.stubEnv("NICEPAY_MODE", "live");
  vi.stubEnv("NICEPAY_CLIENT_KEY", "nice-client");
  vi.stubEnv("NICEPAY_SECRET_KEY", "nice-secret");
  const next = await server.createPaymentOrder(request());
  const tid = "n".repeat(30), sha = value => createHash("sha256").update(value).digest("hex");
  const input = { orderId: next.body.orderId, paymentKey: tid, tid, amount: 5900, clientId: "nice-client", authResultCode: "0000", authToken: "a".repeat(40) };
  input.signature = sha(`${input.authToken}${input.clientId}5900nice-secret`);
  const nice = { resultCode: "0000", orderId: input.orderId, tid, amount: 5900, balanceAmt: 5900, currency: "KRW", payMethod: "card", status: "paid", paidAt: approvedAt, ediDate: approvedAt };
  nice.signature = sha(`${tid}5900${approvedAt}nice-secret`);
  fetch.mockImplementation(async url => Response.json(url.includes("nicepay.co.kr") ? nice : toss));
  await server.confirmPayment(request(next.cookie.split(";")[0]), input);
  const periods = (await query("SELECT provider,starts_at,expires_at FROM gop_payment_orders WHERE status='paid' ORDER BY expires_at")).rows;
  expect(periods.map(row => row.provider)).toEqual(["toss", "nicepay"]);
  expect(periods[1].starts_at.toISOString()).toBe(periods[0].expires_at.toISOString());
  vi.stubEnv("PAYMENTS_LIVE_ENABLED", "false");
  await expect(server.createPaymentOrder(request())).rejects.toThrow("PAYMENTS_NOT_CONFIGURED");
  nice.status = "cancelled";
  await server.reconcilePaymentWebhook({ orderId: input.orderId }, "nicepay");
  const coverage = (await query("SELECT gop_paid_until($1,'live',NOW()) AS until", [identity.account.id])).rows[0].until;
  expect(coverage.toISOString()).toBe(periods[0].expires_at.toISOString());
  expect((await server.readPaymentAccess(request())).body.entitlement.expiresAt).toBe(periods[0].expires_at.getTime());
});

it.skipIf(!enabled)("mapping schema preserves account isolation, rule limits and deletion cleanup", async () => {
  const other = randomUUID();
  await query("INSERT INTO gop_accounts(id,google_sub,email) VALUES($1,$2,'mapping@example.com')", [other, other]);
  const rules = [{ normalizedColumnName: "my_budget", canonicalKey: "media_spend" }];
  await query("INSERT INTO gop_account_mappings(account_id,rules) VALUES($1,$2)", [other, JSON.stringify(rules)]);
  expect((await query("SELECT rules FROM gop_account_mappings WHERE account_id=$1", [identity.account.id])).rows).toEqual([]);
  expect((await query("SELECT rules FROM gop_account_mappings WHERE account_id=$1", [other])).rows[0].rules).toEqual(rules);
  await expect(query("UPDATE gop_account_mappings SET rules=$2 WHERE account_id=$1", [other, JSON.stringify(Array(201).fill(rules[0]))])).rejects.toMatchObject({ code: "23514" });
  await query("DELETE FROM gop_accounts WHERE id=$1", [other]);
  expect((await query("SELECT rules FROM gop_account_mappings WHERE account_id=$1", [other])).rows).toEqual([]);
});
