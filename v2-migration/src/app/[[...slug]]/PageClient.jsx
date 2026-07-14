"use client";
import { use, useEffect } from "react";
import { notFound } from "next/navigation";
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

// 도구는 무겁고(Chart.js·XLSX·PapaParse) 라우트별로 하나만 필요 → next/dynamic으로
// 코드 분할. 정적 import 시 홈 포함 모든 경로가 앱 전체 JS(~1MB)를 최초 로드해
// 초기 로딩이 느렸음. 각 도구는 해당 라우트 진입 시에만 청크 로드.
const dyn = (loader) => dynamic(loader, { loading: () => <div style={{ padding: "40px", color: "var(--text-muted)", fontSize: "13px" }}>로딩 중…</div> });
const Dashboard = dyn(() => import("@/components/Dashboard"));
const BudgetAllocation = dyn(() => import("@/components/tools/BudgetAllocation"));
const CampaignPvm = dyn(() => import("@/components/tools/CampaignPvm"));
const CreativeAnalyzer = dyn(() => import("@/components/tools/CreativeAnalyzer"));
const AbTestHoldout = dyn(() => import("@/components/tools/AbTestHoldout"));
const MarketingResponse = dyn(() => import("@/components/tools/MarketingResponse"));
const AhaMomentFinder = dyn(() => import("@/components/tools/AhaMomentFinder"));
const MarketingEfficiency = dyn(() => import("@/components/tools/MarketingEfficiency"));
const Incrementality = dyn(() => import("@/components/tools/Incrementality"));
// Content Analytics (콘텐츠 도메인 — 엔진 재사용, 라벨만 신규)
const ContentElementAnalyzer = dyn(() => import("@/components/tools/ContentElementAnalyzer"));
const KillerContentFinder = dyn(() => import("@/components/tools/KillerContentFinder"));
const ContentTrafficVariance = dyn(() => import("@/components/tools/ContentTrafficVariance"));
const ContentFreshness = dyn(() => import("@/components/tools/ContentFreshness"));
const ContentDashboard = dyn(() => import("@/components/tools/ContentDashboard"));

import { useAppStore } from "@/store/useDataStore";
import { resolveSlugToId } from "@/lib/routeMap";

export default function PageClient({ params }) {
  // Next 16: params is a Promise. On the root "/" the optional catch-all gives
  // slug = undefined; on any nested path it's a string[].
  const { slug } = use(params);
  const routeId = resolveSlugToId(slug);

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
      <div className={`app ${routeId === "home" ? "is-home" : ""}`}>
        <Sidebar />
        <main className="main">
          <Header />
          <article className="content" id="content" aria-live="polite">
            {/* 모바일 안내 배너: 대시보드+전 분석 도구(5-x·9-x)만, 블로그/랜딩/SOP 제외 */}
            {(routeId.startsWith("5-") || routeId.startsWith("9-")) && <MobileToolNudge />}

            {/* 라우팅: URL에서 해석한 routeId 기준 직접 디스패치 (스토어 비의존 → 첫 페인트 플래시 없음) */}
            {routeId === "home" && <LandingPage />}
            {routeId === "guide-index" && <GuideIndex />}
            {routeId === "start-gate" && <StartGate />}

            {routeId === "5-2" && <Dashboard />}
            {routeId === "5-3" && <BudgetAllocation />}
            {routeId === "5-21" && <CampaignPvm />}
            {routeId === "5-22" && <MarketingEfficiency />}
            {routeId === "5-6" && <CreativeAnalyzer />}
            {routeId === "5-4" && <AbTestHoldout />}
            {routeId === "5-18" && <MarketingResponse />}
            {routeId === "5-20" && <AhaMomentFinder />}
            {routeId === "5-23" && <Incrementality />}

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
          </article>
        </main>
      </div>
      {/* 데모 데이터 안내 모달(세션 1회, 도구 진입 시) */}
      {(routeId.startsWith("5-") || routeId.startsWith("9-")) && <DemoNoticeModal />}
      {/* 데이터 준비 DM 유도 사이드 팝업: 도구(5-x·9-x)에서만, 데모 후 스크롤 시 우하단 */}
      {(routeId.startsWith("5-") || routeId.startsWith("9-")) && <DmNudge />}
      <GlobalModals />
    </>
  );
}
