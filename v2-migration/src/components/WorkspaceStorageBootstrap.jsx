"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store/useDataStore";

// IndexedDB는 Zustand persist와 의도적으로 분리돼 있다. hydration이 끝난 뒤에만
// 복원해야, 과거 사용자의 보수적 OFF 마이그레이션보다 먼저 파일을 읽지 않는다.
export default function WorkspaceStorageBootstrap() {
  useEffect(() => {
    let cancelled = false;
    const restore = () => {
      if (cancelled || useAppStore.getState().decisionPersistenceEnabled !== true) return;
      navigator.storage?.persist?.().catch(() => {});
      useAppStore.getState().restoreWorkspaceDatasets();
    };
    const unsubscribe = useAppStore.persist.onFinishHydration(restore);
    if (useAppStore.persist.hasHydrated()) restore();
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return null;
}
