import Link from "next/link";
import { getAllPosts } from "@/lib/blog";
import { SITE_URL } from "@/lib/routeMap";
import { withOpenGraphBase } from "@/lib/openGraph";
import SearchTopicHub from "@/components/seo/SearchTopicHub";
import NewsletterSignup from "@/components/seo/NewsletterSignup";

// EN 블로그 목록 — KR /blog/page.js 미러. content/blog-en에서 읽음(getAllPosts("en")).
// 태그 랜딩은 EN 미구현(§12.24 최소 범위) — 목록에 태그 텍스트만 표시, 링크 없음.
export async function generateMetadata() {
  const title = "Performance Marketing Blog | CPA, ROAS & Budget Analysis";
  const description =
    "Practical guides for CPA, ROAS, budget allocation, creative fatigue, and incrementality — each connected to a free marketing analysis tool.";
  const canonical = `${SITE_URL}/en/blog`;
  return {
    title,
    description,
    alternates: { canonical, languages: { ko: `${SITE_URL}/blog`, en: canonical, "x-default": `${SITE_URL}/blog` } },
    openGraph: withOpenGraphBase({ title, description, url: canonical, images: [`${SITE_URL}/og-card.png`] }, "en"),
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
        name: "Growth Opt Playbook Blog",
        description: "Performance marketing and data analysis insights",
        inLanguage: "en-US",
        blogPost: posts.slice(0, 20).map((p) => ({
          "@type": "BlogPosting",
          headline: p.title,
          description: p.description,
          datePublished: p.date || undefined,
          dateModified: p.updated || p.date || undefined,
          url: `${SITE_URL}/en/blog/${p.slug}`,
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/en` },
          { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_URL}/en/blog` },
        ],
      },
    ],
  };
}

export default function EnBlogIndexPage() {
  const posts = getAllPosts("en");

  return (
    <div className="content-index">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildBlogListJsonLd(posts)) }}
      />
      <header className="content-index__hero">
        <span className="content-index__eyebrow">PERFORMANCE MARKETING FIELD NOTES</span>
        <h1>Turn a performance problem into the next action.</h1>
        <p>Practical notes for narrowing down CPA, ROAS, budget, creative, and measurement issues — then checking the answer with your own data.</p>
        <span className="content-index__meta">{posts.length} ARTICLES · BUILT FOR OPERATORS</span>
      </header>
      <SearchTopicHub locale="en" />
      <NewsletterSignup locale="en" placement="index" />

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
        <div className="content-list">
          {posts.map((post, index) => (
            <Link
              key={post.slug}
              href={`/en/blog/${post.slug}`}
              className={`card content-card${index === 0 ? " is-featured" : ""}`}
              style={{ display: "block", textDecoration: "none" }}
            >
              <div className="card-meta" style={{ marginBottom: "0.4rem" }}>
                {index === 0 && <span className="content-card__featured">EDITOR&apos;S PICK</span>}{fmtDate(post.date)}
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
