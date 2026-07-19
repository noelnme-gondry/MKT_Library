import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllTerms, getTermBySlug } from "@/lib/glossary";
import { getPostBySlug } from "@/lib/blog";
import { SITE_URL } from "@/lib/routeMap";
import ContentActionPanel from "@/components/seo/ContentActionPanel";

// EN 용어 상세 — /glossary/[slug]/page.js(KR)의 EN 미러.
export function generateStaticParams() {
  return getAllTerms("en").map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const term = getTermBySlug(slug, "en");
  if (!term) return {};

  const canonical = `${SITE_URL}/en/glossary/${term.slug}`;
  const koTerm = getTermBySlug(slug, "ko");
  const languages = { en: canonical, ...(koTerm ? { ko: `${SITE_URL}/glossary/${slug}` } : {}), "x-default": koTerm ? `${SITE_URL}/glossary/${slug}` : canonical };
  return {
    title: `What is ${term.term}? — Glossary`,
    description: term.description,
    keywords: term.keywords || undefined,
    alternates: { canonical, languages },
    openGraph: {
      type: "article",
      title: `What is ${term.term}?`,
      description: term.description,
      url: canonical,
      images: [`${SITE_URL}/og-card.png`],
    },
  };
}

function buildTermJsonLd(term, canonical) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "DefinedTerm",
        name: term.term,
        description: term.shortDef,
        url: canonical,
        inLanguage: "en-US",
        inDefinedTermSet: `${SITE_URL}/en/glossary`,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/en` },
          { "@type": "ListItem", position: 2, name: "Glossary", item: `${SITE_URL}/en/glossary` },
          { "@type": "ListItem", position: 3, name: term.term, item: canonical },
        ],
      },
    ],
  };
}

export default async function EnGlossaryTermPage({ params }) {
  const { slug } = await params;
  const term = getTermBySlug(slug, "en");
  if (!term) notFound();

  const canonical = `${SITE_URL}/en/glossary/${term.slug}`;
  const relatedPosts = term.relatedPosts.map((s) => getPostBySlug(s, "en")).filter(Boolean);

  return (
    <div className="content-article glossary-article">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildTermJsonLd(term, canonical)) }}
      />
      <Link href="/en/glossary" className="content-article__back">
        ← Glossary
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

      <ContentActionPanel locale="en" term={term} />

      {relatedPosts.length > 0 && (
        <div style={{ marginTop: "2rem", display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Related:</span>
          {relatedPosts.map((p) => (
            <Link key={p.slug} href={`/en/blog/${p.slug}`} className="chip" style={{ textDecoration: "none" }}>
              {p.title}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
