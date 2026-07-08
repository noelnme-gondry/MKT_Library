// 블로그 라우트(/blog·/blog/[slug]) 공용 셸 — 메인 앱 셸(Sidebar/Header)이 없는
// 독립 라우트라 홈 이동·테마 토글이 빠져 있었음. 슬림 BlogHeader로 보완.
import BlogHeader from "@/components/BlogHeader";

export default function BlogLayout({ children }) {
  return (
    <>
      <BlogHeader />
      <main className="main">{children}</main>
    </>
  );
}
