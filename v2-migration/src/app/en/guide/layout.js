// EN 가이드 라우트(/en/guide/*) 공용 셸 — 번역 완료된 가이드가 자동으로 나열되는
// 사이드바(EnGuideSidebar) + 슬림 헤더(EnLandingHeader). 사이드바 목록은
// src/lib/enGuides.js(fs 스캔, public/content/pages/*.en.json 존재 여부)로 자동
// 파생 — 가이드 번역이 늘어도 이 레이아웃은 그대로 둬도 됨(하드코딩 리스트 없음).
// /en 랜딩·/en/blog는 각자 별도 layout(또는 page 인라인)이라 이 사이드바의 영향을 받지 않는다.
import EnLandingHeader from "@/components/EnLandingHeader";
import EnGuideSidebar from "@/components/EnGuideSidebar";
import { listTranslatedGuides } from "@/lib/enGuides";

export default function EnGuideLayout({ children }) {
  const guides = listTranslatedGuides();

  return (
    <div className="app">
      <EnGuideSidebar guides={guides} />
      <main className="main">
        <EnLandingHeader />
        {children}
      </main>
    </div>
  );
}
