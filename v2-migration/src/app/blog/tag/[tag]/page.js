import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllTags, getPostsByTag, tagLabelFromSlug } from "@/lib/blog";
import { SITE_URL } from "@/lib/routeMap";

// 태그별 랜딩(롱테일 SEO 허브). 발행 글의 태그마다 정적 페이지 생성.
export function generateStaticParams() {
  return getAllTags().map((t) => ({ tag: t.slug }));
}

export async function generateMetadata({ params }) {
  const { tag } = await params;
  const label = tagLabelFromSlug(tag);
  const posts = getPostsByTag(tag);
  if (!posts.length) return {};
  const title = `${label} 관련 글`;
  const description = `'${label}' 태그가 달린 퍼포먼스 마케팅·데이터 분석 글 ${posts.length}편 모음.`;
  const canonical = `${SITE_URL}/blog/tag/${tag}`;
  return {
    title,
    description,
    alternates: { canonical },
    // 고유 해설 없는 1~2편 태그는 검색 가치가 낮다. 3편 이상 컬렉션만 색인한다.
    ...(posts.length < 3 ? { robots: { index: false, follow: true } } : {}),
    openGraph: { title, description, url: canonical, images: [`${SITE_URL}/og-card.png`] },
  };
}

function fmtDate(d) {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}

export default async function BlogTagPage({ params }) {
  const { tag } = await params;
  const posts = getPostsByTag(tag);
  if (!posts.length) notFound();
  const label = tagLabelFromSlug(tag);

  return (
    <div className="content-index content-index--tag">
      <Link href="/blog" className="content-article__back">
        ← 블로그 전체
      </Link>
      <header className="content-index__hero content-index__hero--compact">
        <span className="content-index__eyebrow">TOPIC COLLECTION</span>
        <h1>#{label}</h1>
        <p>&lsquo;{label}&rsquo;에 관한 실무 글 {posts.length}편을 한곳에 모았습니다.</p>
      </header>

      <div className="content-list">
        {posts.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="card content-card"
            style={{ display: "block", textDecoration: "none" }}
          >
            <div className="card-meta" style={{ marginBottom: "0.4rem" }}>{fmtDate(post.date)}</div>
            <div className="card-title">{post.title}</div>
            {post.description && <div className="card-desc">{post.description}</div>}
          </Link>
        ))}
      </div>
    </div>
  );
}
