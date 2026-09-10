import { afterEach, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import SubscriptionPurchasePrompt from "./SubscriptionPurchasePrompt";
afterEach(() => { useAppStore.setState({ purchasePrompt: null }); vi.unstubAllGlobals(); });
it.each(["ko", "en"])("offers real sample reports when checkout is unavailable (%s)", async locale => {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ enabled: false }) })));
  useAppStore.setState({ purchasePrompt: { toolId: "5-2", locale, format: "docx" } });
  render(<SubscriptionPurchasePrompt />);
  await waitFor(() => expect(screen.getByRole("link", { name: locale === "en" ? "View free sample reports" : "무료 샘플 보고서 보기" }).getAttribute("href")).toBe(locale === "en" ? "/en/subscription#report-preview-title" : "/subscription#report-preview-title"));
});
