"use client";
import { useEffect, useRef } from "react";
import { useAppStore } from "@/store/useDataStore";
import { useClientReady } from "@/lib/useClientReady";
import { trackDiagnosis } from "@/lib/trackDiagnosis";

export function usePlannerEntry(locale) {
  const entry = useRef(null);
  useEffect(() => {
    if (entry.current === locale) return;
    entry.current = locale;
    const from = new URLSearchParams(window.location.search).get("from");
    trackDiagnosis("entry_view", ["blog", "tool"].includes(from) ? from : "direct", locale);
  }, [locale]);
}

// Restoring saved project data can replace the active CSV. Enable import only after that handoff.
export function usePlannerEntryReady(shared = true) {
  const hydrated = useClientReady();
  const preparing = useAppStore(state => state.projectSwitching ||
    (state.decisionPersistenceEnabled && !state.projectsReady && !state.projectError));
  return hydrated && (!shared || !preparing);
}
