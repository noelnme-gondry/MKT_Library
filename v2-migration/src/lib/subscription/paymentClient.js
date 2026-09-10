import { SUBSCRIPTION, hasPaidAccess } from "./entitlement";
import { useAppStore } from "@/store/useDataStore";

const emptyCheckKey = "gop:payment:empty-check";
export function rememberPaymentAccess(entitlement) {
  try { sessionStorage.removeItem(emptyCheckKey); } catch { /* Optional cache. */ }
  useAppStore.getState().setEntitlement(entitlement);
  try { if (entitlement) localStorage.setItem(SUBSCRIPTION.cacheKey, JSON.stringify(entitlement)); else localStorage.removeItem(SUBSCRIPTION.cacheKey); } catch { /* Cookie still supports restoration on the next visit. */ }
}
export async function refreshPaymentAccess(previous = null) {
  // Only cache a successful negative lookup. Paid access is always revalidated.
  // Session scope preserves recovery in a fresh browser session; at most five
  // minutes of delay if an old cookie changes in another tab without a local pass.
  if (!previous && !useAppStore.getState().entitlement) {
    try { const at = Number(sessionStorage.getItem(emptyCheckKey)); if (at > 0 && Date.now() - at < 300000) return null; } catch { /* No storage: check normally. */ }
  }
  const startedAt = Date.now();
  try {
    const response = await fetch("/api/payments/access", { cache: "no-store" });
    if (!response.ok) throw new Error("UNAVAILABLE");
    const { entitlement } = await response.json();
    const current = useAppStore.getState().entitlement;
    if (current?.payment && current.verifiedAt >= startedAt) return current;
    rememberPaymentAccess(entitlement);
    if (!entitlement) { try { sessionStorage.setItem(emptyCheckKey, String(Date.now())); } catch { /* Optional. */ } }
    return entitlement;
  } catch {
    const current = useAppStore.getState().entitlement;
    if (current?.payment && current.verifiedAt >= startedAt) return current;
    const cached = previous?.payment && hasPaidAccess(previous) ? { ...previous, offline: true } : null;
    rememberPaymentAccess(cached);
    return cached;
  }
}
