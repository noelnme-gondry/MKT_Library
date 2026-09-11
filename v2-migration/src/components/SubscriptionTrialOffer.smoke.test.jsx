// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import SubscriptionTrialOffer from "./SubscriptionTrialOffer";
import SubscriptionPlanComparison from "./SubscriptionPlanComparison";
const refresh = vi.hoisted(() => vi.fn());
vi.mock("@/lib/account/accountClient", () => ({ refreshAccount: refresh }));
afterEach(() => { cleanup(); useAppStore.setState({ entitlement: null }); refresh.mockReset(); });
it.each(["ko", "en"])("offers a first-save route without starting a trial (%s)", async locale => {
  refresh.mockResolvedValue({ enabled: true, account: null });
  render(<SubscriptionTrialOffer locale={locale} />);
  const link = await screen.findByRole("link", { name: locale === "en" ? "Save a decision to try Pro" : "결정 저장하고 Pro 체험하기" });
  expect(link.getAttribute("href")).toBe(`${locale === "en" ? "/en" : ""}/weekly-review#account-archive`);
  expect(refresh).toHaveBeenCalledOnce();
});
it("does not offer a second trial to an expired account", async () => {
  refresh.mockResolvedValue({ enabled: true, account: { trialStartedAt: "2026-01-01" } });
  const { container } = render(<SubscriptionTrialOffer />);
  await vi.waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  expect(container.textContent).toBe("");
});
it("does not promise public signup during the restricted pilot", async () => {
  refresh.mockResolvedValue({ enabled: true, signupRestricted: true, account: null });
  const { container } = render(<SubscriptionTrialOffer />);
  await vi.waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  expect(container.textContent).toBe("");
});
it.each(["ko", "en"])("distinguishes trial time from a purchased pass (%s)", locale => {
  const now = Date.UTC(2026, 8, 11);
  // Server response can arrive just after the page's current-minute clock snapshot.
  render(<SubscriptionPlanComparison locale={locale} paid={false} trialEndsAt={now + 14 * 86400000 + 1} now={now} />);
  expect(screen.getByText(locale === "en" ? "Pro trial · 14 days left" : "Pro 체험 중 · 14일 남음")).toBeTruthy();
  expect(screen.queryByText(locale === "en" ? "Your current plan" : "현재 이용 플랜")).toBeNull();
  expect(screen.getByRole("link", { name: locale === "en" ? "Choose Pro" : "Pro 이용권 선택" }).getAttribute("href")).toBe("#purchase");
});
