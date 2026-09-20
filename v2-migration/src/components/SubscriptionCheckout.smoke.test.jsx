import { afterEach, expect, it, vi } from "vitest";
import { render, waitFor, screen, fireEvent, act } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import SubscriptionCheckout from "./SubscriptionCheckout";

const tracking = vi.hoisted(() => vi.fn());
vi.mock("@/lib/subscription/paymentAnalytics", () => ({ trackPaymentEvent: tracking, paymentFailureEvent: () => "payment_failed" }));
vi.mock("@/lib/subscription/paymentClient", () => ({ rememberPaymentAccess: vi.fn() }));
vi.mock("@/lib/analytics", () => ({ trackProductEvent: vi.fn() }));
afterEach(() => { vi.unstubAllGlobals(); delete window.TossPayments; delete window.AUTHNICE; tracking.mockClear(); window.history.replaceState(null, "", "/"); });

it.each(["ko", "en"])("submits the selected approved payment method (%s)", async locale => {
  useAppStore.setState({ ...useAppStore.getInitialState(), entitlement: null });
  window.AUTHNICE = { requestPay: vi.fn() };
  vi.stubGlobal("fetch", vi.fn(async path => ({ ok: true, json: async () => path.endsWith("config")
    ? { enabled: true, provider: "nicepay", mode: "test", clientKey: "fixture", methods: ["card", "cellphone"] }
    : { orderId: "gop_fixture", amount: 5900 } })));
  render(<SubscriptionCheckout locale={locale} />);
  fireEvent.click(await screen.findByRole("radio", { name: locale === "en" ? "Mobile phone billing" : "휴대폰 결제" }));
  expect(screen.queryByRole("radio", { name: /Kakao|카카오/ })).toBeNull();
  fireEvent.click(await screen.findByRole("button", { name: locale === "en" ? "Pay KRW 5,900" : "5,900원 결제하기" }));
  await waitFor(() => expect(window.AUTHNICE.requestPay).toHaveBeenCalledOnce());
  expect(window.AUTHNICE.requestPay.mock.calls[0][0]).toMatchObject({ method: "cellphone", isDigital: true });
});

it.each(["ko", "en"])("restores virtual-account deposit instructions without offering another payment (%s)", async locale => {
  useAppStore.setState({ ...useAppStore.getInitialState(), entitlement: null });
  vi.stubGlobal("fetch", vi.fn(async path => ({ ok: true, json: async () => path.endsWith("config")
    ? { enabled: true, provider: "nicepay", mode: "test", methods: ["card", "vbank"] }
    : { status: "waiting_for_deposit", orderId: "gop_fixture", deposit: { bank: "Fixture Bank", number: "123456", holder: "Fixture", amount: 5900, expiresAt: "2026-09-21" } } })));
  render(<SubscriptionCheckout locale={locale} />);
  await screen.findByText("Fixture Bank 123456");
  expect(screen.queryByRole("button", { name: /Pay KRW|5,900원 결제하기/ })).toBeNull();
  expect(tracking.mock.calls.some(([name]) => name === "purchase")).toBe(false);
});

it.each(["ko", "en"])("does not send a new-provider order to an old open checkout (%s)", async locale => {
  useAppStore.setState({ ...useAppStore.getInitialState(), entitlement: null });
  window.AUTHNICE = { requestPay: vi.fn() };
  vi.stubGlobal("fetch", vi.fn(async path => ({ ok: true, json: async () => path.endsWith("config")
    ? { enabled: true, provider: "nicepay", mode: "live", clientKey: "fixture" }
    : { orderId: "gop_fixture", amount: 5900, provider: "toss", mode: "live" } })));
  render(<SubscriptionCheckout locale={locale} />);
  fireEvent.click(await screen.findByRole("button", { name: locale === "en" ? "Pay KRW 5,900" : "5,900원 결제하기" }));
  await screen.findByText(locale === "en" ? /Checkout settings changed/ : /결제 설정이 변경됐습니다/);
  expect(window.AUTHNICE.requestPay).not.toHaveBeenCalled();
  expect(tracking.mock.calls.some(([name]) => name === "begin_checkout")).toBe(false);
});

it.each(["ko", "en"])("opens NICEPAY only after intent and does not count authentication as purchase (%s)", async locale => {
  useAppStore.setState({ ...useAppStore.getInitialState(), entitlement: null });
  window.AUTHNICE = { requestPay: vi.fn() };
  vi.stubGlobal("fetch", vi.fn(async path => ({ ok: true, json: async () => path.endsWith("config")
    ? { enabled: true, provider: "nicepay", mode: "test", clientKey: "nice-fixture" }
    : { orderId: "gop_fixture", amount: 5900 } })));
  render(<SubscriptionCheckout locale={locale} />);
  const button = await screen.findByRole("button", { name: locale === "en" ? "Pay KRW 5,900" : "5,900원 결제하기" });
  expect(window.AUTHNICE.requestPay).not.toHaveBeenCalled();
  fireEvent.click(button);
  await waitFor(() => expect(window.AUTHNICE.requestPay).toHaveBeenCalledOnce());
  expect(window.AUTHNICE.requestPay.mock.calls[0][0]).toMatchObject({ method: "card", amount: 5900, language: locale === "en" ? "EN" : "KO", returnUrl: `${location.origin}/api/payments/nicepay/return?locale=${locale}` });
  expect(tracking.mock.calls.some(([name]) => name === "purchase")).toBe(false);
});
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

it.each(["ko", "en"])("passes owner email and checks status before another payment (%s)", async locale => {
  useAppStore.setState({ ...useAppStore.getInitialState(), entitlement: null });
  window.AUTHNICE = { requestPay: vi.fn() };
  vi.stubGlobal("fetch", vi.fn(async path => ({ ok: true, json: async () => path.endsWith("config")
    ? { enabled: true, provider: "nicepay", mode: "live", clientKey: "fixture" }
    : path.endsWith("order") ? { orderId: "gop_fixture", amount: 5900, buyerEmail: "owner@example.com" }
    : { entitlement: null, account: null } })));
  render(<SubscriptionCheckout locale={locale} />);
  const label = locale === "en" ? "Pay KRW 5,900" : "5,900원 결제하기";
  fireEvent.click(await screen.findByRole("button", { name: label }));
  await waitFor(() => expect(window.AUTHNICE.requestPay).toHaveBeenCalledOnce());
  const request = window.AUTHNICE.requestPay.mock.calls[0][0];
  expect(request.buyerEmail).toBe("owner@example.com");
  expect(request).not.toHaveProperty("buyerName");
  expect(request).not.toHaveProperty("buyerTel");
  act(() => request.fnError());
  expect(screen.queryByRole("button", { name: label })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: locale === "en" ? "Check payment status" : "결제 상태 확인" }));
  await screen.findByText(locale === "en" ? /No active purchased pass/ : /활성화된 구매 이용권이 없습니다/);
  expect(window.AUTHNICE.requestPay).toHaveBeenCalledOnce();
  expect(tracking.mock.calls.some(([name]) => name === "purchase")).toBe(false);
});

it("recovers a pending virtual account from the payment status check", async () => {
  useAppStore.setState({ ...useAppStore.getInitialState(), entitlement: null });
  window.AUTHNICE = { requestPay: vi.fn() };
  let issued = false;
  vi.stubGlobal("fetch", vi.fn(async path => ({ ok: true, json: async () => path.endsWith("config")
    ? { enabled: true, provider: "nicepay", mode: "test", clientKey: "fixture", methods: ["vbank"] }
    : path.endsWith("order") ? { orderId: "gop_fixture", amount: 5900 }
    : path.endsWith("access") && issued ? { entitlement: null, status: "waiting_for_deposit", orderId: "gop_fixture", deposit: { bank: "Fixture Bank", number: "123456", amount: 5900 } }
    : { entitlement: null, account: null } })));
  render(<SubscriptionCheckout />);
  fireEvent.click(await screen.findByRole("button", { name: "5,900원 결제하기" }));
  await waitFor(() => expect(window.AUTHNICE.requestPay).toHaveBeenCalledOnce());
  issued = true;
  act(() => window.AUTHNICE.requestPay.mock.calls[0][0].fnError());
  fireEvent.click(screen.getByRole("button", { name: "결제 상태 확인" }));
  await screen.findByText("Fixture Bank 123456");
  expect(screen.queryByRole("button", { name: "5,900원 결제하기" })).toBeNull();
  expect(tracking.mock.calls.some(([name]) => name === "purchase")).toBe(false);
});

it("does not reopen payment when status lookup fails", async () => {
  useAppStore.setState({ ...useAppStore.getInitialState(), entitlement: null });
  window.AUTHNICE = { requestPay: vi.fn() };
  vi.stubGlobal("fetch", vi.fn(async path => ({ ok: !path.endsWith("access"), json: async () => path.endsWith("config")
    ? { enabled: true, provider: "nicepay", mode: "live", clientKey: "fixture" }
    : { orderId: "gop_fixture", amount: 5900 } })));
  render(<SubscriptionCheckout />);
  fireEvent.click(await screen.findByRole("button", { name: "5,900원 결제하기" }));
  await waitFor(() => expect(window.AUTHNICE.requestPay).toHaveBeenCalledOnce());
  act(() => window.AUTHNICE.requestPay.mock.calls[0][0].fnError());
  fireEvent.click(screen.getByRole("button", { name: "결제 상태 확인" }));
  await screen.findByText(/결제 상태를 확인하지 못했습니다/);
  expect(screen.queryByRole("button", { name: "5,900원 결제하기" })).toBeNull();
});
