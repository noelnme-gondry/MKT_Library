import { beforeEach, expect, it, vi } from "vitest";
import { refreshPaymentAccess, rememberPaymentAccess } from "./paymentClient";
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

it("briefly caches only a successful anonymous lookup and invalidates it on activation", async () => {
  const values = new Map();
  vi.stubGlobal("sessionStorage", { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) });
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ entitlement: null })));
  await refreshPaymentAccess();
  await refreshPaymentAccess();
  expect(fetch).toHaveBeenCalledTimes(1);
  rememberPaymentAccess({ plan: "paid", payment: true, verifiedAt: Date.now(), expiresAt: Date.now() + 3600000 });
  await refreshPaymentAccess();
  expect(fetch).toHaveBeenCalledTimes(2);
  vi.unstubAllGlobals();
});
it("does not cache network failures as an anonymous visitor", async () => {
  const values = new Map();
  vi.stubGlobal("sessionStorage", { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) });
  vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
  await refreshPaymentAccess(); await refreshPaymentAccess();
  expect(fetch).toHaveBeenCalledTimes(2);
  vi.unstubAllGlobals();
});
