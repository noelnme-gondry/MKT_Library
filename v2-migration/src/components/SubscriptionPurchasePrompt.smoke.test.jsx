import { afterEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import SubscriptionPurchasePrompt from "./SubscriptionPurchasePrompt";
afterEach(() => { useAppStore.setState({ purchasePrompt: null }); vi.unstubAllGlobals(); });
it.each(["ko", "en"])("offers real sample reports when checkout is unavailable (%s)", async locale => {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ enabled: false }) })));
  useAppStore.setState({ purchasePrompt: { toolId: "5-2", locale, format: "docx" } });
  render(<SubscriptionPurchasePrompt />);
  await waitFor(() => expect(screen.getByRole("link", { name: locale === "en" ? "View free sample reports" : "무료 샘플 보고서 보기" }).getAttribute("href")).toBe(locale === "en" ? "/en/subscription#report-preview-title" : "/subscription#report-preview-title"));
});
it.each(["ko", "en"])("acknowledges a deferral reason without closing the dialog (%s)", async locale => {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ enabled: false }) })));
  const prompt = { toolId: "5-2", locale, format: "docx" };
  useAppStore.setState({ purchasePrompt: prompt });
  render(<SubscriptionPurchasePrompt />);
  fireEvent.click(screen.getByText(locale === "en" ? "Not ready to purchase? (optional)" : "구매를 보류하는 이유가 있나요? (선택)"));
  fireEvent.click(screen.getByRole("button", { name: locale === "en" ? "Price" : "가격", exact: true }));
  expect(screen.getByText(locale === "en" ? /Thank you for your feedback/ : /의견 감사합니다/)).toBeTruthy();
  expect(useAppStore.getState().purchasePrompt).toBe(prompt);
});
