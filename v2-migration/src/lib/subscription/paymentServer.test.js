import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { passExpiresAt, verifiedPayment } from "./paymentProduct";
import { assertSameOrigin, confirmPayment, createPaymentOrder, paymentConfiguration, readPaymentAccess, redirectPaymentResult, paymentResponse } from "./paymentServer";

const db = vi.hoisted(() => ({ rows: new Map(), calls: [], active: 0, account: null }));
vi.mock("@/lib/account/accountServer", async importOriginal => ({ ...await importOriginal(), readAccount: async () => db.account }));
vi.mock("pg", () => ({ default: { Pool: class {
  async connect() { db.active++; return this; }
  release() { db.active--; }
  async query(sql, args = []) {
    db.calls.push({ sql, args });
    if (sql.startsWith("SELECT GREATEST")) {
      const ends = [...db.rows.values()].filter(row => row.account_id === args[0] && row.mode === args[1] && row.status === "paid").map(row => Date.parse(row.expires_at));
      return { rows: [{ starts_at: new Date(Math.max(Date.parse(args[2]), ...ends, db.account?.trial_started_at ? Date.parse(db.account.trial_started_at) + 14 * 86400000 : 0)).toISOString() }] };
    }
    if (sql.startsWith("SELECT gop_paid_until")) {
      const ends = [...db.rows.values()].filter(row => row.account_id === args[0] && row.mode === args[1] && row.status === "paid").map(row => Date.parse(row.expires_at));
      return { rows: [{ paid_until: ends.length ? new Date(Math.max(...ends)).toISOString() : null }] };
    }
    if (sql.startsWith("SELECT") && sql.includes("WHERE account_id=$1")) return { rows: [...db.rows.values()].filter(row => row.account_id === args[0] && row.mode === args[1] && (!sql.includes("AND status='pending'") || row.status === "pending" && row.payment_key)) };
    if (sql.startsWith("SELECT")) return { rows: db.rows.has(args[0]) ? [{ ...db.rows.get(args[0]) }] : [] };
    if (sql.startsWith("INSERT")) db.rows.set(args[0], { id: args[0], access_hash: args[1], amount: args[2], product_id: args[3], idempotency_key: args[4], mode: args[5], account_id: args[6], status: "pending", created_at: new Date() });
    if (sql.startsWith("UPDATE")) {
      const row = db.rows.get(args[0]);
      if (sql.includes("status='paid'")) { if (row.status === "revoked") return { rowCount: 0 }; Object.assign(row, { status: "paid", approved_at: args[1], expires_at: args[2], starts_at: args[3] }); }
      if (sql.includes("status='revoked'")) row.status = "revoked";
      if (sql.includes("SET status='pending'")) row.status = "pending";
      if (sql.includes("account_id=$2")) row.account_id = args[1];
      if (sql.includes("payment_key=$2")) row.payment_key = args[1];
    }
    return { rows: [], rowCount: 1 };
  }
} } }));
const request = (cookie = "", path = "confirm") => new Request(`https://example.com/api/payments/${path}`, { method: "POST", headers: { origin: "https://example.com", cookie } });
let payment;
beforeEach(() => {
  vi.stubEnv("ACCOUNTS_ENABLED", "false");
  db.rows.clear(); db.calls.length = 0; db.active = 0; db.account = { id: "verified-owner" };
  vi.stubEnv("PAYMENTS_REQUIRE_ACCOUNT", undefined);
  vi.stubEnv("TOSS_CLIENT_KEY", "test_gck_fixture"); vi.stubEnv("TOSS_SECRET_KEY", "test_gsk_fixture"); vi.stubEnv("PAYMENTS_DATABASE_URL", "postgresql://fixture"); vi.stubEnv("PAYMENTS_LIVE_ENABLED", "false");
  payment = null;
  vi.stubGlobal("fetch", vi.fn(async () => Response.json(payment)));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });
async function fixture() {
  const created = await createPaymentOrder(request());
  const cookie = created.cookie.split(";")[0];
  const input = { orderId: created.body.orderId, amount: 5900, paymentKey: "fixture-payment" };
  payment = { orderId: input.orderId, paymentKey: input.paymentKey, totalAmount: 5900, currency: "KRW", status: "DONE", approvedAt: new Date().toISOString() };
  return { cookie, input };
}
describe("payment boundaries", () => {
  it("does not let the pilot allowlist silently change the purchase identity policy", async () => {
    vi.stubEnv("ACCOUNTS_ENABLED", "true"); vi.stubEnv("GOOGLE_CLIENT_ID", "fixture"); vi.stubEnv("GOOGLE_CLIENT_SECRET", "fixture");
    vi.stubEnv("ACCOUNT_ALLOWED_EMAILS", "owner@example.com");
    db.account = null;
    expect(paymentConfiguration().requiresAccount).toBe(true);
    await expect(createPaymentOrder(request())).rejects.toThrow("LOGIN_REQUIRED");
    vi.stubEnv("PAYMENTS_REQUIRE_ACCOUNT", "false");
    await expect(createPaymentOrder(request())).rejects.toThrow("LOGIN_REQUIRED");
  });
  it("requires a verified account for new orders after account rollout", async () => {
    db.account = null;
    vi.stubEnv("ACCOUNTS_ENABLED", "true"); vi.stubEnv("GOOGLE_CLIENT_ID", "fixture"); vi.stubEnv("GOOGLE_CLIENT_SECRET", "fixture");
    expect(paymentConfiguration().requiresAccount).toBe(true);
    await expect(createPaymentOrder(request())).rejects.toThrow("LOGIN_REQUIRED");
    expect(db.calls).toHaveLength(0);
  });
  it("clamps a calendar month in KST, including leap years", () => {
    expect(passExpiresAt("2026-01-31T03:00:00Z")).toBe("2026-02-28T03:00:00.000Z");
    expect(passExpiresAt("2028-01-31T03:00:00Z")).toBe("2028-02-29T03:00:00.000Z");
    expect(passExpiresAt("2026-12-31T16:00:00Z")).toBe("2027-01-31T16:00:00.000Z");
  });
  it("does not expose secrets or enable live payments implicitly", () => {
    expect(paymentConfiguration().enabled).toBe(true);
    expect(JSON.stringify(paymentConfiguration())).not.toContain("gsk");
    vi.stubEnv("TOSS_CLIENT_KEY", "live_gck_fixture"); vi.stubEnv("TOSS_SECRET_KEY", "live_gsk_fixture");
    expect(paymentConfiguration().enabled).toBe(false);
    vi.stubEnv("PAYMENTS_LIVE_ENABLED", "true"); expect(paymentConfiguration().enabled).toBe(true);
  });
  it("rejects cross-origin mutations", () => {
    expect(() => assertSameOrigin(new Request("https://example.com/api/payments/order", { headers: { origin: "https://evil.example" } }))).toThrow("INVALID_ORIGIN");
  });
  it("handles the production proxy origin without trusting arbitrary forwarded hosts", async () => {
    const headers = { host: "growthoptplaybook.com", origin: "https://growthoptplaybook.com" };
    const proxied = new Request("https://localhost:8080/api/payments/order", { headers });
    expect(() => assertSameOrigin(proxied)).not.toThrow();
    const created = await createPaymentOrder(proxied);
    expect(created.cookie).toContain("; Secure");
    const redirected = redirectPaymentResult(new Request("https://localhost:8080/api/payments/failure", { headers }), true);
    expect(redirected.headers.get("Location")).toBe("https://growthoptplaybook.com/subscription?payment=failed#purchase");
    expect(() => assertSameOrigin(new Request(proxied.url, { headers: { ...headers, origin: "https://evil.example" } }))).toThrow("INVALID_ORIGIN");
    expect(() => assertSameOrigin(new Request(proxied.url, { headers: { host: "localhost:8080", "x-forwarded-host": "evil.example", origin: "https://evil.example" } }))).toThrow("INVALID_ORIGIN");
  });
  it("persists an order before payment and reuses its pending cookie", async () => {
    const { cookie, input } = await fixture();
    expect((await createPaymentOrder(request(cookie))).body.orderId).toBe(input.orderId);
    expect(db.rows.size).toBe(1);
    const row = db.rows.get(input.orderId);
    const token = cookie.split(".")[1];
    expect(row.access_hash).toBe(createHash("sha256").update(token).digest("hex"));
    expect(JSON.stringify(db.calls)).not.toContain(token);
  });
  it("rejects altered amounts and missing ownership before contacting Toss", async () => {
    const { cookie, input } = await fixture();
    await expect(confirmPayment(request(cookie), { ...input, amount: 1 })).rejects.toThrow("INVALID_ORDER");
    db.account = null;
    await expect(confirmPayment(request(), input)).rejects.toThrow("INVALID_ORDER");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("confirms an approved order idempotently and restores access across devices", async () => {
    const { cookie, input } = await fixture();
    const first = await confirmPayment(request(cookie), input);
    const second = await confirmPayment(request(cookie), input);
    expect(first.body.transaction).toEqual({ orderId: input.orderId, amount: 5900, productId: "report-pass-month-v1" });
    expect(second.body.transaction).toEqual(first.body.transaction);
    expect(second.body.entitlement.expiresAt).toBe(first.body.entitlement.expiresAt);
    expect(first.cookie).toContain("HttpOnly; SameSite=Lax"); expect(first.cookie).toContain("Secure");
    expect((await readPaymentAccess(request(), first.body.recoveryCode)).body.entitlement.plan).toBe("paid");
    expect(fetch.mock.calls.every(([, options]) => !options.method)).toBe(true);
  });
  it("uses the stored amount and idempotency key for a not-yet-approved payment", async () => {
    const { cookie, input } = await fixture();
    const approved = payment;
    fetch.mockImplementation(async (_url, options) => Response.json(options.method === "POST" ? approved : { ...approved, status: "IN_PROGRESS" }));
    await confirmPayment(request(cookie), input);
    const [, options] = fetch.mock.calls.find(([, options]) => options.method === "POST");
    expect(JSON.parse(options.body)).toEqual({ orderId: input.orderId, amount: 5900, paymentKey: input.paymentKey });
    expect(options.headers["Idempotency-Key"]).toBe(db.rows.get(input.orderId).idempotency_key);
  });
  it("revokes restored access after cancellation and does not revive terminal revocation", async () => {
    const { cookie, input } = await fixture();
    const result = await confirmPayment(request(cookie), input);
    payment.status = "CANCELED";
    expect((await readPaymentAccess(request(), result.body.recoveryCode)).body.entitlement).toBeNull();
    payment.status = "DONE";
    expect((await readPaymentAccess(request(), result.body.recoveryCode)).body.entitlement).toBeNull();
  });
  it("rejects a partial cancellation or a mismatched payment", () => {
    const order = { id: "one", payment_key: "key", amount: 5900 };
    const base = { orderId: "one", paymentKey: "key", totalAmount: 5900, currency: "KRW", status: "DONE", approvedAt: new Date().toISOString() };
    expect(verifiedPayment(base, order)).toBe(true);
    expect(verifiedPayment({ ...base, cancels: [{}] }, order)).toBe(false);
    expect(verifiedPayment({ ...base, orderId: "two" }, order)).toBe(false);
  });
  it("removes provider payment identifiers before reaching analytics-enabled pages", () => {
    const id = "gop_00000000-0000-0000-0000-000000000000";
    const response = redirectPaymentResult(new Request(`https://example.com/api/payments/return?locale=en&orderId=${id}&paymentKey=private-key&amount=5900`));
    expect(response.headers.get("location")).toBe("https://example.com/en/subscription?payment=confirm#purchase");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  });
});

it("blocks production test orders, confirmations and existing test access server-side", async () => {
  const { cookie, input } = await fixture();
  vi.stubEnv("NODE_ENV", "production");
  expect(paymentConfiguration()).toMatchObject({ enabled: false, clientKey: null, mode: "test" });
  db.calls.length = 0;
  await expect(createPaymentOrder(request())).rejects.toThrow("PAYMENTS_NOT_CONFIGURED");
  await expect(confirmPayment(request(cookie), input)).rejects.toThrow("PAYMENTS_NOT_CONFIGURED");
  expect((await readPaymentAccess(request(cookie))).body.entitlement).toBeNull();
  expect(db.calls).toHaveLength(0);
  expect(fetch).not.toHaveBeenCalled();
});

it("keeps deposit ownership beyond the pending cookie without granting Pro before deposit", async () => {
  const { cookie, input } = await fixture();
  payment.status = "WAITING_FOR_DEPOSIT";
  const waiting = await confirmPayment(request(cookie), input);
  expect(waiting.body).toEqual({ entitlement: null, status: "waiting_for_deposit", orderId: input.orderId });
  expect(waiting.cookie).toContain("gop_payment_access=");
  const accessCookie = waiting.cookie.split(";")[0];
  expect((await readPaymentAccess(request(accessCookie))).body.entitlement).toBeNull();
  await expect(createPaymentOrder(request(accessCookie))).rejects.toThrow("PAYMENT_PENDING");
  payment.status = "DONE";
  expect((await readPaymentAccess(request(accessCookie))).body.entitlement.plan).toBe("paid");
});

it("uses the linked account to confirm and recover when the payment cookie is absent", async () => {
  db.account = { id: "verified-owner" };
  const { input } = await fixture();
  expect(db.rows.get(input.orderId).account_id).toBe("verified-owner");
  expect((await confirmPayment(request(), input)).body.entitlement.plan).toBe("paid");
  const recovered = await readPaymentAccess(request());
  expect(recovered.body.entitlement).toMatchObject({ plan: "paid", account: true, payment: false });
  expect(recovered.body.recoveryCode).toBeUndefined();
  db.account = { id: "another-owner" };
  await expect(confirmPayment(request(), input)).rejects.toThrow("INVALID_ORDER");
  expect((await readPaymentAccess(request())).body.entitlement).toBeNull();
});
it("reuses recent verification and never extends its outage allowance or actual expiry", async () => {
  const { cookie, input } = await fixture();
  const result = await confirmPayment(request(cookie), input);
  const row = db.rows.get(input.orderId);
  row.verified_at = new Date().toISOString();
  fetch.mockClear();
  expect((await readPaymentAccess(request(result.cookie.split(";")[0]))).body.entitlement.plan).toBe("paid");
  expect(fetch).not.toHaveBeenCalled();
  row.verified_at = new Date(Date.now() - 3600000).toISOString();
  fetch.mockRejectedValue(new Error("provider unavailable"));
  const cached = await readPaymentAccess(request(), result.body.recoveryCode);
  expect(cached.body.entitlement.offlineUntil).toBe(Date.parse(row.verified_at) + 72 * 3600000);
  row.expires_at = new Date(Date.now() - 1).toISOString();
  await expect(readPaymentAccess(request(), result.body.recoveryCode)).rejects.toThrow("provider unavailable");
});

it("releases the transaction before HTTP and rejects revocation during HTTP", async () => {
  const { cookie, input } = await fixture();
  fetch.mockImplementation(async () => {
    expect(db.calls.at(-1).sql).toBe("COMMIT");
    expect(db.active).toBe(0);
    db.rows.get(input.orderId).status = "revoked";
    return Response.json(payment);
  });
  await expect(confirmPayment(request(cookie), input)).rejects.toThrow("INVALID_ORDER");
  expect(db.rows.get(input.orderId).status).toBe("revoked");
});
it("clears the payment return cookie after successful confirmation", async () => {
  const { cookie, input } = await fixture();
  const response = paymentResponse(await confirmPayment(request(cookie), input));
  expect(response.headers.getSetCookie()).toHaveLength(2);
  expect(response.headers.getSetCookie()[1]).toContain("gop_payment_return=;");
  expect(response.headers.getSetCookie()[1]).toContain("Max-Age=0");
});

it("does not activate a credential replaced while the provider request runs", async () => {
  const { cookie, input } = await fixture();
  fetch.mockImplementation(async () => {
    db.rows.get(input.orderId).access_hash = "b".repeat(64);
    return Response.json(payment);
  });
  await expect(confirmPayment(request(cookie), input)).rejects.toThrow("INVALID_ORDER");
  expect(db.rows.get(input.orderId).status).toBe("pending");
});

it("adds one month after the existing expiry without charging away unused days", async () => {
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-09-01T03:00:00Z"));
  const first = await fixture();
  const access = await confirmPayment(request(first.cookie), first.input);
  vi.setSystemTime(new Date("2026-09-21T03:00:00Z"));
  const second = await fixture();
  const renewed = await confirmPayment(request(second.cookie), second.input);
  expect(access.body.entitlement.expiresAt).toBe(Date.parse("2026-10-01T03:00:00Z"));
  expect(renewed.body.entitlement.expiresAt).toBe(Date.parse("2026-11-01T03:00:00Z"));
  expect(db.rows.get(second.input.orderId).starts_at).toBe("2026-10-01T03:00:00.000Z");
  expect((await confirmPayment(request(second.cookie), second.input)).body.entitlement.expiresAt).toBe(renewed.body.entitlement.expiresAt);
  expect(db.calls.some(call => call.sql.includes("pg_advisory_xact_lock"))).toBe(true);
});
it("starts expired renewals at approval and preserves an active first-save trial", async () => {
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-09-01T03:00:00Z"));
  const first = await fixture(); await confirmPayment(request(first.cookie), first.input);
  vi.setSystemTime(new Date("2026-10-11T03:00:00Z"));
  const second = await fixture();
  expect((await confirmPayment(request(second.cookie), second.input)).body.entitlement.expiresAt).toBe(Date.parse("2026-11-11T03:00:00Z"));
  db.rows.clear(); db.account.trial_started_at = new Date().toISOString();
  const trial = await fixture();
  expect((await confirmPayment(request(trial.cookie), trial.input)).body.entitlement.expiresAt).toBe(Date.parse("2026-11-25T03:00:00Z"));
});
it("blocks anonymous new orders even when account rollout is disabled", async () => {
  db.account = null; vi.stubEnv("ACCOUNTS_ENABLED", "false");
  expect(paymentConfiguration().requiresAccount).toBe(true);
  await expect(createPaymentOrder(request())).rejects.toThrow("LOGIN_REQUIRED");
  expect(db.calls).toHaveLength(0);
});
it("does not restore a recovery token replaced during provider lookup", async () => {
  const { cookie, input } = await fixture();
  const approved = await confirmPayment(request(cookie), input);
  fetch.mockImplementation(async () => { db.rows.get(input.orderId).access_hash = "b".repeat(64); return Response.json(payment); });
  expect((await readPaymentAccess(request(), approved.body.recoveryCode)).body.entitlement).toBeNull();
});
it("does not downgrade a committed deposit when an older waiting lookup arrives late", async () => {
  const { cookie, input } = await fixture();
  const approved = await confirmPayment(request(cookie), input);
  db.rows.get(input.orderId).verified_at = new Date().toISOString();
  payment.status = "WAITING_FOR_DEPOSIT";
  const restored = await readPaymentAccess(request(), approved.body.recoveryCode);
  expect(db.rows.get(input.orderId).status).toBe("paid");
  expect(restored.body.entitlement.plan).toBe("paid");
  expect(restored.body.status).toBeUndefined();
});
