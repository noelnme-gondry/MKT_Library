"use client";

import { useEffect } from "react";
import { SUBSCRIPTION, validateLicenseHash, hasPaidAccess } from "@/lib/subscription/entitlement";
import { useAppStore } from "@/store/useDataStore";
import { refreshPaymentAccess } from "@/lib/subscription/paymentClient";
import { refreshAccount } from "@/lib/account/accountClient";
import { sweepCheckoutSnapshots } from "@/lib/subscription/checkoutSnapshot";

// IndexedDB는 Zustand persist와 의도적으로 분리돼 있다. hydration이 끝난 뒤에만
// 복원해야, 과거 사용자의 보수적 OFF 마이그레이션보다 먼저 파일을 읽지 않는다.
export default function WorkspaceStorageBootstrap() {
  useEffect(() => {
    let cancelled = false;
    sweepCheckoutSnapshots().catch(() => {});
    const refreshLicense = async () => {
      let cache;
      try { cache = JSON.parse(localStorage.getItem(SUBSCRIPTION.cacheKey)); } catch { return; }
      if (!cache?.keyHash) { await refreshPaymentAccess(cache); return; }
      if (hasPaidAccess(cache)) useAppStore.getState().setEntitlement(cache);
      const result = await validateLicenseHash(cache.keyHash, cache);
      if (cancelled) return;
      useAppStore.getState().setEntitlement(result.entitlement);
      try { if (result.entitlement) localStorage.setItem(SUBSCRIPTION.cacheKey, JSON.stringify(result.entitlement)); else localStorage.removeItem(SUBSCRIPTION.cacheKey); } catch {}
    };
    const refreshAccountAccess = () => { if (!cancelled) refreshAccount().catch(() => {}); };
    refreshLicense().catch(() => {}).finally(refreshAccountAccess);
    const refreshTimer = setInterval(refreshAccountAccess, 240000);
    window.addEventListener("focus", refreshAccountAccess);
    const restore = async () => {
      if (cancelled || useAppStore.getState().decisionPersistenceEnabled !== true) return;
      navigator.storage?.persist?.().catch(() => {});
      await useAppStore.getState().initializeProjects();
    };
    const unsubscribe = useAppStore.persist.onFinishHydration(restore);
    if (useAppStore.persist.hasHydrated()) restore();
    return () => {
      cancelled = true;
      clearInterval(refreshTimer);
      window.removeEventListener("focus", refreshAccountAccess);
      unsubscribe();
    };
  }, []);

  return null;
}
