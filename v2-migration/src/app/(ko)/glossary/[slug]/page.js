import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllTerms, getTermBySlug } from "@/lib/glossary";
import { getPostBySlug } from "@/lib/blog";
import { SITE_URL } from "@/lib/routeMap";
import { withOpenGraphBase } from "@/lib/openGraph";
import ContentActionPanel from "@/components/seo/ContentActionPanel";
import EditorialTrust from "@/components/seo/EditorialTrust";

export function generateStaticParams() {
  return getAllTerms().map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const term = getTermBySlug(slug);
  if (!term) return {};

  const canonical = `${SITE_URL}/glossary/${term.slug}`;
  const enTerm = getTermBySlug(slug, "en");
  const languages = { ko: canonical, ...(enTerm ? { en: `${SITE_URL}/en/glossary/${slug}` } : {}), "x-default": enTerm ? `${SITE_URL}/en/glossary/${slug}` : canonical };
  return {
    // absolute — 루트 layout의 " | Growth Opt Playbook" 접미(21자)를 붙이지 않는다.
    // 검색결과 제목은 30자 안팎에서 잘려서, 브랜드 접미가 붙으면 정작 차별화
    // 문구가 화면 밖으로 밀린다(네이버 웹사이트 컬렉션에서 특히 짧게 잘림).
    title: { absolute: term.seoTitle || `${term.term} 뜻 — 용어사전` },
    description: term.description,
    keywords: term.keywords || undefined,
    alternates: { canonical, languages },
    openGraph: withOpenGraphBase({
      type: "article",
      title: term.seoTitle || `${term.term} 뜻`,
      description: term.description,
      url: canonical,
      publishedTime: term.date || undefined,
      modifiedTime: term.updated || term.date || undefined,
      images: [`${SITE_URL}/og-card.png`],
    }),
  };
}

// DefinedTerm — 용어사전 단건에 맞는 schema.org 타입.
function buildTermJsonLd(term, canonical) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "DefinedTerm",
        name: term.term,
        description: term.shortDef,
        url: canonical,
        inLanguage: "ko-KR",
        inDefinedTermSet: `${SITE_URL}/glossary`,
      },
      ...(term.faq.length
        ? [{
            "@type": "FAQPage",
            mainEntity: term.faq.map((item) => ({
              "@type": "Question",
              name: item.q,
              acceptedAnswer: { "@type": "Answer", text: item.a },
            })),
          }]
        : []),
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "홈", item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: "용어사전", item: `${SITE_URL}/glossary` },
          { "@type": "ListItem", position: 3, name: term.term, item: canonical },
        ],
      },
    ],
  };
}

export default async function GlossaryTermPage({ params }) {
  const { slug } = await params;
  const term = getTermBySlug(slug);
  if (!term) notFound();

  const canonical = `${SITE_URL}/glossary/${term.slug}`;
  // relatedPosts는 slug 배열 — 발행된 글만 실제 링크로(미발행/오탈자 slug는 조용히 스킵, §8 정직).
  const relatedPosts = term.relatedPosts.map((s) => getPostBySlug(s)).filter(Boolean);

  return (
    <div className="content-article glossary-article">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildTermJsonLd(term, canonical)) }}
      />
      <Link href="/glossary" className="content-article__back">
        ← 용어사전
      </Link>

      <header className="content-article__header">
        <span className="content-article__type">GLOSSARY · {term.category}</span>
        <h1>
          {term.term}
        </h1>
        {term.shortDef && (
          <p className="content-article__dek">
            {term.shortDef}
          </p>
        )}
      </header>

      <article className="blog-prose" dangerouslySetInnerHTML={{ __html: term.html }} />

      <ContentActionPanel term={term} />

      <EditorialTrust
        reviewer={term.reviewer}
        reviewedAt={term.reviewedAt}
        sources={term.sources}
        contentType="glossary"
      />

      {term.faq.length > 0 && (
        <section className="blog-faq" aria-label="자주 묻는 질문">
          <h2>자주 묻는 질문</h2>
          {term.faq.map((item, i) => (
            <details key={i} className="blog-faq-item">
              <summary>{item.q}</summary>
              <div className="blog-faq-item-answer">{item.a}</div>
            </details>
          ))}
        </section>
      )}

      {relatedPosts.length > 0 && (
        <div style={{ marginTop: "2rem", display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>관련 글:</span>
          {relatedPosts.map((p) => (
            <Link key={p.slug} href={`/blog/${p.slug}`} className="chip" style={{ textDecoration: "none" }}>
              {p.title}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
