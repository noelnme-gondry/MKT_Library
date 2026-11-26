"use client";
import { useEffect, useRef } from "react";
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
