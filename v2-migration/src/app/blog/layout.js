// 블로그 라우트(/blog·/blog/[slug]) 공용 셸 — 도구 화면과 통일감을 위해 메인 앱 셸의
// Sidebar를 함께 노출(.app 그리드). 상단은 블로그 전용 슬림 BlogHeader(브레드크럼·홈·
// 테마) 유지. Sidebar는 URL→currentRouteId 파생이라 블로그에선 활성 하이라이트 없이
// 안전하게 렌더.
import Sidebar from "@/components/Sidebar";
import BlogHeader from "@/components/BlogHeader";

export default function BlogLayout({ children }) {
  return (
    <div className="app">
      <Sidebar />
      <main className="main">
        <BlogHeader />
        {children}
      </main>
    </div>
  );
}
