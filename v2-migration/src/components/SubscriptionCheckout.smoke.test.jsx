import { afterEach, expect, it, vi } from "vitest";
import { render, waitFor, screen, fireEvent } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import SubscriptionCheckout from "./SubscriptionCheckout";

const tracking = vi.hoisted(() => vi.fn());
vi.mock("@/lib/subscription/paymentAnalytics", () => ({ trackPaymentEvent: tracking, paymentFailureEvent: () => "payment_failed" }));
vi.mock("@/lib/subscription/paymentClient", () => ({ rememberPaymentAccess: vi.fn() }));
vi.mock("@/lib/analytics", () => ({ trackProductEvent: vi.fn() }));
afterEach(() => { vi.unstubAllGlobals(); delete window.TossPayments; tracking.mockClear(); window.history.replaceState(null, "", "/"); });
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

it.each(["ko", "en"])("explains an order rate limit after purchase intent without submitting payment (%s)", async locale => {
  useAppStore.setState({ ...useAppStore.getInitialState(), entitlement: null });
  const requestPayment = vi.fn();
  window.TossPayments = () => ({ widgets: () => ({ setAmount: async () => {}, renderPaymentMethods: async () => {}, renderAgreement: async () => {}, requestPayment }) });
  vi.stubGlobal("fetch", vi.fn(async path => path.endsWith("config") ? { ok: true, json: async () => ({ enabled: true, mode: "test" }) } : { ok: false, status: 429 }));
  render(<SubscriptionCheckout locale={locale} />);
  fireEvent.click(await screen.findByRole("button", { name: locale === "en" ? "Pay KRW 5,900" : "5,900원 결제하기" }));
  await screen.findByText(locale === "en" ? "Too many requests. Wait one minute before trying again." : "요청이 많습니다. 1분 후 다시 시도해 주세요.");
  expect(requestPayment).not.toHaveBeenCalled();
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
  expect(fetch.mock.calls.some(([path]) => path.endsWith("order"))).toBe(false);
  expect(tracking.mock.calls.some(([name]) => ["checkout_requested", "begin_checkout"].includes(name))).toBe(false);
  fireEvent.click(pay);
  await waitFor(() => expect(requestPayment).toHaveBeenCalledOnce());
  expect(fetch.mock.calls.filter(([path]) => path.endsWith("order"))).toHaveLength(1);
  expect(tracking).toHaveBeenCalledWith("begin_checkout", expect.objectContaining({ locale }));
  delete window.TossPayments;
});
it.each(["ko", "en"])("shows deposit waiting without a purchase event or another pay button (%s)", async locale => {
  useAppStore.setState({ ...useAppStore.getInitialState(), entitlement: null });
  window.history.replaceState(null, "", "/subscription?payment=confirm");
  vi.stubGlobal("fetch", vi.fn(async path => ({ ok: true, json: async () => path.endsWith("config") ? { enabled: true } : { entitlement: null, status: "waiting_for_deposit", orderId: "gop-pending" } })));
  render(<SubscriptionCheckout locale={locale} />);
  await screen.findByRole("heading", { name: locale === "en" ? "Waiting for your deposit" : "입금 확인을 기다리고 있습니다" });
  expect(tracking.mock.calls.some(([name]) => name === "purchase")).toBe(false);
  expect(screen.queryByRole("button", { name: locale === "en" ? "Pay KRW 5,900" : "5,900원 결제하기" })).toBeNull();
});

it.each(["ko", "en"])("opens an explicit renewal without creating an order until payment (%s)", async locale => {
  useAppStore.setState({ ...useAppStore.getInitialState(), entitlement: { plan: "paid", expiresAt: Date.now() + 10 * 86400000, offlineUntil: Date.now() + 3600000 } });
  const requestPayment = vi.fn();
  window.TossPayments = () => ({ widgets: () => ({ setAmount: async () => {}, renderPaymentMethods: async () => {}, renderAgreement: async () => {}, requestPayment }) });
  vi.stubGlobal("fetch", vi.fn(async path => ({ ok: true, json: async () => path.endsWith("config") ? { enabled: true, mode: "test", clientKey: "test" } : { orderId: "fixture", amount: 5900 } })));
  render(<SubscriptionCheckout locale={locale} />);
  fireEvent.click(await screen.findByRole("button", { name: locale === "en" ? "Extend by 1 month" : "1개월 연장하기" }));
  const button = await screen.findByRole("button", { name: locale === "en" ? "Pay KRW 5,900" : "5,900원 결제하기" });
  expect(fetch.mock.calls.some(([path]) => path.endsWith("order"))).toBe(false);
  expect(screen.getByText(locale === "en" ? /Your remaining days are kept/ : /남은 기간을 유지하는/)).toBeTruthy();
  fireEvent.click(button);
  await waitFor(() => expect(requestPayment).toHaveBeenCalledOnce());
});
