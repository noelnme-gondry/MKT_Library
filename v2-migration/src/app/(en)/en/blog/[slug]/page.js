import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllPosts, getPostBySlug } from "@/lib/blog";
import { OG_CARD_URL, SITE_URL } from "@/lib/routeMap";
import { withOpenGraphBase } from "@/lib/openGraph";
import ContentActionPanel from "@/components/seo/ContentActionPanel";
import NewsletterSignup from "@/components/seo/NewsletterSignup";
import AuthorCard from "@/components/seo/AuthorCard";
import { AUTHOR, authorNode, publisherNode } from "@/lib/authorProfile";

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
  const languages = { en: canonical, ...(koPost ? { ko: `${SITE_URL}/blog/${slug}` } : {}), "x-default": canonical };

  const og = {
    type: "article",
    title: post.title,
    description: post.description,
    url: canonical,
    publishedTime: post.date || undefined,
    modifiedTime: post.updated || post.date || undefined,
    // 글이 자기 이미지를 선언했으면 그것을, 아니면 공용 카드(routeMap.OG_CARD_URL).
    images: [post.ogImage || OG_CARD_URL],
  };
  return {
    title: post.title,
    description: post.description,
    keywords: post.keywords || undefined,
    alternates: { canonical, languages },
    openGraph: withOpenGraphBase(og, "en"),
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
  const publisher = publisherNode("en");
  const author = authorNode("en");
  const images = extractImages(post.html);
  const articleImages = images.length ? images : [OG_CARD_URL];
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
        dateModified: post.updated || post.date || undefined,
        author,
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
            {post.conditions && <p className="content-answer__conditions"><strong>Applies when</strong>{post.conditions}</p>}
          </aside>
        )}
        <div className="content-article__meta">
          <Link href={`/en${AUTHOR.profilePath}`} className="content-article__byline" rel="author">
            {AUTHOR.name} · {AUTHOR.en.role}
          </Link>
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

      {/* 마감 영역 — 연결 툴과 구독을 한 줄에 나란히, 그 밑에 글쓴이(KO와 동일 구조, §2.11). */}
      <div className="blog-post-outro">
        <ContentActionPanel locale="en" toolId={post.primaryTool} post={post} />
        <NewsletterSignup locale="en" placement="post" />
      </div>

      <AuthorCard locale="en" />

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
