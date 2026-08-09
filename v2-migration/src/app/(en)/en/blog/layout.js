// EN 블로그 라우트(/en/blog·/en/blog/[slug]) 공용 셸 — KR /blog/layout.js와 동일 구조,
// 공용 Header locale="en"만 다름. 도구·SOP와 상단 통일(EN 토글·⌘K 포함).
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import GlobalModals from "@/components/GlobalModals";
import Script from "next/script";

export default function EnBlogLayout({ children }) {
  return (
    <>
      <Script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3073450406371629" crossOrigin="anonymous" strategy="afterInteractive" />
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
