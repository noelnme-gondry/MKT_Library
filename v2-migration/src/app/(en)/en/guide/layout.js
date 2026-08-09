// EN 가이드 라우트(/en/guide·/en/guide/*) 공용 셸 — KR 가이드(메인 [[...slug]] 셸)와
// 동일하게 메인 Sidebar + 공용 Header + GlobalModals로 통일. 예전엔 전용 EnGuideSidebar
// +슬림 EnLandingHeader라 KR과 구조가 달랐음(EN 토글·⌘K 없음). 미번역 가이드는
// Sidebar 클릭 시 hasEnVersion=false → KR로(기존 규칙), 구조는 전 페이지 동일.
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import GlobalModals from "@/components/GlobalModals";

export default function EnGuideLayout({ children }) {
  return (
    <>
      <div className="app">
        <Sidebar locale="en" />
        <div className="main">
          <Header locale="en" />
          <main id="main-content" tabIndex="-1">{children}</main>
        </div>
      </div>
      <GlobalModals locale="en" />
    </>
  );
}
