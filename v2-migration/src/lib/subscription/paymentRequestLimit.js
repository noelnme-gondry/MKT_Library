// Per-process admission limit, shared by anonymous callers. No IP or secret storage.
// Multi-replica deployments additionally need a shared gateway limit.
const windows = new Map();
export function admitPaymentRequest(scope, now = Date.now()) {
  const limit = scope === "order" ? 30 : 120;
  const previous = windows.get(scope);
  const current = previous && now - previous.at < 60000 ? previous : { at: now, count: 0 };
  windows.set(scope, current);
  current.count += 1;
  return current.count <= limit;
}
export function paymentLimitResponse() {
  return Response.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": "60", "Cache-Control": "no-store" } });
}
