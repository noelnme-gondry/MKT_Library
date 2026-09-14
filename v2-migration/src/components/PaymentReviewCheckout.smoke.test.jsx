// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import PaymentReviewCheckout from "./PaymentReviewCheckout";
import { PAYMENT_PRODUCT } from "@/lib/subscription/paymentProduct";
import { useAppStore } from "@/store/useDataStore";
import { saveCheckoutSnapshot } from "@/lib/subscription/checkoutSnapshot";

vi.mock("@/lib/subscription/checkoutSnapshot", () => ({ saveCheckoutSnapshot: vi.fn().mockResolvedValue(undefined) }));
let methods;
beforeEach(() => {
  useAppStore.setState({ ...useAppStore.getInitialState(), entitlement: null });
  methods = { setAmount: vi.fn().mockResolvedValue(undefined), renderPaymentMethods: vi.fn().mockResolvedValue(undefined), renderAgreement: vi.fn().mockResolvedValue(undefined), requestPayment: vi.fn().mockResolvedValue(undefined) };
  window.TossPayments = vi.fn(() => ({ widgets: () => methods }));
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Review must not call order/approval APIs"); }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); delete window.TossPayments; window.history.replaceState(null, "", "/"); });

it.each(["ko", "en"])("opens only the test provider flow after explicit clicks without granting access (%s)", async locale => {
  const en = locale === "en";
  render(<PaymentReviewCheckout clientKey="test_gck_fixture" product={PAYMENT_PRODUCT} locale={locale} />);
  expect(window.TossPayments).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: en ? "Show test payment methods" : "테스트 결제수단 확인" }));
  const submit = await screen.findByRole("button", { name: en ? "Open KRW 5,900 test checkout" : "5,900원 테스트 결제창 열기" });
  expect(methods.setAmount).toHaveBeenCalledWith({ currency: PAYMENT_PRODUCT.currency, value: PAYMENT_PRODUCT.amount });
  expect(methods.requestPayment).not.toHaveBeenCalled();
  fireEvent.click(submit);
  await waitFor(() => expect(methods.requestPayment).toHaveBeenCalledOnce());
  expect(methods.requestPayment.mock.calls[0][0]).toMatchObject({ orderName: PAYMENT_PRODUCT.name, orderId: expect.stringMatching(/^gop_review_[a-f0-9-]{36}$/), successUrl: expect.stringContaining(`/api/payments/review-return?locale=${locale}&result=returned`) });
  expect(fetch).not.toHaveBeenCalled();
  expect(saveCheckoutSnapshot).toHaveBeenCalledOnce();
  expect(useAppStore.getState().entitlement).toBeNull();
});

it("rejects a live key and does not initialize a checkout", () => {
  render(<PaymentReviewCheckout clientKey="live_gck_fixture" product={PAYMENT_PRODUCT} />);
  expect(screen.queryByRole("button")).toBeNull();
  expect(window.TossPayments).not.toHaveBeenCalled();
});

it("retries an agreement load without rendering the methods twice", async () => {
  methods.renderAgreement.mockRejectedValueOnce(new Error("offline"));
  render(<PaymentReviewCheckout clientKey="test_gck_fixture" product={PAYMENT_PRODUCT} />);
  fireEvent.click(screen.getByRole("button", { name: "테스트 결제수단 확인" }));
  await screen.findByRole("status");
  fireEvent.click(screen.getByRole("button", { name: "테스트 결제수단 확인" }));
  await screen.findByRole("button", { name: "5,900원 테스트 결제창 열기" });
  expect(methods.renderPaymentMethods).toHaveBeenCalledOnce();
  expect(methods.renderAgreement).toHaveBeenCalledTimes(2);
});

it("treats a return marker as a notice, not as a purchase", async () => {
  window.history.replaceState(null, "", "/subscription?payment_review=returned#purchase");
  render(<PaymentReviewCheckout clientKey="test_gck_fixture" product={PAYMENT_PRODUCT} />);
  expect((await screen.findByRole("status")).textContent).toContain("결제를 승인하거나 이용권을 발급하지 않습니다");
  expect(location.search).toBe("");
  expect(useAppStore.getState().entitlement).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
});
