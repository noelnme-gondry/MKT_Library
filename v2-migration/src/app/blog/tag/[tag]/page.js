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
    openGraph: { title, description, url: canonical },
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
    <div className="page-inner" style={{ maxWidth: 860, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <Link href="/blog" style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}>
        ← 블로그 전체
      </Link>
      <header style={{ margin: "1rem 0 2rem" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
          #{label}
        </h1>
        <p style={{ marginTop: "0.5rem", fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          &lsquo;{label}&rsquo; 태그의 글 {posts.length}편
        </p>
      </header>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
        {posts.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="card"
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
