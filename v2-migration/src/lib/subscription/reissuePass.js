import { createHash, randomBytes } from "node:crypto";
import { verifiedPayment } from "./paymentVerification.js";

// Operator-only helper, never imported into an HTTP route. Ownership proof must
// be reviewed outside this command; order ID knowledge is not authorization.
export async function reissuePass({ db, orderId, mode, fetchPayment, writeSecret, removeSecret, verifiedCase, now = Date.now() }) {
  if (!/^gop_[a-f0-9-]{36}$/.test(orderId || "") || !/^[A-Za-z0-9_-]{3,80}$/.test(verifiedCase || "")) throw new Error("INVALID_VERIFIED_CASE");
  const { rows } = await db.query("SELECT * FROM gop_payment_orders WHERE id=$1", [orderId]);
  const order = rows[0];
  if (!order || order.mode !== mode || order.status !== "paid" || (!Number.isFinite(Date.parse(order.expires_at)) || Date.parse(order.expires_at) <= now) || !order.payment_key) throw new Error("PASS_NOT_ACTIVE");
  const payment = await fetchPayment(order.payment_key);
  if (!verifiedPayment(payment, order)) throw new Error("PAYMENT_NOT_VERIFIED");
  const token = randomBytes(32).toString("hex");
  const digest = createHash("sha256").update(token).digest("hex");
  // Write exclusively before changing the credential: a full disk must not lock
  // the purchaser out. On a concurrent change, remove only our newly made file.
  await writeSecret(`${orderId}.${token}`);
  const result = await db.query("UPDATE gop_payment_orders SET access_hash=$2 WHERE id=$1 AND access_hash=$3 AND status='paid' AND mode=$4 AND expires_at>NOW()", [orderId, digest, order.access_hash, mode]);
  // A network error can follow a committed UPDATE. Keep the secret file in that
  // ambiguous case; remove it only when the database confirms no row changed.
  if (result.rowCount !== 1) { await removeSecret(); throw new Error("PASS_CHANGED"); }
  return { orderId, expiresAt: order.expires_at, verifiedCase };
}
