import { useAppStore } from "@/store/useDataStore";
import { hasPaidAccess } from "@/lib/subscription/entitlement";
export async function accountRequest(path, options) {
  const response = await fetch(`/api/account/${path}`, { cache: "no-store", ...options });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "ACCOUNTS_UNAVAILABLE");
  if (typeof window !== "undefined" && options?.method && options.method !== "GET" && path !== "login") window.dispatchEvent(new Event("gop-account-changed"));
  return data;
}
export async function refreshAccount() {
  let data;
  try { data = await accountRequest("session"); }
  catch (error) {
    if (error.message === "ACCOUNT_RESTRICTED" && useAppStore.getState().entitlement?.account) useAppStore.getState().setEntitlement(null);
    throw error;
  }
  const current = useAppStore.getState().entitlement;
  // Do not shorten an existing anonymous purchase while the owner links it.
  if (data.entitlement) {
    const samePurchase = current && ((!current.account && !current.accountId) || (current.payment && current.accountId === data.account?.id));
    if (!(samePurchase && hasPaidAccess(current) && current.expiresAt >= data.entitlement.expiresAt)) useAppStore.getState().setEntitlement(data.entitlement);
  } else if (current?.account) useAppStore.getState().setEntitlement(null);
  return data;
}
