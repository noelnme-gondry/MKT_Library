// EN 블로그 라우트(/en/blog·/en/blog/[slug]) 공용 셸 — KR /blog/layout.js와 동일 구조,
// 공용 Header locale="en"만 다름. 도구·SOP와 상단 통일(EN 토글·⌘K 포함).
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import GlobalModals from "@/components/GlobalModals";
import AdSenseScript from "@/components/AdSenseScript";

export default function EnBlogLayout({ children }) {
  return (
    <>
      <AdSenseScript />
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
