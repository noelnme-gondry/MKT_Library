import Link from "next/link";
import { getAllPosts, getAllTags } from "@/lib/blog";
import { SITE_URL } from "@/lib/routeMap";
import { withOpenGraphBase } from "@/lib/openGraph";
import SearchTopicHub from "@/components/seo/SearchTopicHub";
import NewsletterSignup from "@/components/seo/NewsletterSignup";

export async function generateMetadata() {
  const title = "퍼포먼스 마케팅 실무 블로그 | CPA·ROAS·예산 분석";
  const description =
    "CPA 하락, ROAS 개선, 광고 예산 배분, 소재 피로도, A/B 테스트를 실무 순서와 무료 분석 도구로 연결하는 퍼포먼스 마케팅 블로그입니다.";
  const canonical = `${SITE_URL}/blog`;
  return {
    title,
    description,
    alternates: { canonical, languages: { ko: canonical, en: `${SITE_URL}/en/blog`, "x-default": canonical } },
    openGraph: withOpenGraphBase({ title, description, url: canonical, images: [`${SITE_URL}/og-card.png`] }),
  };
}

function fmtDate(d) {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}

// 블로그 목록 구조화 데이터 — Blog(글 목록) + BreadcrumbList. ItemList로 글 순서 노출.
function buildBlogListJsonLd(posts) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Blog",
        "@id": `${SITE_URL}/blog#blog`,
        url: `${SITE_URL}/blog`,
        name: "Growth Opt Playbook 블로그",
        description: "퍼포먼스 마케팅·데이터 분석 인사이트",
        inLanguage: "ko-KR",
        blogPost: posts.slice(0, 20).map((p) => ({
          "@type": "BlogPosting",
          headline: p.title,
          description: p.description,
          datePublished: p.date || undefined,
          dateModified: p.updated || p.date || undefined,
          url: `${SITE_URL}/blog/${p.slug}`,
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "홈", item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: "블로그", item: `${SITE_URL}/blog` },
        ],
      },
    ],
  };
}

export default function BlogIndexPage() {
  const posts = getAllPosts();
  const tags = getAllTags();

  return (
    <div className="content-index">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildBlogListJsonLd(posts)) }}
      />
      <header className="content-index__hero">
        <span className="content-index__eyebrow">PERFORMANCE MARKETING FIELD NOTES</span>
        <h1>광고 성과 문제를<br />다음 조치로 바꾸는 실무 노트</h1>
        <p>CPA·ROAS·예산·소재·측정 문제를 원인부터 좁히는 글입니다. 읽은 다음에는 같은 질문을 무료 도구에서 내 데이터로 확인할 수 있습니다.</p>
        <span className="content-index__meta">{posts.length} ARTICLES · UPDATED FOR OPERATORS</span>
      </header>
      <SearchTopicHub />
      <NewsletterSignup placement="index" />

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
        <div className="content-list">
          {posts.map((post, index) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className={`card content-card${index === 0 ? " is-featured" : ""}`}
              style={{ display: "block", textDecoration: "none" }}
            >
              <div className="card-meta" style={{ marginBottom: "0.4rem" }}>
                {index === 0 && <span className="content-card__featured">이번 주 추천</span>}{fmtDate(post.date)}
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
