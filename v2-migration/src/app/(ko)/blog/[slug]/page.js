import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllPosts, getPostBySlug, tagSlug } from "@/lib/blog";
import { SITE_URL } from "@/lib/routeMap";
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
  const languages = { ko: canonical, ...(enPost ? { en: `${SITE_URL}/en/blog/${slug}` } : {}), "x-default": enPost ? `${SITE_URL}/en/blog/${slug}` : canonical };
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
    openGraph: withOpenGraphBase(og),
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
  const publisher = publisherNode("ko");
  const author = authorNode("ko");
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
        dateModified: post.updated || post.date || undefined,
        author,
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
  // 관련 용어의 표시명·짧은 정의는 server 전용 로더에서 읽는다(클라이언트 import 금지).
  const termBySlug = new Map(getAllTerms("ko").map((term) => [term.slug, term]));
  const relatedTerms = (post?.relatedGlossary || [])
    .map((termSlug) => termBySlug.get(termSlug))
    .filter(Boolean)
    .map((term) => ({ slug: term.slug, term: term.term, shortDef: term.shortDef, href: `/glossary/${term.slug}` }));
  // 같은 주제 가이드 역링크. 이 맵은 `guideSearchContent`의 posts에서 파생하므로
  // 가이드→글과 글→가이드가 어긋날 수 없다(§12.29 목록은 파생, 하드코딩 금지).
  const relatedGuides = guidesForPost(slug)
    .map((guideId) => ({ guideId, seo: getRouteSeo(guideId, "ko") }))
    .filter((item) => item.seo)
    .map((item) => ({ href: `${idToPath(item.guideId)}`, title: item.seo.title, description: item.seo.description }));
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
            {post.conditions && <p className="content-answer__conditions"><strong>적용 조건</strong>{post.conditions}</p>}
          </aside>
        )}
        <div className="content-article__meta">
          {/* 저자를 식별 가능한 실제 페이지로 잇는다 — 이름만 적힌 바이라인은
              검색엔진에도 독자에게도 "누가 썼는지"를 답하지 못한다. */}
          <Link href={AUTHOR.profilePath} className="content-article__byline" rel="author">
            {AUTHOR.name} · {AUTHOR.ko.role}
          </Link>
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

      <AuthorCard locale="ko" />

      <EditorialTrust
        reviewer={post.reviewer}
        reviewedAt={post.reviewedAt}
        sources={post.sources}
      />

      <SearchIntentLinks links={intentLinksFor("blog", post.slug, "ko")} />

      <TopicClusterLinks
        links={clusterLinksFor(post.slug)}
        titleFor={(slug) => getBlogSeo("ko", slug)?.title || slug}
        locale="ko"
      />

      <NewsletterSignup placement="post" />

      <RelatedGuideList items={relatedGuides} locale="ko" />

      <RelatedGlossaryList items={relatedTerms} locale="ko" />

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
