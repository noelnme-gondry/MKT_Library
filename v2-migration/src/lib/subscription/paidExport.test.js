// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { useAppStore } from "@/store/useDataStore";
import { requirePaidExport } from "./paidExport";
import { hasPaidAccess } from "./entitlement";
const now = Date.parse("2026-09-12T00:00:00Z");
const active = { plan: "paid", expiresAt: now + 86400000, offlineUntil: now + 3600000 };
beforeEach(() => { vi.spyOn(Date, "now").mockReturnValue(now); useAppStore.setState({ entitlement: null, purchasePrompt: null }); });
afterEach(() => vi.restoreAllMocks());

it.each(["docx", "xlsx", "csv", "png", "pdf"])("blocks a never-purchased trial from analysis %s, preserving its other Pro features", format => {
  const trial = { ...active, account: true, trial: true };
  useAppStore.setState({ entitlement: trial });
  expect(hasPaidAccess(trial)).toBe(true);
  expect(requirePaidExport({ toolId: "5-2", locale: "en", format })).toBe(false);
  expect(useAppStore.getState().purchasePrompt).toMatchObject({ toolId: "5-2", locale: "en", format });
});
it.each([null, { ...active }, { ...active, payment: true, expiresAt: now }, { ...active, account: true, trial: false, offlineUntil: now }])("rejects missing, unproven, expired or stale purchase access (%j)", entitlement => {
  useAppStore.setState({ entitlement });
  expect(requirePaidExport()).toBe(false);
  expect(useAppStore.getState().purchasePrompt).toBeTruthy();
});
it.each([{ ...active, payment: true }, { ...active, account: true, trial: false }, { ...active, account: true, payment: false, accountId: "restored-owner" }])("accepts current verified payment/account purchase access (%j)", entitlement => {
  useAppStore.setState({ entitlement });
  expect(requirePaidExport()).toBe(true);
  expect(useAppStore.getState().purchasePrompt).toBeNull();
});
