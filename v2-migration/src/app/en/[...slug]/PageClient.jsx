"use client";
import { use, useEffect } from "react";
import { notFound, redirect } from "next/navigation";
import dynamic from "next/dynamic";

import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import GlobalModals from "@/components/GlobalModals";
import StartGate from "@/components/StartGate";
import MobileToolNudge from "@/components/MobileToolNudge";
import DemoNoticeModal from "@/components/DemoNoticeModal";
import DmNudge from "@/components/DmNudge";
import ToolIntro from "@/components/ToolIntro";

// 번역 완료된 도구만 실제로 렌더(routeMap EN_READY_TOOL_IDS 게이트 통과 후).
// 여기 케이스는 미리 준비해도 안전 — hasEnVersion()이 registry에 없는 id는
// redirect로 먼저 걸러내므로, 아직 번역 안 된 컴포넌트로는 절대 도달하지 않는다.
const dyn = (loader) => dynamic(loader, { loading: () => <div style={{ padding: "40px", color: "var(--text-muted)", fontSize: "13px" }}>Loading…</div> });
const Dashboard = dyn(() => import("@/components/Dashboard"));
const BudgetAllocation = dyn(() => import("@/components/tools/BudgetAllocation"));
const CampaignPvm = dyn(() => import("@/components/tools/CampaignPvm"));
const MarketingEfficiency = dyn(() => import("@/components/tools/MarketingEfficiency"));
const ContentFreshness = dyn(() => import("@/components/tools/ContentFreshness"));
const AbTestHoldout = dyn(() => import("@/components/tools/AbTestHoldout"));
const MarketingResponse = dyn(() => import("@/components/tools/MarketingResponse"));
const AhaMomentFinder = dyn(() => import("@/components/tools/AhaMomentFinder"));
const Incrementality = dyn(() => import("@/components/tools/Incrementality"));
const ContentElementAnalyzer = dyn(() => import("@/components/tools/ContentElementAnalyzer"));
// EN 가이드(1-x~4-x, EN_READY_GUIDE_IDS) — {id}.en.json 기반 SopContent EN 경로.
// 1-1·8-1은 리터럴 라우트가 우선이라 여기로 안 오지만, 방어적으로 함께 커버.
const SopContent = dyn(() => import("@/components/sops/SopContent"));
const CUSTOM_TOOL_INTRO_IDS = new Set(["5-4", "5-18", "5-20", "5-23", "9-1", "9-6"]);

import { useAppStore } from "@/store/useDataStore";
import { resolveSlugToId, hasEnVersion, idToPath } from "@/lib/routeMap";

export default function PageClient({ params, initialSopData = null }) {
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
      <div className={`app ${routeId.startsWith("5-") || routeId.startsWith("9-") ? "is-analysis" : ""}`}>
        <Sidebar locale="en" />
        <main className="main" id="main-content">
          <Header locale="en" />
          <article className="content" id="content">
            {(routeId.startsWith("5-") || routeId.startsWith("9-")) && <MobileToolNudge locale="en" />}
            {CUSTOM_TOOL_INTRO_IDS.has(routeId) && <ToolIntro toolId={routeId} locale="en" />}

            {routeId === "start-gate" && <StartGate locale="en" />}
            {routeId === "5-2" && <Dashboard locale="en" />}
            {routeId === "5-3" && <BudgetAllocation locale="en" />}
            {routeId === "5-21" && <CampaignPvm locale="en" />}
            {routeId === "5-22" && <MarketingEfficiency locale="en" />}
            {routeId === "9-6" && <ContentFreshness locale="en" />}
            {routeId === "5-4" && <AbTestHoldout locale="en" />}
            {routeId === "5-18" && <MarketingResponse locale="en" />}
            {routeId === "5-20" && <AhaMomentFinder locale="en" />}
            {routeId === "5-23" && <Incrementality locale="en" />}
            {routeId === "9-1" && <ContentElementAnalyzer locale="en" />}
            {/^[1-4]-|^8-/.test(routeId) && <SopContent routeId={routeId} locale="en" initialData={initialSopData} />}
          </article>
        </main>
      </div>
      {(routeId.startsWith("5-") || routeId.startsWith("9-")) && <DemoNoticeModal locale="en" />}
      {(routeId.startsWith("5-") || routeId.startsWith("9-")) && <DmNudge locale="en" />}
      <GlobalModals locale="en" />
    </>
  );
}
