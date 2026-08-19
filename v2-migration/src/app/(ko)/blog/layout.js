// 블로그 라우트(/blog·/blog/[slug]) 공용 셸 — 도구·SOP와 동일한 메인 셸(Sidebar +
// 공용 Header + GlobalModals)로 통일. 예전 슬림 BlogHeader는 홈·테마만 있어 EN 토글·
// ⌘K가 빠져 도구 화면과 상단이 달랐음. Header가 /blog 경로를 감지해 "블로그" 크럼·
// 언어전환(/blog↔/en/blog)을 처리한다.
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import GlobalModals from "@/components/GlobalModals";
import AdSenseScript from "@/components/AdSenseScript";

export default function BlogLayout({ children }) {
  return (
    <>
      <AdSenseScript />
      <div className="app">
        <Sidebar />
        <div className="main">
          <Header />
          <main id="main-content" tabIndex="-1">{children}</main>
        </div>
      </div>
      <GlobalModals />
    </>
  );
}
