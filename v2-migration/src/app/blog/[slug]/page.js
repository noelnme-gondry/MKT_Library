import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllPosts, getPostBySlug } from "@/lib/blog";
import { SITE_URL } from "@/lib/routeMap";

// 발행 글만 정적 생성. 0편이면 빈 배열(라우트 미생성) — 빌드 정상 통과.
export function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};

  const canonical = `${SITE_URL}/blog/${post.slug}`;
  const og = {
    type: "article",
    title: post.title,
    description: post.description,
    url: canonical,
    publishedTime: post.date || undefined,
    ...(post.ogImage ? { images: [post.ogImage] } : {}),
  };
  return {
    title: post.title,
    description: post.description,
    keywords: post.keywords || undefined,
    alternates: { canonical },
    openGraph: og,
    twitter: {
      card: post.ogImage ? "summary_large_image" : "summary",
      title: post.title,
      description: post.description,
    },
  };
}

function fmtDate(d) {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}

export default async function BlogPostPage({ params }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  return (
    <div className="page-inner" style={{ maxWidth: 760, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <Link
        href="/blog"
        style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}
      >
        ← 블로그
      </Link>

      <header style={{ margin: "1rem 0 1.75rem", paddingBottom: "1.25rem", borderBottom: "1px solid var(--border-subtle)" }}>
        <h1 style={{ fontSize: 30, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.01em", lineHeight: 1.25 }}>
          {post.title}
        </h1>
        <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.75rem", flexWrap: "wrap", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)" }}>
          <span>{fmtDate(post.date)}</span>
          {post.tags.map((t) => (
            <span key={t}>#{t}</span>
          ))}
        </div>
      </header>

      <article className="blog-prose" dangerouslySetInnerHTML={{ __html: post.html }} />
    </div>
  );
}
