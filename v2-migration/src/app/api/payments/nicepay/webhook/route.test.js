import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ admit: vi.fn(), reconcile: vi.fn() }));
vi.mock("@/lib/subscription/paymentRequestLimit", () => ({ admitPaymentRequest: mocks.admit, paymentLimitResponse: () => new Response(null, { status: 429 }) }));
vi.mock("@/lib/subscription/paymentServer", () => ({ reconcilePaymentWebhook: mocks.reconcile, paymentError: () => new Response(null, { status: 503 }) }));
import { POST } from "./route";
beforeEach(() => { vi.resetAllMocks(); mocks.admit.mockReturnValue(true); });
const request = () => new Request("https://growthoptplaybook.com/api/payments/nicepay/webhook", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: "gop_fixture", status: "cancelled" }) });
it("accepts JSON and acknowledges only after reconciliation in NICEPAY's documented HTML format", async () => {
  const response = await POST(request());
  expect(mocks.reconcile).toHaveBeenCalledWith({ orderId: "gop_fixture", status: "cancelled" }, "nicepay");
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
  expect(await response.text()).toBe("OK");
});
it("does not acknowledge a failed reconciliation so the provider can retry", async () => {
  mocks.reconcile.mockRejectedValue(new Error("provider offline"));
  const response = await POST(request());
  expect(response.status).toBe(503);
  expect(await response.text()).not.toBe("OK");
});
it("limits requests before provider calls", async () => {
  mocks.admit.mockReturnValue(false);
  expect((await POST(request())).status).toBe(429);
  expect(mocks.reconcile).not.toHaveBeenCalled();
});
