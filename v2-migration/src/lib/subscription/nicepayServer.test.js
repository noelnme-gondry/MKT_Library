import { afterEach, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { readNicepayPayment, normalizeNicepayPayment } from "./nicepayServer";
import { configuredNicepayMethods, nicepayMethodOptions } from "./nicepayMethods";
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
it.each(["vbank", "naverpay", "kakaopay", "cellphone"])("accepts a verified paid %s transaction", async payMethod => {
  const order = setup("test");
  const data = await (await fetch()).json();
  expect(normalizeNicepayPayment({ ...data, payMethod }, order).status).toBe("DONE");
  expect(() => normalizeNicepayPayment({ ...data, payMethod, amount: 1 }, order)).toThrow("PAYMENT_MISMATCH");
});
it("does not grant a pass for a virtual account issued before deposit", async () => {
  const order = setup("test");
  const data = await (await fetch()).json();
  const vbank = { vbankName: "Fixture bank", vbankNumber: "123456", vbankHolder: "Fixture", vbankExpDate: "2026-09-21T12:00:00+09:00" };
  const result = normalizeNicepayPayment({ ...data, status: "ready", payMethod: "vbank", paidAt: "0", vbank }, order);
  expect(result.status).toBe("WAITING_FOR_DEPOSIT");
  expect(result.deposit).toEqual({ bank: vbank.vbankName, number: vbank.vbankNumber, holder: vbank.vbankHolder, expiresAt: vbank.vbankExpDate, amount: 5900 });
  expect(normalizeNicepayPayment({ ...data, status: "expired", payMethod: "vbank" }, order).status).toBe("EXPIRED");
});
it("only advertises configured methods and adds required method fields", () => {
  expect(configuredNicepayMethods()).toEqual(["card"]);
  expect(configuredNicepayMethods("card, cellphone,unknown,card")).toEqual(["card", "cellphone"]);
  expect(configuredNicepayMethods("")).toEqual([]);
  expect(nicepayMethodOptions("cellphone")).toEqual({ method: "cellphone", isDigital: true });
  expect(nicepayMethodOptions("vbank")).toMatchObject({ vbankHolder: "Growth Opt Playbook", vbankValidHours: 24 });
  expect(() => nicepayMethodOptions("unknown")).toThrow();
});
