"use client";
import { use, useEffect } from "react";
import { notFound, redirect } from "next/navigation";
import dynamic from "next/dynamic";

import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import GlobalModals from "@/components/GlobalModals";
import MobileToolNudge from "@/components/MobileToolNudge";
import DmNudge from "@/components/DmNudge";

// 번역 완료된 도구만 여기 추가(routeMap EN_READY_TOOL_IDS와 함께 확장).
const dyn = (loader) => dynamic(loader, { loading: () => <div style={{ padding: "40px", color: "var(--text-muted)", fontSize: "13px" }}>Loading…</div> });
const BudgetAllocation = dyn(() => import("@/components/tools/BudgetAllocation"));
const MarketingResponse = dyn(() => import("@/components/tools/MarketingResponse"));

import { useAppStore } from "@/store/useDataStore";
import { resolveSlugToId, hasEnVersion, idToPath } from "@/lib/routeMap";

export default function PageClient({ params }) {
  const { slug } = use(params);
  const routeId = resolveSlugToId(slug);

  // Unknown URL -> 404. Known but untranslated -> KR canonical (thin/half-EN
  // page never gets served or indexed — §plan EN_READY_TOOL_IDS gate).
  if (routeId === null) notFound();
  if (!hasEnVersion(routeId)) redirect(idToPath(routeId));

  const setCurrentRouteId = useAppStore((state) => state.setCurrentRouteId);
  useEffect(() => {
    if (useAppStore.getState().currentRouteId !== routeId) {
      setCurrentRouteId(routeId);
    }
  }, [routeId, setCurrentRouteId]);

  return (
    <>
      <div className="app">
        <Sidebar locale="en" />
        <main className="main">
          <Header locale="en" />
          <article className="content" id="content" aria-live="polite">
            {(routeId.startsWith("5-") || routeId.startsWith("9-")) && <MobileToolNudge locale="en" />}

            {routeId === "5-3" && <BudgetAllocation locale="en" />}
            {routeId === "5-18" && <MarketingResponse locale="en" />}
          </article>
        </main>
      </div>
      {(routeId.startsWith("5-") || routeId.startsWith("9-")) && <DmNudge locale="en" />}
      <GlobalModals locale="en" />
    </>
  );
}
