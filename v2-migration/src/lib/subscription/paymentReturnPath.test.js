import { afterEach, expect, it, vi } from "vitest";
import { rememberPaymentReturn, readPaymentReturn } from "./paymentReturnPath";
afterEach(() => vi.unstubAllGlobals());
it("returns to the same localized tool without accepting an external destination", () => {
  let saved;
  vi.stubGlobal("sessionStorage", { setItem: (_, value) => { saved = value; }, getItem: () => saved });
  rememberPaymentReturn("5-2", "en");
  expect(readPaymentReturn()).toMatch(/^\/en\//);
  saved = JSON.stringify({ path: "//evil.example", at: Date.now() });
  expect(readPaymentReturn()).toBeNull();
});
