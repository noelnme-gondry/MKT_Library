import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ entitlement: null, setEntitlement: vi.fn() }));
vi.mock("@/store/useDataStore", () => ({ useAppStore: { getState: () => state } }));
import { refreshAccount } from "./accountClient";
describe("account and purchased Pro coexistence", () => {
  beforeEach(() => { state.entitlement = null; state.setEntitlement.mockClear(); });
  it("does not replace a longer valid purchased pass with a shorter trial", async () => {
    const now = Date.now();
    state.entitlement = { plan: "paid", expiresAt: now + 30 * 86400000, offlineUntil: now + 60000 };
    const trial = { plan: "paid", account: true, expiresAt: now + 14 * 86400000, offlineUntil: now + 60000 };
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ entitlement: trial }));
    await refreshAccount();
    expect(state.setEntitlement).not.toHaveBeenCalled();
    spy.mockRestore();
  });
  it("clears an account's entitlement on logout", async () => {
    state.entitlement = { account: true };
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ entitlement: null }));
    await refreshAccount();
    expect(state.setEntitlement).toHaveBeenCalledWith(null);
    spy.mockRestore();
  });
  it("keeps the recovery flag when logging in with the same paid expiry", async () => {
    const now = Date.now();
    state.entitlement = { plan: "paid", payment: true, expiresAt: now + 30 * 86400000, offlineUntil: now + 72 * 3600000 };
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ entitlement: { ...state.entitlement, payment: false, account: true } }));
    await refreshAccount();
    expect(state.setEntitlement).not.toHaveBeenCalled();
    spy.mockRestore();
  });
  it("does not carry account A's longer paid access into account B", async () => {
    const now = Date.now();
    state.entitlement = { plan: "paid", payment: true, account: true, accountId: "a", expiresAt: now + 30 * 86400000, offlineUntil: now + 60000 };
    const trial = { plan: "paid", account: true, trial: true, expiresAt: now + 14 * 86400000, offlineUntil: now + 60000 };
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ account: { id: "b" }, entitlement: trial }));
    await refreshAccount();
    expect(state.setEntitlement).toHaveBeenCalledWith(trial);
    spy.mockRestore();
  });
  it("preserves the same account's recovery credential", async () => {
    const now = Date.now();
    state.entitlement = { plan: "paid", payment: true, account: true, accountId: "a", expiresAt: now + 30 * 86400000, offlineUntil: now + 60000 };
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ account: { id: "a" }, entitlement: { ...state.entitlement, payment: false } }));
    await refreshAccount(); expect(state.setEntitlement).not.toHaveBeenCalled(); spy.mockRestore();
  });
});
