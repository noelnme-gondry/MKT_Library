import { afterEach, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import SubscriptionPurchasePrompt from "./SubscriptionPurchasePrompt";
afterEach(() => { useAppStore.setState({ purchasePrompt: null }); vi.unstubAllGlobals(); });
it.each(["ko", "en"])("offers support instead of unavailable checkout (%s)", async locale => {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ enabled: false }) })));
  useAppStore.setState({ purchasePrompt: { toolId: "5-2", locale, format: "docx" } });
  render(<SubscriptionPurchasePrompt />);
  await waitFor(() => expect(screen.getByRole("link", { name: locale === "en" ? "Contact support" : "고객센터 문의" }).getAttribute("href")).toBe(locale === "en" ? "/en/contact" : "/contact"));
});
