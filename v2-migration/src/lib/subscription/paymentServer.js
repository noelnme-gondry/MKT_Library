import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import pg from "pg";
import { SITE_URL } from "@/lib/routeMap";
import { PAYMENT_PRODUCT, passExpiresAt, verifiedPayment } from "./paymentProduct";
import { readAccount, accountsEnabled } from "@/lib/account/accountServer";
import { SUBSCRIPTION } from "./entitlement";

let pool;
const cookieName = "gop_payment_access";
const pendingName = "gop_payment_pending";
const hash = value => createHash("sha256").update(value).digest("hex");
const tokenPattern = /^[a-f0-9]{64}$/;
const idPattern = /^gop_[a-f0-9-]{36}$/;
function cachedPaymentEntitlement(order, now = Date.now()) {
  const expiresAt = new Date(order.expires_at).getTime(), verifiedAt = new Date(order.verified_at).getTime();
  const offlineUntil = Math.min(expiresAt, verifiedAt + SUBSCRIPTION.graceMs);
  return order.status === "paid" && verifiedAt <= now && offlineUntil > now ? { plan: "paid", expiresAt, verifiedAt, offlineUntil, payment: true, offline: true } : null;
}
export function paymentConfiguration() {
  const clientKey = process.env.TOSS_CLIENT_KEY || "";
  const secret = process.env.TOSS_SECRET_KEY || "";
  const mode = clientKey.startsWith("live_") ? "live" : "test";
  const configured = /^(test|live)_gck_/.test(clientKey)
    && secret.startsWith(`${mode}_gsk_`) && Boolean(process.env.PAYMENTS_DATABASE_URL)
    && (mode !== "live" || process.env.PAYMENTS_LIVE_ENABLED === "true")
    && (mode !== "test" || process.env.NODE_ENV !== "production");
  return { enabled: configured, clientKey: configured ? clientKey : null, mode, product: PAYMENT_PRODUCT, requiresAccount: true, accountAvailable: accountsEnabled() };
}
function database() {
  if (!paymentConfiguration().enabled) throw new Error("PAYMENTS_NOT_CONFIGURED");
  pool ||= new pg.Pool({ connectionString: process.env.PAYMENTS_DATABASE_URL, max: 4, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000 });
  return pool;
}
function cookies(request) {
  return Object.fromEntries((request.headers.get("cookie") || "").split(";").map(part => part.trim().split("=")).filter(pair => pair.length === 2));
}
function credentials(value) {
  const [id, token] = (value || "").split(".");
  return idPattern.test(id || "") && tokenPattern.test(token || "") ? { id, token } : null;
}
function owns(order, token) {
  return order && tokenPattern.test(order.access_hash) && timingSafeEqual(Buffer.from(order.access_hash, "hex"), Buffer.from(hash(token), "hex"));
}
function paymentOrigin(request) {
  // Railway/Next may construct request.url using localhost even for the public site.
  // Only recognize our canonical host; never turn arbitrary forwarded hosts into trusted origins.
  const canonical = new URL(SITE_URL);
  if ([request.headers.get("host"), request.headers.get("x-forwarded-host")].includes(canonical.host)) return canonical.origin;
  return new URL(request.url).origin;
}
function cookie(name, value, request, maxAge = 34560000) {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${new URL(paymentOrigin(request)).protocol === "https:" ? "; Secure" : ""}`;
}
export function assertSameOrigin(request) {
  if (request.headers.get("origin") !== paymentOrigin(request)) throw new Error("INVALID_ORIGIN");
}
async function toss(path, options = {}) {
  const response = await fetch(`https://api.tosspayments.com/v1/payments${path}`, {
    ...options, headers: { Authorization: `Basic ${Buffer.from(`${process.env.TOSS_SECRET_KEY}:`).toString("base64")}`, "Content-Type": "application/json", ...options.headers }, signal: AbortSignal.timeout(15000), cache: "no-store",
  });
  if (!response.ok) throw new Error("PAYMENT_VERIFICATION_FAILED");
  return response.json();
}
async function syncOrder(client, order, payment) {
  if (payment.orderId !== order.id || payment.paymentKey !== order.payment_key || payment.totalAmount !== order.amount || payment.currency !== "KRW") throw new Error("PAYMENT_MISMATCH");
  if (verifiedPayment(payment, order)) {
    // All callers hold a transaction/order lock. Serialize first allocations across
    // different orders belonging to the same account, without holding locks over HTTP.
    if (order.account_id) await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [order.account_id]);
    let startsAt = order.starts_at || order.approved_at || payment.approvedAt;
    let expiresAt = order.expires_at;
    if (!expiresAt) {
      if (order.account_id) {
        const { rows } = await client.query("SELECT GREATEST($3::timestamptz, trial_started_at+INTERVAL '14 days', gop_paid_until(id,$2,$3::timestamptz)) AS starts_at FROM gop_accounts WHERE id=$1", [order.account_id, order.mode, payment.approvedAt]);
        if (!rows[0]) throw new Error("INVALID_ORDER");
        startsAt = rows[0].starts_at;
      }
      expiresAt = passExpiresAt(startsAt);
    }
    const updated = await client.query("UPDATE gop_payment_orders SET status='paid', approved_at=$2, expires_at=$3, starts_at=$4, verified_at=NOW() WHERE id=$1 AND status <> 'revoked'", [order.id, payment.approvedAt, expiresAt, startsAt]);
    if (!updated.rowCount) return null;
    return { plan: "paid", expiresAt: new Date(expiresAt).getTime(), verifiedAt: Date.now(), offlineUntil: Math.min(new Date(expiresAt).getTime(), Date.now() + SUBSCRIPTION.graceMs), payment: true };
  }
  if (["CANCELED", "PARTIAL_CANCELED", "ABORTED", "EXPIRED"].includes(payment.status) || payment.cancels?.length) await client.query("UPDATE gop_payment_orders SET status='revoked', verified_at=NOW() WHERE id=$1", [order.id]);
  if (payment.status === "WAITING_FOR_DEPOSIT") await client.query("UPDATE gop_payment_orders SET status='pending', verified_at=NOW() WHERE id=$1 AND status <> 'revoked'", [order.id]);
  return null;
}
async function syncExternalOrder(order, payment) {
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    const latest = (await client.query("SELECT * FROM gop_payment_orders WHERE id=$1 FOR UPDATE", [order.id])).rows[0];
    if (!latest || latest.status === "revoked") { await client.query("COMMIT"); return null; }
    const result = await syncOrder(client, latest, payment);
    await client.query("COMMIT");
    return result;
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
async function accountCoverage(order, entitlement) {
  if (!entitlement || !order.account_id) return entitlement;
  const { rows } = await database().query("SELECT gop_paid_until($1,$2,NOW()) AS paid_until", [order.account_id, order.mode]);
  const expiresAt = new Date(rows[0]?.paid_until).getTime();
  return expiresAt > Date.now() ? { ...entitlement, expiresAt, offlineUntil: Math.min(expiresAt, entitlement.offlineUntil) } : null;
}
export async function createPaymentOrder(request) {
  assertSameOrigin(request);
  if (!paymentConfiguration().enabled) throw new Error("PAYMENTS_NOT_CONFIGURED");
  const account = await readAccount(request);
  if (!account) throw new Error("LOGIN_REQUIRED");
  const current = credentials(cookies(request)[cookieName]);
  if (current) {
    const { rows } = await database().query("SELECT * FROM gop_payment_orders WHERE id=$1", [current.id]);
    if (owns(rows[0], current.token) && rows[0].status === "pending" && rows[0].payment_key) throw new Error("PAYMENT_PENDING");
    if (owns(rows[0], current.token) && rows[0].status === "paid" && !rows[0].account_id && new Date(rows[0].expires_at).getTime() > Date.now()) throw new Error("LINK_PURCHASE_FIRST");
  }
  // A pending order is reused briefly, preventing double-clicks from creating duplicate purchases.
  const previous = credentials(cookies(request)[pendingName]);
  if (previous) {
    const { rows } = await database().query("SELECT * FROM gop_payment_orders WHERE id=$1", [previous.id]);
    const order = rows[0];
    if (owns(order, previous.token) && order.status === "pending" && order.payment_key) throw new Error("PAYMENT_PENDING");
    if (owns(order, previous.token) && order.status === "pending" && (!account || !order.account_id || order.account_id === account.id) && Date.now() - new Date(order.created_at).getTime() < 20 * 60000) {
      if (account) {
        const linked = await database().query("UPDATE gop_payment_orders SET account_id=$2 WHERE id=$1 AND (account_id IS NULL OR account_id=$2)", [order.id, account.id]);
        if (!linked.rowCount) throw new Error("INVALID_ORDER");
      }
      return { body: { orderId: order.id, amount: order.amount, orderName: PAYMENT_PRODUCT.name, customerKey: order.id, ...(account ? { accountId: account.id } : {}) } };
    }
  }
  const pending = await database().query("SELECT id FROM gop_payment_orders WHERE account_id=$1 AND mode=$2 AND status='pending' AND payment_key IS NOT NULL LIMIT 1", [account.id, paymentConfiguration().mode]);
  if (pending.rows.length) throw new Error("PAYMENT_PENDING");
  const id = `gop_${randomUUID()}`, token = randomBytes(32).toString("hex");
  await database().query("INSERT INTO gop_payment_orders(id,access_hash,amount,product_id,idempotency_key,mode,account_id) VALUES($1,$2,$3,$4,$5,$6,$7)", [id, hash(token), PAYMENT_PRODUCT.amount, PAYMENT_PRODUCT.id, randomUUID(), paymentConfiguration().mode, account.id]);
  return { body: { orderId: id, amount: PAYMENT_PRODUCT.amount, orderName: PAYMENT_PRODUCT.name, customerKey: id, ...(account ? { accountId: account.id } : {}) }, cookie: cookie(pendingName, `${id}.${token}`, request, 86400) };
}
export async function confirmPayment(request, input) {
  assertSameOrigin(request);
  if (!paymentConfiguration().enabled) throw new Error("PAYMENTS_NOT_CONFIGURED");
  if (!input?.orderId) {
    try { input = JSON.parse(Buffer.from(cookies(request).gop_payment_return || "", "base64url").toString()); } catch { throw new Error("INVALID_ORDER"); }
  }
  const credential = credentials(cookies(request)[pendingName]);
  const account = credential ? null : await readAccount(request);
  if ((!credential && !account) || (credential && credential.id !== input.orderId) || !idPattern.test(input.orderId || "") || !Number.isSafeInteger(input.amount) || typeof input.paymentKey !== "string" || input.paymentKey.length > 300) throw new Error("INVALID_ORDER");
  const authorized = order => credential ? owns(order, credential.token) : order?.account_id === account?.id;
  let client = await database().connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query("SELECT * FROM gop_payment_orders WHERE id=$1 FOR UPDATE", [input.orderId]);
    const order = rows[0];
    if (!authorized(order) || order.amount !== input.amount || order.mode !== paymentConfiguration().mode || order.status === "revoked" || (order.payment_key && order.payment_key !== input.paymentKey)) throw new Error("INVALID_ORDER");
    await client.query("UPDATE gop_payment_orders SET payment_key=$2 WHERE id=$1", [order.id, input.paymentKey]);
    await client.query("COMMIT");
    client.release();
    client = null;
    order.payment_key = input.paymentKey;
    // No database connection or row lock is held during provider HTTP.
    // Confirm retries use the same persisted idempotency key. A lost response must not charge twice.
    let payment;
    try { payment = await toss(`/${encodeURIComponent(input.paymentKey)}`); } catch { /* Not yet approved; confirm below. */ }
    if (!payment || payment.status === "READY" || payment.status === "IN_PROGRESS") payment = await toss("/confirm", { method: "POST", headers: { "Idempotency-Key": order.idempotency_key }, body: JSON.stringify({ paymentKey: input.paymentKey, orderId: order.id, amount: order.amount }) });
    client = await database().connect();
    await client.query("BEGIN");
    const latest = (await client.query("SELECT * FROM gop_payment_orders WHERE id=$1 FOR UPDATE", [order.id])).rows[0];
    if (!authorized(latest) || latest.status === "revoked" || latest.payment_key !== input.paymentKey || latest.amount !== input.amount || latest.mode !== order.mode) throw new Error("INVALID_ORDER");
    let entitlement = await syncOrder(client, latest, payment);
    if (payment.status === "WAITING_FOR_DEPOSIT") {
      await client.query("COMMIT");
      // This is an ownership credential, not a paid entitlement. Keep it for delayed deposits.
      return { body: { entitlement: null, status: "waiting_for_deposit", orderId: order.id }, ...(credential ? { cookie: cookie(cookieName, `${credential.id}.${credential.token}`, request) } : {}), clearReturn: true };
    }
    if (!entitlement || entitlement.expiresAt <= Date.now()) throw new Error("PAYMENT_NOT_COMPLETED");
    await client.query("COMMIT");
    client.release(); client = null;
    entitlement = await accountCoverage(latest, entitlement);
    return { body: { entitlement: !entitlement ? null : credential ? entitlement : { ...entitlement, account: true, payment: false }, ...(!entitlement ? { status: "scheduled" } : {}), mode: order.mode, transaction: { orderId: order.id, amount: order.amount, productId: order.product_id }, ...(credential ? { recoveryCode: `${credential.id}.${credential.token}` } : {}) }, ...(credential ? { cookie: cookie(cookieName, `${credential.id}.${credential.token}`, request) } : {}), clearReturn: true };
  } catch (error) { if (client) await client.query("ROLLBACK"); throw error; }
  finally { client?.release(); }
}
export async function readPaymentAccess(request, recoveryCode) {
  if (recoveryCode !== undefined) assertSameOrigin(request);
  if (paymentConfiguration().mode === "test" && process.env.NODE_ENV === "production") return { body: { entitlement: null } };
  let credential = credentials(recoveryCode ?? cookies(request)[cookieName]);
  const suppliedCredential = credential;
  // A logged-in owner can recover an account-linked order without a payment cookie.
  // An explicitly supplied invalid recovery code must never fall back to another identity.
  const account = recoveryCode === undefined ? await readAccount(request) : null;
  // A signed-in account is the source of truth, including a renewal awaiting deposit.
  // Keep the token only for an unlinked legacy pass or this account's matching order.
  if (account && credential) {
    const owned = (await database().query("SELECT * FROM gop_payment_orders WHERE id=$1", [credential.id])).rows[0];
    if (owned?.account_id) credential = null;
  }
  if (!credential && !account) return { body: { entitlement: null } };
  const { rows } = credential ? await database().query("SELECT * FROM gop_payment_orders WHERE id=$1", [credential.id]) : await database().query("SELECT * FROM gop_payment_orders WHERE account_id=$1 AND mode=$2 AND status IN ('paid','pending') AND payment_key IS NOT NULL ORDER BY (status='pending') DESC, expires_at DESC NULLS LAST, created_at DESC LIMIT 1", [account.id, paymentConfiguration().mode]);
  const order = rows[0];
  if (!credential && suppliedCredential && order && suppliedCredential.id === order.id && owns(order, suppliedCredential.token)) credential = suppliedCredential;
  if (!(credential ? owns(order, credential.token) : order && order.account_id === account.id) || order.mode !== paymentConfiguration().mode || !["pending", "paid"].includes(order.status) || !order.payment_key) return { body: { entitlement: null } };
  const cached = cachedPaymentEntitlement(order);
  let payment, entitlement;
  if (recoveryCode === undefined && cached && Date.now() - cached.verifiedAt < 300000) entitlement = { ...cached, offline: false };
  else {
    try { payment = await toss(`/${encodeURIComponent(order.payment_key)}`); }
    catch (error) { if (!cached) throw error; entitlement = cached; }
    // A confirmed cancellation/mismatch must never fall back to a cached entitlement.
    if (payment) entitlement = await syncExternalOrder(order, payment);
  }
  entitlement = await accountCoverage(order, entitlement);
  const active = entitlement?.expiresAt > Date.now();
  return { body: { entitlement: active ? (credential ? entitlement : { ...entitlement, account: true, payment: false }) : null, ...(payment?.status === "WAITING_FOR_DEPOSIT" ? { status: "waiting_for_deposit", orderId: order.id } : {}), ...(active ? { mode: order.mode, transaction: { orderId: order.id, amount: order.amount, productId: order.product_id } } : {}), ...(active && credential ? { recoveryCode: `${credential.id}.${credential.token}` } : {}) }, ...(recoveryCode && active ? { cookie: cookie(cookieName, recoveryCode, request) } : {}) };
}
export async function reconcilePaymentWebhook(input) {
  const id = input?.data?.orderId;
  if (!idPattern.test(id || "")) return;
  const { rows } = await database().query("SELECT * FROM gop_payment_orders WHERE id=$1", [id]);
  const order = rows[0];
  if (!order?.payment_key) return;
  // Webhook payload is untrusted: fetch authoritative status from Toss before changing access.
  await syncExternalOrder(order, await toss(`/${encodeURIComponent(order.payment_key)}`));
}
export function paymentResponse(result) {
  const headers = new Headers({ "Cache-Control": "no-store" });
  if (result.cookie) headers.append("Set-Cookie", result.cookie);
  if (result.clearReturn) headers.append("Set-Cookie", "gop_payment_return=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
  return Response.json(result.body, { headers });
}
export function paymentError(error) {
  const statuses = { LOGIN_REQUIRED: 401, INVALID_ORIGIN: 403, INVALID_ORDER: 400, LINK_PURCHASE_FIRST: 409, PAYMENT_PENDING: 409, PAYMENT_NOT_COMPLETED: 409, PAYMENT_MISMATCH: 409, PAYMENTS_NOT_CONFIGURED: 503 };
  const code = Object.hasOwn(statuses, error?.message) ? error.message : "PAYMENT_UNAVAILABLE";
  console.error("payment_request_failed", { code });
  return Response.json({ error: code }, { status: statuses[code] || 503, headers: { "Cache-Control": "no-store" } });
}

export function redirectPaymentResult(request, failed = false) {
  const url = new URL(request.url);
  const origin = paymentOrigin(request);
  const locale = url.searchParams.get("locale") === "en" ? "/en" : "";
  const cancelled = failed && ["PAY_PROCESS_CANCELED", "USER_CANCEL"].includes(url.searchParams.get("code"));
  const target = new URL(`${locale}/subscription?payment=${failed ? (cancelled ? "cancelled" : "failed") : "confirm"}#purchase`, origin);
  const headers = { Location: target.href, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
  if (!failed) {
    const input = { orderId: url.searchParams.get("orderId"), paymentKey: url.searchParams.get("paymentKey"), amount: Number(url.searchParams.get("amount")) };
    if (!idPattern.test(input.orderId || "") || !input.paymentKey || input.paymentKey.length > 300 || !Number.isSafeInteger(input.amount)) return new Response(null, { status: 303, headers: { ...headers, Location: new URL(`${locale}/subscription?payment=failed#purchase`, origin).href } });
    headers["Set-Cookie"] = cookie("gop_payment_return", Buffer.from(JSON.stringify(input)).toString("base64url"), request, 86400);
  }
  return new Response(null, { status: 303, headers });
}
