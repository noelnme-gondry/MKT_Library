import Link from "next/link";
import { getAllPosts, getAllTags } from "@/lib/blog";
import { SITE_URL } from "@/lib/routeMap";

export async function generateMetadata() {
  const title = "블로그";
  const description =
    "퍼포먼스 마케팅·데이터 분석 인사이트. 캠페인 최적화, 예산 배분, A/B 테스트, MMM 실무 노하우를 정리합니다.";
  const canonical = `${SITE_URL}/blog`;
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

export default function BlogIndexPage() {
  const posts = getAllPosts();
  const tags = getAllTags();

  return (
    <div className="page-inner" style={{ maxWidth: 860, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <header style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
          블로그
        </h1>
        <p style={{ marginTop: "0.5rem", fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          퍼포먼스 마케팅과 데이터 분석 인사이트를 정리합니다.
        </p>
      </header>

      {tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "1.75rem" }}>
          {tags.map((t) => (
            <Link
              key={t.slug}
              href={`/blog/tag/${t.slug}`}
              className="chip"
              style={{ textDecoration: "none", cursor: "pointer" }}
            >
              #{t.tag} <span style={{ opacity: 0.6 }}>{t.count}</span>
            </Link>
          ))}
        </div>
      )}

      {posts.length === 0 ? (
        <div
          className="block"
          style={{
            padding: "2.5rem 1.5rem",
            textAlign: "center",
            borderRadius: "var(--radius-xl)",
            border: "1px solid var(--border-subtle)",
            background: "var(--surface-container-lowest)",
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.4rem" }}>
            아직 발행된 글이 없습니다
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            곧 마케팅 인사이트를 올립니다.
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="card"
              style={{ display: "block", textDecoration: "none" }}
            >
              <div className="card-meta" style={{ marginBottom: "0.4rem" }}>
                {fmtDate(post.date)}
              </div>
              <div className="card-title">{post.title}</div>
              {post.description && <div className="card-desc">{post.description}</div>}
              {post.tags.length > 0 && (
                <div className="card-meta">
                  {post.tags.map((t) => (
                    <span key={t}>#{t}</span>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
