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
// 5,900원을 내기 전에 받게 될 파일을 먼저 볼 수 있어야 한다. 구매 가능한 평소 상태에서도
// 샘플 보고서로 가는 길을 두고, 구매 버튼(primary)은 하나로 유지한다.
it.each(["ko", "en"])("offers the free sample report next to checkout when purchase is available (%s)", async locale => {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ enabled: true }) })));
  window.gtag = vi.fn();
  useAppStore.setState({ purchasePrompt: { toolId: "5-2", locale, format: "docx" } });
  const { container } = render(<SubscriptionPurchasePrompt />);
  await waitFor(() => expect(screen.getByRole("link", { name: locale === "en" ? "Continue to Pro checkout" : "Pro 구매로 계속" })).toBeTruthy());
  expect(document.querySelectorAll(".purchase-dialog .btn.primary, [role=dialog] .btn.primary").length).toBe(1);
  const sample = screen.getByRole("link", { name: locale === "en" ? "Download a free sample report first" : "무료 샘플 보고서 먼저 받아 보기" });
  expect(sample.getAttribute("href")).toBe(locale === "en" ? "/en/subscription#report-preview-title" : "/subscription#report-preview-title");
  sample.addEventListener("click", event => event.preventDefault());
  fireEvent.click(sample);
  expect(window.gtag).toHaveBeenCalledWith("event", "purchase_prompt_sample_opened", expect.objectContaining({ tool_id: "5-2", placement: "purchase_prompt", locale }));
  expect(useAppStore.getState().purchasePrompt).toBeNull();
  expect(container).toBeTruthy();
  delete window.gtag;
});
