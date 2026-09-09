import { SUBSCRIPTION, hasPaidAccess } from "./entitlement";
import { useAppStore } from "@/store/useDataStore";

export function rememberPaymentAccess(entitlement) {
  useAppStore.getState().setEntitlement(entitlement);
  try { if (entitlement) localStorage.setItem(SUBSCRIPTION.cacheKey, JSON.stringify(entitlement)); else localStorage.removeItem(SUBSCRIPTION.cacheKey); } catch { /* Cookie still supports restoration on the next visit. */ }
}
export async function refreshPaymentAccess(previous = null) {
  const startedAt = Date.now();
  try {
    const response = await fetch("/api/payments/access", { cache: "no-store" });
    if (!response.ok) throw new Error("UNAVAILABLE");
    const { entitlement } = await response.json();
    const current = useAppStore.getState().entitlement;
    if (current?.payment && current.verifiedAt >= startedAt) return current;
    rememberPaymentAccess(entitlement);
    return entitlement;
  } catch {
    const current = useAppStore.getState().entitlement;
    if (current?.payment && current.verifiedAt >= startedAt) return current;
    const cached = previous?.payment && hasPaidAccess(previous) ? { ...previous, offline: true } : null;
    rememberPaymentAccess(cached);
    return cached;
  }
}
