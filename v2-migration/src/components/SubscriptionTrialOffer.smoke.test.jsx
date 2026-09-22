// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import SubscriptionTrialOffer from "./SubscriptionTrialOffer";
import SubscriptionPlanComparison from "./SubscriptionPlanComparison";
import { PRO_TRIAL_DAYS } from "@/lib/account/archiveContract";
const refresh = vi.hoisted(() => vi.fn());
vi.mock("@/lib/account/accountClient", () => ({ refreshAccount: refresh }));
afterEach(() => { cleanup(); useAppStore.setState({ entitlement: null }); refresh.mockReset(); });
it.each(["ko", "en"])("offers a project-creation route without starting a trial (%s)", async locale => {
  refresh.mockResolvedValue({ enabled: true, account: null });
  render(<SubscriptionTrialOffer locale={locale} />);
  const link = await screen.findByRole("link", { name: locale === "en" ? "Create a project to try Pro" : "프로젝트 만들고 Pro 체험하기" });
  expect(link.getAttribute("href")).toBe(`${locale === "en" ? "/en" : ""}/weekly-review#wr-upload`);
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
  render(<SubscriptionPlanComparison locale={locale} paid={false} trialEndsAt={now + PRO_TRIAL_DAYS * 86400000 + 1} now={now} />);
  expect(screen.getByText(locale === "en" ? `Pro trial · ${PRO_TRIAL_DAYS} days left` : `Pro 체험 중 · ${PRO_TRIAL_DAYS}일 남음`)).toBeTruthy();
  expect(screen.queryByText(locale === "en" ? "Your current plan" : "현재 이용 플랜")).toBeNull();
  expect(screen.getByRole("link", { name: locale === "en" ? "Choose Pro" : "Pro 이용권 선택" }).getAttribute("href")).toBe("#purchase");
});

// 상한은 "활성일 수 있는 체험 중 가장 긴 것"이다. 길이가 전 계정 공통이 된
// 지금은 그것이 곧 PRO_TRIAL_DAYS이고, 그보다 긴 값이 와도 늘려 보이지 않는다.
it.each(["ko", "en"])("never shows more than one trial length (%s)", locale => {
  const now = Date.UTC(2026, 8, 11);
  render(<SubscriptionPlanComparison locale={locale} paid={false} trialEndsAt={now + 30 * 86400000} now={now} />);
  expect(screen.getByText(locale === "en" ? `Pro trial · ${PRO_TRIAL_DAYS} days left` : `Pro 체험 중 · ${PRO_TRIAL_DAYS}일 남음`)).toBeTruthy();
});
