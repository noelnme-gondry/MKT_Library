// EN 블로그 라우트(/en/blog·/en/blog/[slug]) 공용 셸 — KR /blog/layout.js와 동일 구조,
// BlogHeader locale="en"만 다름. 앱 본체는 여전히 한글 전용(§1) — 블로그만 이중 언어.
import BlogHeader from "@/components/BlogHeader";

export default function EnBlogLayout({ children }) {
  return (
    <>
      <BlogHeader locale="en" />
      <main className="main">{children}</main>
    </>
  );
}
