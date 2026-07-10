import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllPosts, getPostBySlug, tagSlug } from "@/lib/blog";
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
      // opengraph-image.js(파일 컨벤션)가 1200×630 카드를 자동 주입 → 항상 큰 카드.
      card: "summary_large_image",
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

// 본문 HTML에서 <img src> 절대경로 목록 추출(BlogPosting.image용 — 리치결과에 썸네일).
function extractImages(html) {
  const out = [];
  const re = /<img[^>]+src="([^"]+)"/g;
  let m;
  while ((m = re.exec(html || ""))) {
    const src = m[1];
    out.push(src.startsWith("http") ? src : SITE_URL + src);
  }
  return out;
}

// 글별 구조화 데이터(JSON-LD) — BlogPosting(리치결과) + BreadcrumbList(빵부스러기).
// SSR로 초기 HTML에 포함돼 크롤러가 즉시 파싱.
function buildPostJsonLd(post, canonical) {
  const publisher = {
    "@type": "Organization",
    name: "Growth Opt Playbook",
    url: `${SITE_URL}/`,
    logo: { "@type": "ImageObject", url: `${SITE_URL}/og-card.png` },
  };
  const images = extractImages(post.html);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        headline: post.title,
        description: post.description,
        datePublished: post.date || undefined,
        dateModified: post.date || undefined,
        author: publisher,
        publisher,
        mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
        url: canonical,
        inLanguage: "ko-KR",
        ...(post.keywords ? { keywords: post.keywords } : {}),
        ...(images.length ? { image: images } : {}),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "홈", item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: "블로그", item: `${SITE_URL}/blog` },
          { "@type": "ListItem", position: 3, name: post.title, item: canonical },
        ],
      },
    ],
  };
}

export default async function BlogPostPage({ params }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const canonical = `${SITE_URL}/blog/${post.slug}`;

  return (
    <div className="page-inner" style={{ maxWidth: 760, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildPostJsonLd(post, canonical)) }}
      />
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
            <Link key={t} href={`/blog/tag/${tagSlug(t)}`} style={{ color: "inherit", textDecoration: "none" }}>
              #{t}
            </Link>
          ))}
        </div>
      </header>

      <article className="blog-prose" dangerouslySetInnerHTML={{ __html: post.html }} />
    </div>
  );
}
