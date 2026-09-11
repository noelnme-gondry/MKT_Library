import { afterEach, expect, it, vi } from "vitest";
import { render, waitFor, screen, fireEvent } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import SubscriptionCheckout from "./SubscriptionCheckout";

const tracking = vi.hoisted(() => vi.fn());
vi.mock("@/lib/subscription/paymentAnalytics", () => ({ trackPaymentEvent: tracking, paymentFailureEvent: () => "payment_failed" }));
vi.mock("@/lib/subscription/paymentClient", () => ({ rememberPaymentAccess: vi.fn() }));
vi.mock("@/lib/analytics", () => ({ trackProductEvent: vi.fn() }));
afterEach(() => { vi.unstubAllGlobals(); tracking.mockClear(); window.history.replaceState(null, "", "/"); });
it.each(["ko", "en"])("only emits purchase after a successful approval response (%s)", async locale => {
  const transaction = { orderId: "gop_12345678-1234-1234-1234-123456789abc", amount: 5900 };
  window.history.replaceState(null, "", "/subscription?payment=confirm");
  vi.stubGlobal("fetch", vi.fn(async path => ({ ok: true, json: async () => path.endsWith("config") ? { enabled: true } : { entitlement: { plan: "paid" }, transaction, mode: "live" } })));
  render(<SubscriptionCheckout locale={locale} />);
  await waitFor(() => expect(tracking).toHaveBeenCalledWith("purchase", { locale, mode: "live", transaction }));
  expect(tracking.mock.calls.some(([name]) => name === "checkout_requested")).toBe(false);
  expect(screen.getByText(locale === "en" ? /Payment confirmed\./ : /결제를 확인했습니다\./)).toBeTruthy();
});
it("does not emit purchase on a failed confirmation", async () => {
  window.history.replaceState(null, "", "/subscription?payment=confirm");
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));
  render(<SubscriptionCheckout locale="ko" />);
  await waitFor(() => expect(tracking).toHaveBeenCalledWith("payment_confirmation_failed", expect.any(Object)));
  expect(tracking.mock.calls.some(([name]) => name === "purchase")).toBe(false);
});

it.each(["ko", "en"])("explains a rate limit without starting the payment SDK (%s)", async locale => {
  useAppStore.setState({ entitlement: null });
  vi.stubGlobal("fetch", vi.fn(async path => path.endsWith("config") ? { ok: true, json: async () => ({ enabled: true, mode: "test" }) } : { ok: false, status: 429 }));
  render(<SubscriptionCheckout locale={locale} />);
  await screen.findByText(locale === "en" ? "Too many requests. Wait one minute before trying again." : "요청이 많습니다. 1분 후 다시 시도해 주세요.");
  expect(screen.getByRole("button", { name: locale === "en" ? "Reload checkout" : "결제 화면 다시 불러오기" })).toBeTruthy();
  expect(tracking.mock.calls.some(([name]) => name === "begin_checkout")).toBe(false);
});

it.each(["ko", "en"])("prepares methods automatically and submits only after the single pay click (%s)", async locale => {
  useAppStore.setState({ ...useAppStore.getInitialState(), entitlement: null });
  const requestPayment = vi.fn().mockResolvedValue(undefined);
  const widgets = { setAmount: vi.fn().mockResolvedValue(undefined), renderPaymentMethods: vi.fn().mockResolvedValue(undefined), renderAgreement: vi.fn().mockResolvedValue(undefined), requestPayment };
  window.TossPayments = vi.fn(() => ({ widgets: () => widgets }));
  vi.stubGlobal("fetch", vi.fn(async path => ({ ok: true, json: async () => path.endsWith("config") ? { enabled: true, mode: "test", clientKey: "test" } : { orderId: "order", amount: 5900, orderName: "Pro", customerKey: "customer" } })));
  render(<SubscriptionCheckout locale={locale} />);
  const pay = await screen.findByRole("button", { name: locale === "en" ? "Pay KRW 5,900" : "5,900원 결제하기" });
  expect(widgets.renderPaymentMethods).toHaveBeenCalledOnce();
  expect(requestPayment).not.toHaveBeenCalled();
  fireEvent.click(pay);
  await waitFor(() => expect(requestPayment).toHaveBeenCalledOnce());
  delete window.TossPayments;
});
