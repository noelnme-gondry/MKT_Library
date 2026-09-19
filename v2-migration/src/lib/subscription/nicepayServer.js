import { createHash, timingSafeEqual } from "node:crypto";

// Server approval + Basic authentication only. Keys must be issued for this model.
export function nicepayConfigured() {
  return process.env.NICEPAY_APPROVAL_MODEL === "server-basic"
    && ["test", "live"].includes(process.env.NICEPAY_MODE)
    && Boolean(process.env.NICEPAY_CLIENT_KEY && process.env.NICEPAY_SECRET_KEY);
}
const digest = value => createHash("sha256").update(value).digest("hex");
function matches(signature, value) {
  return typeof signature === "string" && /^[a-fA-F0-9]{64}$/.test(signature)
    && timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(digest(value), "hex"));
}
export function verifyNicepayAuthentication(input) {
  const secret = process.env.NICEPAY_SECRET_KEY;
  if (!nicepayConfigured() || input?.authResultCode !== "0000"
    || input.clientId !== process.env.NICEPAY_CLIENT_KEY
    || !/^[a-zA-Z0-9]{30}$/.test(input.tid || "")
    || !/^gop_[a-f0-9-]{36}$/.test(input.orderId || "")
    || !Number.isSafeInteger(input.amount) || input.amount <= 0
    || typeof input.authToken !== "string" || input.authToken.length !== 40
    || !matches(input.signature, `${input.authToken}${input.clientId}${input.amount}${secret}`)) throw new Error("INVALID_ORDER");
  return input;
}
async function nicepay(path, body) {
  if (!nicepayConfigured()) throw new Error("PAYMENTS_NOT_CONFIGURED");
  const host = process.env.NICEPAY_MODE === "test" ? "sandbox-api.nicepay.co.kr" : "api.nicepay.co.kr";
  const response = await fetch(`https://${host}/v1/payments${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", Authorization: `Basic ${Buffer.from(`${process.env.NICEPAY_CLIENT_KEY}:${process.env.NICEPAY_SECRET_KEY}`).toString("base64")}` },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(15000), cache: "no-store",
  });
  if (!response.ok) throw new Error("PAYMENT_VERIFICATION_FAILED");
  const data = await response.json();
  if (data?.resultCode !== "0000") throw new Error("PAYMENT_VERIFICATION_FAILED");
  return data;
}
export function normalizeNicepayPayment(data, order) {
  if (data.orderId !== order.id || data.tid !== order.payment_key || data.amount !== order.amount || data.currency !== "KRW"
    || !matches(data.signature, `${data.tid}${data.amount}${data.ediDate}${process.env.NICEPAY_SECRET_KEY}`)) throw new Error("PAYMENT_MISMATCH");
  const statuses = { paid: "DONE", ready: "READY", failed: "ABORTED", cancelled: "CANCELED", partialCancelled: "PARTIAL_CANCELED", expired: "EXPIRED" };
  if (!statuses[data.status] || (data.status === "paid" && (data.balanceAmt !== order.amount || data.payMethod !== "card"))) throw new Error("PAYMENT_MISMATCH");
  return { orderId: data.orderId, paymentKey: data.tid, totalAmount: data.amount, currency: data.currency,
    status: statuses[data.status], approvedAt: data.paidAt, cancels: data.cancels };
}
export async function readNicepayPayment(order) {
  if (order.mode !== process.env.NICEPAY_MODE) throw new Error("PAYMENT_MISMATCH");
  return normalizeNicepayPayment(await nicepay(`/${encodeURIComponent(order.payment_key)}`), order);
}
export async function approveNicepayPayment(order, input, alreadySubmitted = false) {
  verifyNicepayAuthentication(input);
  if (order.mode !== process.env.NICEPAY_MODE || input.orderId !== order.id || input.tid !== order.payment_key || input.amount !== order.amount) throw new Error("INVALID_ORDER");
  // A persisted attempt is never blindly approved again after an uncertain response.
  // Its authoritative status (or an operator reconciliation) must resolve it first.
  if (alreadySubmitted) return readNicepayPayment(order);
  let data;
  try { data = await nicepay(`/${encodeURIComponent(order.payment_key)}`, { amount: order.amount }); }
  catch (error) {
    if (["TimeoutError", "AbortError", "TypeError"].includes(error.name)) {
      // NICEPAY requires network cancellation after an approval read timeout.
      // Failure here is intentionally unresolved; never grant access on uncertainty.
      try { await nicepay("/netcancel", { orderId: order.id }); } catch { /* Reconcile via authoritative lookup. */ }
    }
    throw error;
  }
  return normalizeNicepayPayment(data, order);
}
