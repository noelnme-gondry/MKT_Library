"use client";

import { useRouter } from "next/navigation";
import { useAppStore } from "@/store/useDataStore";
import { buildSampleJourney } from "@/lib/sampleJourney";

export default function useSampleAnalysis(locale = "ko") {
  const router = useRouter();
  return () => {
    const store = useAppStore.getState();
    store.setDemoDisabled(false);
    store.setDenomBasis("actions");
    // The hub shares the efficiency group but has no calculation contract.
    // Validate the actual dashboard contract, then open the hub with that gate.
    store.handoffCsvToRoute("5-2", buildSampleJourney(locale), { markAnalyzed: true });
    router.push(locale === "en" ? "/en/dochi-result" : "/dochi-result");
  };
}
