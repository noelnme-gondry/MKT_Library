import { createHmac, randomBytes } from "node:crypto";
import { isIP } from "node:net";
// Railway's edge supplies X-Real-IP. Never trust arbitrary X-Forwarded-For.
// Keep only process-salted identifiers for one minute; no IPs are logged/stored.
// Replica-wide abuse protection still belongs at the trusted edge.
const salt = randomBytes(32);
const windows = new Map();
function bucket(key, now) {
  const old = windows.get(key);
  const value = old && now - old.at < 60000 ? old : { at: now, count: 0 };
  windows.set(key, value);
  return value;
}
export function admitPaymentRequest(scope, request, now = Date.now()) {
  for (const [key, value] of windows) if (now - value.at >= 60000) windows.delete(key);
  const ip = process.env.RAILWAY_ENVIRONMENT_ID ? request?.headers.get("x-real-ip") : null;
  const identity = ip && isIP(ip) ? createHmac("sha256", salt).update(ip).digest("hex") : "unknown-proxy";
  const global = bucket(`global:${scope}`, now);
  const perClient = scope === "order" ? 30 : 120;
  const total = scope === "order" ? 600 : 2400;
  if (global.count >= total) return false;
  const local = bucket(`${scope}:${identity}`, now);
  // Rejected retries do not consume other clients' shared allowance.
  if (local.count >= perClient || global.count >= total) return false;
  local.count++; global.count++;
  return true;
}
export function paymentLimitResponse() {
  return Response.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": "60", "Cache-Control": "no-store" } });
}
