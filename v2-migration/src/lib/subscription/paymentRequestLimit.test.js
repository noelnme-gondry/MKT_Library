import { expect, it } from "vitest";
import { admitPaymentRequest, paymentLimitResponse } from "./paymentRequestLimit";
it("bounds anonymous order creation and resets its time window", () => {
  for (let i = 0; i < 30; i++) expect(admitPaymentRequest("order", 0)).toBe(true);
  expect(admitPaymentRequest("order", 1)).toBe(false);
  expect(admitPaymentRequest("order", 60000)).toBe(true);
  expect(paymentLimitResponse().status).toBe(429);
});
