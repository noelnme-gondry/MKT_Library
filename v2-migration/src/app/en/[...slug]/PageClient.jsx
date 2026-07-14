"use client";
import { use, useEffect } from "react";
import { notFound, redirect } from "next/navigation";
import dynamic from "next/dynamic";

import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import GlobalModals from "@/components/GlobalModals";
import MobileToolNudge from "@/components/MobileToolNudge";
import DemoNoticeModal from "@/components/DemoNoticeModal";
import DmNudge from "@/components/DmNudge";

// 번역 완료된 도구만 실제로 렌더(routeMap EN_READY_TOOL_IDS 게이트 통과 후).
// 여기 케이스는 미리 준비해도 안전 — hasEnVersion()이 registry에 없는 id는
// redirect로 먼저 걸러내므로, 아직 번역 안 된 컴포넌트로는 절대 도달하지 않는다.
const dyn = (loader) => dynamic(loader, { loading: () => <div style={{ padding: "40px", color: "var(--text-muted)", fontSize: "13px" }}>Loading…</div> });
const Dashboard = dyn(() => import("@/components/Dashboard"));
const BudgetAllocation = dyn(() => import("@/components/tools/BudgetAllocation"));
const CampaignPvm = dyn(() => import("@/components/tools/CampaignPvm"));
const MarketingEfficiency = dyn(() => import("@/components/tools/MarketingEfficiency"));
const CreativeAnalyzer = dyn(() => import("@/components/tools/CreativeAnalyzer"));
const AbTestHoldout = dyn(() => import("@/components/tools/AbTestHoldout"));
const MarketingResponse = dyn(() => import("@/components/tools/MarketingResponse"));
const AhaMomentFinder = dyn(() => import("@/components/tools/AhaMomentFinder"));
const Incrementality = dyn(() => import("@/components/tools/Incrementality"));

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

            {routeId === "5-2" && <Dashboard locale="en" />}
            {routeId === "5-3" && <BudgetAllocation locale="en" />}
            {routeId === "5-21" && <CampaignPvm locale="en" />}
            {routeId === "5-22" && <MarketingEfficiency locale="en" />}
            {routeId === "5-6" && <CreativeAnalyzer locale="en" />}
            {routeId === "5-4" && <AbTestHoldout locale="en" />}
            {routeId === "5-18" && <MarketingResponse locale="en" />}
            {routeId === "5-20" && <AhaMomentFinder locale="en" />}
            {routeId === "5-23" && <Incrementality locale="en" />}
          </article>
        </main>
      </div>
      {(routeId.startsWith("5-") || routeId.startsWith("9-")) && <DemoNoticeModal locale="en" />}
      {(routeId.startsWith("5-") || routeId.startsWith("9-")) && <DmNudge locale="en" />}
      <GlobalModals locale="en" />
    </>
  );
}
