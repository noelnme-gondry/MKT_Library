import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllPosts, getPostBySlug, tagSlug } from "@/lib/blog";
import { SITE_URL } from "@/lib/routeMap";
import ContentActionPanel from "@/components/seo/ContentActionPanel";
import EditorialTrust from "@/components/seo/EditorialTrust";
import NewsletterSignup from "@/components/seo/NewsletterSignup";

// 발행 글만 정적 생성. 0편이면 빈 배열(라우트 미생성) — 빌드 정상 통과.
export function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};

  const canonical = `${SITE_URL}/blog/${post.slug}`;
  // EN 짝 파일 있으면 hreflang으로 상호 연결(§blog-en-translation-strategy) — EN은 KR 목록/내비 비노출, 링크로만 도달.
  const enPost = getPostBySlug(slug, "en");
  const languages = { ko: canonical, ...(enPost ? { en: `${SITE_URL}/en/blog/${slug}` } : {}), "x-default": canonical };
  const og = {
    type: "article",
    title: post.title,
    description: post.description,
    url: canonical,
    publishedTime: post.date || undefined,
    modifiedTime: post.updated || post.date || undefined,
    // images 미지정 시 opengraph-image.js(파일 컨벤션, 글별 동적 카드)가 자동 주입 —
    // 여기서 fallback을 강제로 넣으면 그 메커니즘을 덮어써 전 글이 정적 카드로 통일됨.
    ...(post.ogImage ? { images: [post.ogImage] } : {}),
  };
  return {
    title: post.title,
    description: post.description,
    keywords: post.keywords || undefined,
    alternates: { canonical, languages },
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

function splitAtContentAction(html) {
  const marker = "<!-- CONTENT_ACTION -->";
  const index = String(html || "").indexOf(marker);
  if (index < 0) return { before: html, after: "" };
  return {
    before: html.slice(0, index),
    after: html.slice(index + marker.length),
  };
}

// 글별 구조화 데이터(JSON-LD) — BlogPosting(리치결과) + BreadcrumbList(빵부스러기).
// SSR로 초기 HTML에 포함돼 크롤러가 즉시 파싱.
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
        inLanguage: "ko-KR",
        articleSection: post.tags,
        ...(post.keywords ? { keywords: post.keywords } : {}),
        ...(post.sources.length ? { citation: post.sources.map((source) => source.url) } : {}),
        image: articleImages,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "홈", item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: "블로그", item: `${SITE_URL}/blog` },
          { "@type": "ListItem", position: 3, name: post.title, item: canonical },
        ],
      },
      ...faqNode,
    ],
  };
}

export default async function BlogPostPage({ params }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const canonical = `${SITE_URL}/blog/${post.slug}`;
  const article = splitAtContentAction(post.html);

  return (
    <div className="content-article">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildPostJsonLd(post, canonical)) }}
      />
      <Link href="/blog" className="content-article__back">
        ← 블로그
      </Link>

      <header className="content-article__header">
        <span className="content-article__type">FIELD NOTE</span>
        <h1>
          {post.title}
        </h1>
        {!post.seoAnswer && post.description && <p className="content-article__dek">{post.description}</p>}
        {post.seoAnswer && (
          <aside className="content-answer" aria-label="검색 질문에 대한 짧은 답">
            <span className="content-answer__label">{post.searchIntent || "검색 질문에 대한 짧은 답"}</span>
            <p>{post.seoAnswer}</p>
          </aside>
        )}
        <div className="content-article__meta">
          <span className="content-article__byline">Growth Opt Playbook 편집</span>
          <span>{fmtDate(post.date)}</span>
          {post.updated && post.updated !== post.date && <span>업데이트 {fmtDate(post.updated)}</span>}
          {post.tags.map((t) => (
            <Link key={t} href={`/blog/tag/${tagSlug(t)}`} style={{ color: "inherit", textDecoration: "none" }}>
              #{t}
            </Link>
          ))}
        </div>
      </header>

      <article className="blog-prose">
        <div dangerouslySetInnerHTML={{ __html: article.before }} />
        {article.after && <ContentActionPanel toolId={post.primaryTool} post={post} placement="article_mid" />}
        <div dangerouslySetInnerHTML={{ __html: article.after }} />
      </article>

      <ContentActionPanel toolId={post.primaryTool} post={post} />

      <EditorialTrust
        conditions={post.conditions}
        reviewer={post.reviewer}
        reviewedAt={post.reviewedAt}
        sources={post.sources}
      />

      <NewsletterSignup placement="post" />

      {post.relatedGlossary.length > 0 && (
        <nav className="content-related-links" aria-label="관련 용어">
          <span>관련 용어</span>
          {post.relatedGlossary.map((slug) => <Link key={slug} href={`/glossary/${slug}`}>{slug}</Link>)}
        </nav>
      )}

      {post.faq.length > 0 && (
        <section className="blog-faq" aria-label="자주 묻는 질문">
          <h2>자주 묻는 질문</h2>
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
