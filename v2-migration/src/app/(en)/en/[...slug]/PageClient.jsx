"use client";
import ToolRecipeWorkspace from "@/components/ds/ToolRecipeWorkspace";
import AnalysisSetupBar from "@/components/ds/AnalysisSetupBar";
import { use, useLayoutEffect } from "react";
import { notFound, redirect, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";

import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import GlobalModals from "@/components/GlobalModals";
import StartGate from "@/components/StartGate";
import ProjectsPage from "@/components/ProjectsPage";
import SubscriptionPage from "@/components/SubscriptionPage";
import WorkspaceStoragePage from "@/components/WorkspaceStoragePage";
import MyAccountPage from "@/components/MyAccountPage";
import DochiResultWorkspace from "@/components/assistant/DochiResultWorkspace";
import MobileToolNudge from "@/components/MobileToolNudge";
import BlogArrivalStrip from "@/components/blog/BlogArrivalStrip";
import UiSemantics from "@/components/ds/UiSemantics";
import GuideAnswer from "@/components/GuideAnswer";
import ToolIntro from "@/components/ToolIntro";
import ToolPageOutro from "@/components/ToolPageOutro";
import { RESPONSE_SUBTOOL_IDS, isResponseSubtool } from "@/lib/responseSubtoolContent";

// 번역 완료된 도구만 실제로 렌더(routeMap EN_READY_TOOL_IDS 게이트 통과 후).
// 여기 케이스는 미리 준비해도 안전 — hasEnVersion()이 registry에 없는 id는
// redirect로 먼저 걸러내므로, 아직 번역 안 된 컴포넌트로는 절대 도달하지 않는다.
const dyn = (loader) => dynamic(loader, { loading: () => <div style={{ padding: "40px", color: "var(--text-muted)", fontSize: "var(--fs-sm)" }}>Loading…</div> });
const Dashboard = dyn(() => import("@/components/Dashboard"));
const BudgetAllocation = dyn(() => import("@/components/tools/BudgetAllocation"));
const CampaignPvm = dyn(() => import("@/components/tools/CampaignPvm"));
const MarketingEfficiency = dyn(() => import("@/components/tools/MarketingEfficiency"));
const ContentFreshness = dyn(() => import("@/components/tools/ContentFreshness"));
const AbTestHoldout = dyn(() => import("@/components/tools/AbTestHoldout"));
const MarketingResponse = dyn(() => import("@/components/tools/MarketingResponse"));
const PaidOrganicTrend = dyn(() => import("@/components/tools/PaidOrganicTrend"));
const AhaMomentFinder = dyn(() => import("@/components/tools/AhaMomentFinder"));
const Incrementality = dyn(() => import("@/components/tools/Incrementality"));
const BrandCampaignIncrementality = dyn(() => import("@/components/tools/BrandCampaignIncrementality"));
const MulticollinearityChecker = dyn(() => import("@/components/tools/MulticollinearityChecker"));
const AsoStoreConversion = dyn(() => import("@/components/tools/AsoStoreConversion"));
const AsaKeywordFinder = dyn(() => import("@/components/tools/AsaKeywordFinder"));
const SubscriptionSurvivalAnalysis = dyn(() => import("@/components/tools/SubscriptionSurvivalAnalysis"));
const SegmentCompositionChange = dyn(() => import("@/components/tools/SegmentCompositionChange"));
const MultitouchMap = dyn(() => import("@/components/tools/MultitouchMap"));
const CannibalDetail = dyn(() => import("@/components/tools/CannibalDetail"));
const ContentElementAnalyzer = dyn(() => import("@/components/tools/ContentElementAnalyzer"));
// EN 가이드(1-x~4-x, EN_READY_GUIDE_IDS) — {id}.en.json 기반 SopContent EN 경로.
// 1-1·8-1은 리터럴 라우트가 우선이라 여기로 안 오지만, 방어적으로 함께 커버.
const SopContent = dyn(() => import("@/components/sops/SopContent"));
const CUSTOM_TOOL_INTRO_IDS = new Set(["5-4", "5-18", "5-20", "5-23", "5-24", "5-25", "5-26", "5-27", "5-28", "5-29", "9-1", "9-6", ...RESPONSE_SUBTOOL_IDS.filter((id) => id !== "5-18-paid-organic")]);

import { useAppStore } from "@/store/useDataStore";
import { resolveSlugToId, hasEnVersion, idToPath } from "@/lib/routeMap";
import { resolveResponseStage } from "@/lib/responseStage";

export default function PageClient({ params, initialSopData = null, evidenceLinks = [] }) {
  const { slug } = use(params);
  const routeId = resolveSlugToId(slug);
  const responseStage = resolveResponseStage(useSearchParams().get("stage"));
  const isResponseSubtoolRoute = isResponseSubtool(routeId);

  // Unknown URL -> 404. Known but untranslated -> KR canonical (thin/half-EN
  // page never gets served or indexed — §plan EN_READY_TOOL_IDS gate).
  if (routeId === null) notFound();
  if (!hasEnVersion(routeId)) redirect(idToPath(routeId));

  const setCurrentRouteId = useAppStore((state) => state.setCurrentRouteId);
  // Keep the URL-derived data group in sync before the first interactive paint.
  // A normal effect leaves a small window where a fast upload writes to the
  // previous route's CSV group and disappears when the mirror swaps.
  useLayoutEffect(() => {
    if (useAppStore.getState().currentRouteId !== routeId) {
      setCurrentRouteId(routeId);
    }
  }, [routeId, setCurrentRouteId]);

  return (
    <>
      <div className={`app ${routeId.startsWith("5-") || routeId.startsWith("9-") ? "is-analysis" : ""}`}>
        <Sidebar locale="en" />
        <div className="main">
          <Header locale="en" />
          <main id="main-content" tabIndex="-1">
            <article className="content" id="content">
            {/* 블로그 예시에서 넘어온 방문의 첫 줄(시안 E) — 모달 대신 출처와 두 갈래만. */}
            {(routeId.startsWith("5-") || routeId.startsWith("9-")) && <BlogArrivalStrip routeId={routeId} locale="en" />}
            {(routeId.startsWith("5-") || routeId.startsWith("9-")) && <AnalysisSetupBar toolId={routeId} locale="en" slot="context" />}
            {(routeId.startsWith("5-") || routeId.startsWith("9-")) && <MobileToolNudge locale="en" />}
            {CUSTOM_TOOL_INTRO_IDS.has(routeId) && <ToolIntro toolId={routeId} locale="en" />}

            {routeId === "start-gate" && <StartGate locale="en" />}
            {routeId === "projects" && <ProjectsPage locale="en" />}
            {routeId === "subscription" && <SubscriptionPage locale="en" />}
            {routeId === "storage" && <WorkspaceStoragePage locale="en" />}
            {routeId === "account" && <MyAccountPage locale="en" />}
            {routeId === "dochi-result" && <DochiResultWorkspace locale="en" />}
            {routeId === "5-2" && <Dashboard locale="en" />}
            {routeId === "5-3" && <BudgetAllocation locale="en" />}
            {routeId === "5-21" && <CampaignPvm locale="en" />}
            {routeId === "5-22" && <MarketingEfficiency locale="en" />}
            {routeId === "9-6" && <ToolRecipeWorkspace toolId="9-6" locale="en"><ContentFreshness locale="en" /></ToolRecipeWorkspace>}
            {routeId === "5-4" && <ToolRecipeWorkspace toolId="5-4" locale="en"><AbTestHoldout locale="en" /></ToolRecipeWorkspace>}
            {routeId === "5-18" && <MarketingResponse key={`marketing-response-${responseStage}`} locale="en" initialStage={responseStage} isolated={responseStage !== "hub"} />}
            {routeId === "5-18-paid-organic" && <ToolRecipeWorkspace toolId="5-18-paid-organic" locale="en"><PaidOrganicTrend locale="en" /></ToolRecipeWorkspace>}
            {routeId === "5-18-trend" && <ToolRecipeWorkspace toolId="5-18-trend" locale="en"><MarketingResponse locale="en" initialStage="trend" isolated /></ToolRecipeWorkspace>}
            {routeId === "5-18-cannibal" && <ToolRecipeWorkspace toolId="5-18-cannibal" locale="en"><MarketingResponse locale="en" initialStage="diagnose" isolated /></ToolRecipeWorkspace>}
            {routeId === "5-18-cannibal-detail" && <ToolRecipeWorkspace toolId="5-18-cannibal-detail" locale="en"><CannibalDetail locale="en" /></ToolRecipeWorkspace>}
            {routeId === "5-30" && <ToolRecipeWorkspace toolId="5-30" locale="en"><MultitouchMap locale="en" /></ToolRecipeWorkspace>}
            {routeId === "5-18-mmm" && <ToolRecipeWorkspace toolId="5-18-mmm" locale="en"><MarketingResponse locale="en" initialStage="mmm" isolated /></ToolRecipeWorkspace>}
            {routeId === "5-18-forecast" && <ToolRecipeWorkspace toolId="5-18-forecast" locale="en"><MarketingResponse locale="en" initialStage="lab" isolated /></ToolRecipeWorkspace>}
            {routeId === "5-20" && <ToolRecipeWorkspace toolId="5-20" locale="en"><AhaMomentFinder locale="en" /></ToolRecipeWorkspace>}
            {routeId === "5-23" && <ToolRecipeWorkspace toolId="5-23" locale="en"><Incrementality locale="en" /></ToolRecipeWorkspace>}
            {routeId === "5-24" && <ToolRecipeWorkspace toolId="5-24" locale="en"><BrandCampaignIncrementality locale="en" /></ToolRecipeWorkspace>}
            {routeId === "5-25" && <ToolRecipeWorkspace toolId="5-25" locale="en"><MulticollinearityChecker locale="en" /></ToolRecipeWorkspace>}
            {routeId === "5-27" && <ToolRecipeWorkspace toolId="5-27" locale="en"><AsoStoreConversion locale="en" /></ToolRecipeWorkspace>}
            {routeId === "5-26" && <ToolRecipeWorkspace toolId="5-26" locale="en"><AsaKeywordFinder locale="en" /></ToolRecipeWorkspace>}
            {routeId === "5-28" && <ToolRecipeWorkspace toolId="5-28" locale="en"><SubscriptionSurvivalAnalysis locale="en" /></ToolRecipeWorkspace>}
            {routeId === "5-29" && <ToolRecipeWorkspace toolId="5-29" locale="en"><SegmentCompositionChange locale="en" /></ToolRecipeWorkspace>}
            {routeId === "9-1" && <ToolRecipeWorkspace toolId="9-1" locale="en"><ContentElementAnalyzer locale="en" /></ToolRecipeWorkspace>}
            {/^[1-4]-|^8-/.test(routeId) && <>
              {/* 가이드가 답하는 질문·한 문장 답은 본문 위, 접기 바깥(§12.29). */}
              <GuideAnswer guideId={routeId} locale="en" />
              <SopContent routeId={routeId} locale="en" initialData={initialSopData} />
            </>}
            {/* KR과 동일한 하단 마감 계층(§12.30) */}
            {(routeId.startsWith("5-") || routeId.startsWith("9-")) && <AnalysisSetupBar toolId={routeId} locale="en" slot="actions" />}
            {/* 설정 저장·보관함은 결과 뒤에 둔다. 분석 전에 "설정 저장"을 물을
                이유가 없고, 맨 위에 있으면 결론을 본 사용자에게는 화면 밖이다. */}
            {routeId !== "dochi-result" && !["storage", "projects", "subscription"].includes(routeId) && <ToolPageOutro
              toolId={routeId}
              locale="en"
              evidenceLinks={evidenceLinks}
              withConnections={(routeId.startsWith("5-") || routeId.startsWith("9-")) && !isResponseSubtoolRoute}
            />}
            </article>
          </main>
        </div>
      </div>
      <GlobalModals locale="en" />
      <UiSemantics />
    </>
  );
}
