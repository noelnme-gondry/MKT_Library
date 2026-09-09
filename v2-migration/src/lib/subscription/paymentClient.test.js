import { beforeEach, expect, it, vi } from "vitest";
import { refreshPaymentAccess } from "./paymentClient";
import { useAppStore } from "@/store/useDataStore";

beforeEach(() => useAppStore.setState({ entitlement: null }));
it.each([false, true])("a late bootstrap response cannot remove a newly confirmed purchase (network failure=%s)", async fail => {
  let release;
  vi.stubGlobal("fetch", vi.fn(() => new Promise((resolve, reject) => { release = () => fail ? reject(new Error("offline")) : resolve(Response.json({ entitlement: null })); })));
  const pending = refreshPaymentAccess();
  const entitlement = { plan: "paid", payment: true, verifiedAt: Date.now(), expiresAt: Date.now() + 3600000, offlineUntil: Date.now() + 3600000 };
  useAppStore.getState().setEntitlement(entitlement);
  release();
  expect(await pending).toEqual(entitlement);
  expect(useAppStore.getState().entitlement).toEqual(entitlement);
  vi.unstubAllGlobals();
});
