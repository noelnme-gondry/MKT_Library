import { expect, it, vi } from "vitest";
import { admitPaymentRequest, paymentLimitResponse } from "./paymentRequestLimit";
it("bounds anonymous order creation and resets its time window", () => {
  for (let i = 0; i < 30; i++) expect(admitPaymentRequest("order", undefined, 0)).toBe(true);
  expect(admitPaymentRequest("order", undefined, 1)).toBe(false);
  expect(admitPaymentRequest("order", undefined, 60000)).toBe(true);
  expect(paymentLimitResponse().status).toBe(429);
});

it("isolates trusted edge clients and does not charge rejected retries to others", () => {
  vi.stubEnv("RAILWAY_ENVIRONMENT_ID", "fixture");
  const request = ip => new Request("https://example.com", { headers: { "x-real-ip": ip } });
  for (let i = 0; i < 30; i++) expect(admitPaymentRequest("order", request("192.0.2.1"), 200000)).toBe(true);
  for (let i = 0; i < 1000; i++) expect(admitPaymentRequest("order", request("192.0.2.1"), 200001)).toBe(false);
  expect(admitPaymentRequest("order", request("192.0.2.2"), 200001)).toBe(true);
  vi.unstubAllEnvs();
});
it("does not trust forged client headers outside Railway", () => {
  vi.stubEnv("RAILWAY_ENVIRONMENT_ID", "");
  for (let i = 0; i < 30; i++) expect(admitPaymentRequest("order", new Request("https://example.com", { headers: { "x-real-ip": `192.0.2.${i}` } }), 400000)).toBe(true);
  expect(admitPaymentRequest("order", new Request("https://example.com", { headers: { "x-real-ip": "192.0.2.250" } }), 400001)).toBe(false);
  vi.unstubAllEnvs();
});
