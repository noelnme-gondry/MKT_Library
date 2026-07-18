import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllPosts, getPostBySlug } from "@/lib/blog";
import { SITE_URL } from "@/lib/routeMap";

// EN 글 상세 — KR /blog/[slug]/page.js 미러(getAllPosts/getPostBySlug locale="en").
// hreflang: 같은 slug의 KR 파일이 있으면 alternates.languages로 상호 연결(§ blog-en 전략).
export function generateStaticParams() {
  return getAllPosts("en").map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const post = getPostBySlug(slug, "en");
  if (!post) return {};

  const canonical = `${SITE_URL}/en/blog/${post.slug}`;
  const koPost = getPostBySlug(slug, "ko");
  const languages = { en: canonical, ...(koPost ? { ko: `${SITE_URL}/blog/${slug}` } : {}) };

  const og = {
    type: "article",
    title: post.title,
    description: post.description,
    url: canonical,
    publishedTime: post.date || undefined,
    // images 미지정 시 opengraph-image.js(파일 컨벤션, 글별 동적 카드)가 자동 주입.
    ...(post.ogImage ? { images: [post.ogImage] } : {}),
  };
  return {
    title: post.title,
    description: post.description,
    keywords: post.keywords || undefined,
    alternates: { canonical, languages },
    openGraph: og,
    twitter: {
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
  return dt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

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

function buildPostJsonLd(post, canonical) {
  const publisher = {
    "@type": "Organization",
    name: "Growth Ops Playbook",
    url: `${SITE_URL}/`,
    logo: { "@type": "ImageObject", url: `${SITE_URL}/og-card.png` },
  };
  const images = extractImages(post.html);
  const faqNode = post.faq.length
    ? [
        {
          "@type": "FAQPage",
          mainEntity: post.faq.map((item) => ({
            "@type": "Question",
            name: item.q,
            acceptedAnswer: { "@type": "Answer", text: item.a },
          })),
        },
      ]
    : [];
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
        inLanguage: "en-US",
        ...(post.keywords ? { keywords: post.keywords } : {}),
        ...(images.length ? { image: images } : {}),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_URL}/en/blog` },
          { "@type": "ListItem", position: 3, name: post.title, item: canonical },
        ],
      },
      ...faqNode,
    ],
  };
}

export default async function EnBlogPostPage({ params }) {
  const { slug } = await params;
  const post = getPostBySlug(slug, "en");
  if (!post) notFound();

  const canonical = `${SITE_URL}/en/blog/${post.slug}`;

  return (
    <div className="page-inner" style={{ maxWidth: 760, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildPostJsonLd(post, canonical)) }}
      />
      <Link href="/en/blog" style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}>
        ← Blog
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

      {post.faq.length > 0 && (
        <section className="blog-faq" aria-label="Frequently asked questions">
          <h2>Frequently asked questions</h2>
          {post.faq.map((item, i) => (
            <details key={i} className="blog-faq-item">
              <summary>{item.q}</summary>
              <div className="blog-faq-item-answer">{item.a}</div>
            </details>
          ))}
        </section>
      )}
    </div>
  );
}
