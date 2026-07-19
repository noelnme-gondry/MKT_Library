import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllTerms, getTermBySlug } from "@/lib/glossary";
import { getPostBySlug } from "@/lib/blog";
import { SITE_URL } from "@/lib/routeMap";
import ContentActionPanel from "@/components/seo/ContentActionPanel";

export function generateStaticParams() {
  return getAllTerms().map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const term = getTermBySlug(slug);
  if (!term) return {};

  const canonical = `${SITE_URL}/glossary/${term.slug}`;
  const enTerm = getTermBySlug(slug, "en");
  const languages = { ko: canonical, ...(enTerm ? { en: `${SITE_URL}/en/glossary/${slug}` } : {}) };
  return {
    title: `${term.term} 뜻 — 용어사전`,
    description: term.description,
    keywords: term.keywords || undefined,
    alternates: { canonical, languages },
    openGraph: {
      type: "article",
      title: `${term.term} 뜻`,
      description: term.description,
      url: canonical,
      images: [`${SITE_URL}/og-card.png`],
    },
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
    <div className="page-inner" style={{ maxWidth: 760, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildTermJsonLd(term, canonical)) }}
      />
      <Link href="/glossary" style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}>
        ← 용어사전
      </Link>

      <header style={{ margin: "1rem 0 1.75rem", paddingBottom: "1.25rem", borderBottom: "1px solid var(--border-subtle)" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.01em", lineHeight: 1.3 }}>
          {term.term}
        </h1>
        {term.shortDef && (
          <p style={{ marginTop: "0.6rem", fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.6 }}>
            {term.shortDef}
          </p>
        )}
      </header>

      <article className="blog-prose" dangerouslySetInnerHTML={{ __html: term.html }} />

      <ContentActionPanel term={term} />

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
