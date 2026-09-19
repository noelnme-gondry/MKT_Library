import { afterEach, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { readNicepayPayment } from "./nicepayServer";
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
function setup(mode) {
  vi.stubEnv("NICEPAY_APPROVAL_MODEL", "server-basic");
  vi.stubEnv("NICEPAY_CLIENT_KEY", "fixture-client");
  vi.stubEnv("NICEPAY_SECRET_KEY", "fixture-secret");
  vi.stubEnv("NICEPAY_MODE", mode);
  const order = { id: "gop_fixture", payment_key: "fixture-tid", amount: 5900, mode };
  const data = { resultCode: "0000", orderId: order.id, tid: order.payment_key, amount: 5900, balanceAmt: 5900, currency: "KRW", payMethod: "card", status: "paid", ediDate: "2026-09-19T00:00:00+0900", paidAt: "2026-09-19T00:00:00+0900" };
  data.signature = createHash("sha256").update(`${data.tid}${data.amount}${data.ediDate}fixture-secret`).digest("hex");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => data }));
  return order;
}
it.each([["test", "sandbox-api.nicepay.co.kr"], ["live", "api.nicepay.co.kr"]])("uses the documented %s API host", async (mode, host) => {
  const order = setup(mode);
  expect((await readNicepayPayment(order)).status).toBe("DONE");
  expect(fetch.mock.calls[0][0]).toBe(`https://${host}/v1/payments/fixture-tid`);
});
it("does not query a live order with sandbox credentials", async () => {
  const order = setup("test");
  order.mode = "live";
  await expect(readNicepayPayment(order)).rejects.toThrow("PAYMENT_MISMATCH");
  expect(fetch).not.toHaveBeenCalled();
});
