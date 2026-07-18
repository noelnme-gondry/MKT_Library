import Link from "next/link";
import { getAllPosts } from "@/lib/blog";
import { SITE_URL } from "@/lib/routeMap";

// EN 블로그 목록 — KR /blog/page.js 미러. content/blog-en에서 읽음(getAllPosts("en")).
// 태그 랜딩은 EN 미구현(§12.24 최소 범위) — 목록에 태그 텍스트만 표시, 링크 없음.
export async function generateMetadata() {
  const title = "Blog";
  const description =
    "Performance marketing and data analysis insights — campaign optimization, budget allocation, A/B testing, and MMM practice.";
  const canonical = `${SITE_URL}/en/blog`;
  return {
    title,
    description,
    alternates: { canonical, languages: { ko: `${SITE_URL}/blog`, en: canonical } },
    openGraph: { title, description, url: canonical, images: [`${SITE_URL}/og-card.png`] },
  };
}

function fmtDate(d) {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function buildBlogListJsonLd(posts) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Blog",
        "@id": `${SITE_URL}/en/blog#blog`,
        url: `${SITE_URL}/en/blog`,
        name: "Growth Ops Playbook Blog",
        description: "Performance marketing and data analysis insights",
        inLanguage: "en-US",
        blogPost: posts.slice(0, 20).map((p) => ({
          "@type": "BlogPosting",
          headline: p.title,
          description: p.description,
          datePublished: p.date || undefined,
          url: `${SITE_URL}/en/blog/${p.slug}`,
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_URL}/en/blog` },
        ],
      },
    ],
  };
}

export default function EnBlogIndexPage() {
  const posts = getAllPosts("en");

  return (
    <div className="page-inner" style={{ maxWidth: 860, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildBlogListJsonLd(posts)) }}
      />
      <header style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
          Blog
        </h1>
        <p style={{ marginTop: "0.5rem", fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          Performance marketing and data analysis insights.
        </p>
      </header>

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
            No posts published yet
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Marketing insights coming soon.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/en/blog/${post.slug}`}
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
