"use client";
import { use, useEffect } from "react";
import { notFound, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";

import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import GlobalModals from "@/components/GlobalModals";
import SopContent from "@/components/sops/SopContent";
import GuideIndex from "@/components/GuideIndex";
import StartGate from "@/components/StartGate";
import LandingPage from "@/components/LandingPage";
import MobileToolNudge from "@/components/MobileToolNudge";
import DemoNoticeModal from "@/components/DemoNoticeModal";
import DmNudge from "@/components/DmNudge";
import UiSemantics from "@/components/ds/UiSemantics";
import ToolIntro from "@/components/ToolIntro";
import ToolPageOutro from "@/components/ToolPageOutro";
import ToolAssistRail from "@/components/ToolAssistRail";
import { RESPONSE_SUBTOOL_IDS, isResponseSubtool } from "@/lib/responseSubtoolContent";

// 도구는 무겁고(Chart.js·XLSX·PapaParse) 라우트별로 하나만 필요 → next/dynamic으로
// 코드 분할. 정적 import 시 홈 포함 모든 경로가 앱 전체 JS(~1MB)를 최초 로드해
// 초기 로딩이 느렸음. 각 도구는 해당 라우트 진입 시에만 청크 로드.
const dyn = (loader) => dynamic(loader, { loading: () => <div style={{ padding: "40px", color: "var(--text-muted)", fontSize: "13px" }}>로딩 중…</div> });
const Dashboard = dyn(() => import("@/components/Dashboard"));
const BudgetAllocation = dyn(() => import("@/components/tools/BudgetAllocation"));
const CampaignPvm = dyn(() => import("@/components/tools/CampaignPvm"));
const AbTestHoldout = dyn(() => import("@/components/tools/AbTestHoldout"));
const MarketingResponse = dyn(() => import("@/components/tools/MarketingResponse"));
const PaidOrganicTrend = dyn(() => import("@/components/tools/PaidOrganicTrend"));
const AhaMomentFinder = dyn(() => import("@/components/tools/AhaMomentFinder"));
const MarketingEfficiency = dyn(() => import("@/components/tools/MarketingEfficiency"));
const Incrementality = dyn(() => import("@/components/tools/Incrementality"));
const BrandCampaignIncrementality = dyn(() => import("@/components/tools/BrandCampaignIncrementality"));
const MulticollinearityChecker = dyn(() => import("@/components/tools/MulticollinearityChecker"));
const AsaKeywordFinder = dyn(() => import("@/components/tools/AsaKeywordFinder"));
// Content Analytics (콘텐츠 도메인 — 엔진 재사용, 라벨만 신규)
const ContentElementAnalyzer = dyn(() => import("@/components/tools/ContentElementAnalyzer"));
const KillerContentFinder = dyn(() => import("@/components/tools/KillerContentFinder"));
const ContentTrafficVariance = dyn(() => import("@/components/tools/ContentTrafficVariance"));
const ContentFreshness = dyn(() => import("@/components/tools/ContentFreshness"));
const ContentDashboard = dyn(() => import("@/components/tools/ContentDashboard"));
const CUSTOM_TOOL_INTRO_IDS = new Set(["5-3", "5-4", "5-18", "5-20", "5-23", "5-24", "5-25", "5-26", "9-1", "9-6", ...RESPONSE_SUBTOOL_IDS.filter((id) => id !== "5-18-paid-organic")]);

import { useAppStore } from "@/store/useDataStore";
import { resolveSlugToId } from "@/lib/routeMap";
import { resolveResponseStage } from "@/lib/responseStage";

export default function PageClient({ params, evidenceLinks = [] }) {
  // Next 16: params is a Promise. On the root "/" the optional catch-all gives
  // slug = undefined; on any nested path it's a string[].
  const { slug } = use(params);
  const routeId = resolveSlugToId(slug);
  const responseStage = resolveResponseStage(useSearchParams().get("stage"));
  const isResponseSubtoolRoute = isResponseSubtool(routeId);

  // Unknown URL -> 404 (must run before any dispatch that assumes a valid id).
  if (routeId === null) notFound();

  // Mirror the URL-derived id into the module-level Zustand store so components
  // that still read store.currentRouteId (tool internals) stay in sync on every
  // navigation, incl. browser back/forward. Store is NOT the render source here.
  const setCurrentRouteId = useAppStore((state) => state.setCurrentRouteId);
  useEffect(() => {
    if (useAppStore.getState().currentRouteId !== routeId) {
      setCurrentRouteId(routeId);
    }
  }, [routeId, setCurrentRouteId]);

  return (
    <>
      <div className={`app ${routeId === "home" ? "is-home" : ""} ${routeId.startsWith("5-") || routeId.startsWith("9-") ? "is-analysis" : ""}`}>
        <Sidebar />
        <div className="main">
          <Header />
          <main id="main-content" tabIndex="-1">
            <article className="content" id="content">
            {/* 모바일 안내 배너: 대시보드+전 분석 도구(5-x·9-x)만, 블로그/랜딩/SOP 제외 */}
            {(routeId.startsWith("5-") || routeId.startsWith("9-")) && <MobileToolNudge />}
            {CUSTOM_TOOL_INTRO_IDS.has(routeId) && <ToolIntro toolId={routeId} />}

            {/* 라우팅: URL에서 해석한 routeId 기준 직접 디스패치 (스토어 비의존 → 첫 페인트 플래시 없음) */}
            {routeId === "home" && <LandingPage />}
            {routeId === "guide-index" && <GuideIndex />}
            {routeId === "start-gate" && <StartGate />}

            {routeId === "5-2" && <Dashboard />}
            {routeId === "5-3" && <BudgetAllocation />}
            {routeId === "5-21" && <CampaignPvm />}
            {routeId === "5-22" && <MarketingEfficiency />}
            {routeId === "5-4" && <AbTestHoldout />}
            {routeId === "5-18" && <MarketingResponse key={`marketing-response-${responseStage}`} initialStage={responseStage} isolated={responseStage !== "hub"} />}
            {routeId === "5-18-paid-organic" && <PaidOrganicTrend />}
            {routeId === "5-18-trend" && <MarketingResponse initialStage="trend" isolated />}
            {routeId === "5-18-cannibal" && <MarketingResponse initialStage="diagnose" isolated />}
            {routeId === "5-18-mmm" && <MarketingResponse initialStage="mmm" isolated />}
            {routeId === "5-18-forecast" && <MarketingResponse initialStage="lab" isolated />}
            {routeId === "5-20" && <AhaMomentFinder />}
            {routeId === "5-23" && <Incrementality />}
            {routeId === "5-24" && <BrandCampaignIncrementality />}
            {routeId === "5-25" && <MulticollinearityChecker />}
            {routeId === "5-26" && <AsaKeywordFinder />}

            {routeId === "9-1" && <ContentElementAnalyzer />}
            {routeId === "9-2" && <KillerContentFinder />}
            {routeId === "9-3" && <ContentTrafficVariance />}
            {routeId === "9-6" && <ContentFreshness />}
            {routeId === "9-7" && <ContentDashboard />}

            {/* SOP 폴백: 도구 라우트(5-x·9-x)가 아닌 가이드 id만 SopContent로.
                9-x 콘텐츠 도구가 이 폴백으로 새어 SopContent로 렌더되던 함정 차단(§plan). */}
            {routeId !== "home" &&
             routeId !== "guide-index" &&
             routeId !== "start-gate" &&
             !routeId.startsWith("5-") &&
             !routeId.startsWith("9-") && (
              <SopContent routeId={routeId} />
            )}
            {/* 분석 결과 아래는 하나의 마감 박스로 묶는다 — 다음 단계·참고 자료·관련 글이
                결과와 같은 층위로 흐르지 않게(§12.30). */}
            <ToolPageOutro
              toolId={routeId}
              evidenceLinks={evidenceLinks}
              withConnections={(routeId.startsWith("5-") || routeId.startsWith("9-")) && !isResponseSubtoolRoute}
            />
            {(routeId.startsWith("5-") || routeId.startsWith("9-")) && !isResponseSubtoolRoute && <ToolAssistRail toolId={routeId} />}
            </article>
          </main>
        </div>
      </div>
      {/* 데모 데이터 안내 모달(세션 1회, 도구 진입 시) */}
      {(routeId.startsWith("5-") || routeId.startsWith("9-")) && <DemoNoticeModal />}
      {/* 데이터 준비를 어려워하는 유저용 1:1 상담 넛지(세션 1회, 스크롤 후 노출) */}
      {(routeId.startsWith("5-") || routeId.startsWith("9-")) && <DmNudge />}
      <GlobalModals />
      <UiSemantics />
    </>
  );
}
