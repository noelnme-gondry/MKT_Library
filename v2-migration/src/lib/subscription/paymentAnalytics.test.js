import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { trackPaymentEvent, paymentFailureEvent } from "./paymentAnalytics";

const transaction = { orderId: "gop_12345678-1234-1234-1234-123456789abc", amount: 5900 };
beforeEach(() => {
  const values = new Map();
  vi.stubGlobal("sessionStorage", { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) });
  const durable = new Map();
  vi.stubGlobal("localStorage", { getItem: key => durable.get(key), setItem: (key, value) => durable.set(key, value) });
  vi.stubGlobal("window", { gtag: vi.fn(), location: { hostname: "growthoptplaybook.com" } });
});
afterEach(() => vi.unstubAllGlobals());
it("sends a standard live purchase once with only public transaction fields", () => {
  const data = { locale: "en", mode: "live", transaction, recoveryCode: "private", paymentKey: "secret" };
  expect(trackPaymentEvent("purchase", data)).toBe(true);
  expect(trackPaymentEvent("purchase", data)).toBe(false);
  expect(window.gtag).toHaveBeenCalledTimes(1);
  expect(window.gtag.mock.calls[0]).toEqual(["event", "purchase", {
    locale: "en", source: "subscription_page", state: "live", currency: "KRW", value: 5900,
    transaction_id: transaction.orderId, items: [{ item_id: "report-pass-month-v1", price: 5900, quantity: 1 }], send_to: "G-DK12TNR0GW",
  }]);
});
it("keeps test purchases out of standard revenue events", () => {
  trackPaymentEvent("purchase", { mode: "test", transaction });
  expect(window.gtag.mock.calls[0][1]).toBe("test_purchase");
});
it("rejects missing or invalid confirmed metadata and survives analytics failure", () => {
  expect(trackPaymentEvent("purchase", { mode: "live" })).toBe(false);
  expect(trackPaymentEvent("purchase", { mode: "live", transaction: { ...transaction, amount: -1 } })).toBe(false);
  expect(window.gtag).not.toHaveBeenCalled();
  window.gtag.mockImplementation(() => { throw new Error("blocked"); });
  expect(trackPaymentEvent("purchase", { mode: "live", transaction })).toBe(false);
});
it("classifies cancellation without sending raw provider errors", () => {
  expect(paymentFailureEvent({ code: "USER_CANCEL", message: "secret" })).toBe("payment_cancelled");
  expect(paymentFailureEvent({ code: "UNKNOWN" })).toBe("payment_failed");
});

it("deduplicates a purchase after session storage is cleared", () => {
  expect(trackPaymentEvent("purchase", { mode: "live", transaction })).toBe(true);
  vi.stubGlobal("sessionStorage", { getItem: () => null, setItem: vi.fn() });
  expect(trackPaymentEvent("purchase", { mode: "live", transaction })).toBe(false);
  expect(window.gtag).toHaveBeenCalledTimes(1);
});
