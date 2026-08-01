import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllPosts, getPostBySlug } from "@/lib/blog";
import { SITE_URL } from "@/lib/routeMap";
import ContentActionPanel from "@/components/seo/ContentActionPanel";
import EditorialTrust from "@/components/seo/EditorialTrust";
import NewsletterSignup from "@/components/seo/NewsletterSignup";

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
  const languages = { en: canonical, ...(koPost ? { ko: `${SITE_URL}/blog/${slug}` } : {}), "x-default": koPost ? `${SITE_URL}/blog/${slug}` : canonical };

  const og = {
    type: "article",
    title: post.title,
    description: post.description,
    url: canonical,
    publishedTime: post.date || undefined,
    modifiedTime: post.updated || post.date || undefined,
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

function splitAtContentAction(html) {
  const marker = "<!-- CONTENT_ACTION -->";
  const index = String(html || "").indexOf(marker);
  if (index < 0) return { before: html, after: "" };
  return {
    before: html.slice(0, index),
    after: html.slice(index + marker.length),
  };
}

function buildPostJsonLd(post, canonical) {
  const publisher = {
    "@type": "Organization",
    name: "Growth Opt Playbook",
    url: `${SITE_URL}/`,
    logo: { "@type": "ImageObject", url: `${SITE_URL}/favicon.svg` },
  };
  const images = extractImages(post.html);
  const articleImages = images.length ? images : [`${canonical}/opengraph-image`];
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
        dateModified: post.reviewedAt || post.updated || post.date || undefined,
        author: publisher,
        publisher,
        mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
        url: canonical,
        inLanguage: "en-US",
        articleSection: post.tags,
        ...(post.keywords ? { keywords: post.keywords } : {}),
        ...(post.sources.length ? { citation: post.sources.map((source) => source.url) } : {}),
        image: articleImages,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/en` },
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
  const article = splitAtContentAction(post.html);

  return (
    <div className="content-article">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildPostJsonLd(post, canonical)) }}
      />
      <Link href="/en/blog" className="content-article__back">
        ← Blog
      </Link>

      <header className="content-article__header">
        <span className="content-article__type">FIELD NOTE</span>
        <h1>
          {post.title}
        </h1>
        {!post.seoAnswer && post.description && <p className="content-article__dek">{post.description}</p>}
        {post.seoAnswer && (
          <aside className="content-answer" aria-label="Short answer to the search question">
            <span className="content-answer__label">{post.searchIntent || "Short answer"}</span>
            <p>{post.seoAnswer}</p>
          </aside>
        )}
        <div className="content-article__meta">
          <span className="content-article__byline">Growth Opt Playbook Editorial</span>
          <span>{fmtDate(post.date)}</span>
          {post.updated && post.updated !== post.date && <span>Updated {fmtDate(post.updated)}</span>}
          {post.tags.map((t) => (
            <span key={t}>#{t}</span>
          ))}
        </div>
      </header>

      <article className="blog-prose">
        <div dangerouslySetInnerHTML={{ __html: article.before }} />
        {article.after && <ContentActionPanel locale="en" toolId={post.primaryTool} post={post} placement="article_mid" />}
        <div dangerouslySetInnerHTML={{ __html: article.after }} />
      </article>

      <ContentActionPanel locale="en" toolId={post.primaryTool} post={post} />

      <EditorialTrust
        locale="en"
        conditions={post.conditions}
        reviewer={post.reviewer}
        reviewedAt={post.reviewedAt}
        sources={post.sources}
      />

      <NewsletterSignup locale="en" placement="post" />

      {post.relatedGlossary.length > 0 && (
        <nav className="content-related-links" aria-label="Related glossary terms">
          <span>Related terms</span>
          {post.relatedGlossary.map((slug) => <Link key={slug} href={`/en/glossary/${slug}`}>{slug}</Link>)}
        </nav>
      )}

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
