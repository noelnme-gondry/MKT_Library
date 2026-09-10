import { afterEach, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import SubscriptionCheckout from "./SubscriptionCheckout";

const tracking = vi.hoisted(() => vi.fn());
vi.mock("@/lib/subscription/paymentAnalytics", () => ({ trackPaymentEvent: tracking, paymentFailureEvent: () => "payment_failed" }));
vi.mock("@/lib/subscription/paymentClient", () => ({ rememberPaymentAccess: vi.fn() }));
vi.mock("@/lib/analytics", () => ({ trackProductEvent: vi.fn() }));
afterEach(() => { vi.unstubAllGlobals(); tracking.mockClear(); window.history.replaceState(null, "", "/"); });
it.each(["ko", "en"])("only emits purchase after a successful approval response (%s)", async locale => {
  const transaction = { orderId: "gop_12345678-1234-1234-1234-123456789abc", amount: 5900 };
  window.history.replaceState(null, "", "/subscription?payment=confirm");
  vi.stubGlobal("fetch", vi.fn(async path => ({ ok: true, json: async () => path.endsWith("config") ? { enabled: false } : { entitlement: { plan: "paid" }, transaction, mode: "live" } })));
  render(<SubscriptionCheckout locale={locale} />);
  await waitFor(() => expect(tracking).toHaveBeenCalledWith("purchase", { locale, mode: "live", transaction }));
});
it("does not emit purchase on a failed confirmation", async () => {
  window.history.replaceState(null, "", "/subscription?payment=confirm");
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));
  render(<SubscriptionCheckout locale="ko" />);
  await waitFor(() => expect(tracking).toHaveBeenCalledWith("payment_confirmation_failed", expect.any(Object)));
  expect(tracking.mock.calls.some(([name]) => name === "purchase")).toBe(false);
});
