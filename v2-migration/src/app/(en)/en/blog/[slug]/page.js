import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllPosts, getPostBySlug } from "@/lib/blog";
import { OG_CARD_URL, SITE_URL } from "@/lib/routeMap";
import { withOpenGraphBase } from "@/lib/openGraph";
import ContentActionPanel from "@/components/seo/ContentActionPanel";
import EditorialTrust from "@/components/seo/EditorialTrust";
import NewsletterSignup from "@/components/seo/NewsletterSignup";
import RelatedGlossaryList from "@/components/seo/RelatedGlossaryList";
import RelatedGuideList from "@/components/seo/RelatedGuideList";
import TopicClusterLinks from "@/components/seo/TopicClusterLinks";
import AuthorCard from "@/components/seo/AuthorCard";
import SearchIntentLinks from "@/components/seo/SearchIntentLinks";
import { clusterLinksFor } from "@/lib/topicClusters";
import { getBlogSeo } from "@/lib/blogSeo";
import { AUTHOR, authorNode, publisherNode } from "@/lib/authorProfile";
import { guidesForPost } from "@/lib/guideSearchContent";
import { getRouteSeo } from "@/lib/routeSeo";
import { idToPath } from "@/lib/routeMap";
import { getAllTerms } from "@/lib/glossary";
import { intentLinksFor } from "@/lib/searchIntentRegistry";

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
  // 관련 용어의 표시명·짧은 정의는 server 전용 로더에서 읽는다(클라이언트 import 금지).
  const termBySlug = new Map(getAllTerms("en").map((term) => [term.slug, term]));
  const relatedTerms = (post?.relatedGlossary || [])
    .map((termSlug) => termBySlug.get(termSlug))
    .filter(Boolean)
    .map((term) => ({ slug: term.slug, term: term.term, shortDef: term.shortDef, href: `/en/glossary/${term.slug}` }));
  // 같은 주제 가이드 역링크. 이 맵은 `guideSearchContent`의 posts에서 파생하므로
  // 가이드→글과 글→가이드가 어긋날 수 없다(§12.29 목록은 파생, 하드코딩 금지).
  const relatedGuides = guidesForPost(slug)
    .map((guideId) => ({ guideId, seo: getRouteSeo(guideId, "en") }))
    .filter((item) => item.seo)
    .map((item) => ({ href: `/en${idToPath(item.guideId)}`, title: item.seo.title, description: item.seo.description }));
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

      <ContentActionPanel locale="en" toolId={post.primaryTool} post={post} />

      <AuthorCard locale="en" />

      <EditorialTrust
        locale="en"
        reviewer={post.reviewer}
        reviewedAt={post.reviewedAt}
        sources={post.sources}
      />

      <SearchIntentLinks locale="en" links={intentLinksFor("blog", post.slug, "en")} />

      <TopicClusterLinks
        links={clusterLinksFor(post.slug)}
        titleFor={(slug) => getBlogSeo("en", slug)?.title || slug}
        locale="en"
      />

      <NewsletterSignup locale="en" placement="post" />

      <RelatedGuideList items={relatedGuides} locale="en" />

      <RelatedGlossaryList items={relatedTerms} locale="en" />

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
