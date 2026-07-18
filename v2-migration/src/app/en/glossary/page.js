import { getAllTerms, getAllCategories } from "@/lib/glossary";
import { SITE_URL } from "@/lib/routeMap";
import GlossaryFilterList from "@/components/GlossaryFilterList";

// EN 용어사전 목록 — /glossary(KR)의 EN 미러(§en-blog-translation-strategy와 동일 방식).
export async function generateMetadata() {
  const title = "Marketing Glossary";
  const description = "Performance marketing and app analytics terms defined in one sentence, with practical context.";
  const canonical = `${SITE_URL}/en/glossary`;
  return {
    title,
    description,
    alternates: { canonical, languages: { ko: `${SITE_URL}/glossary`, en: canonical } },
    openGraph: { title, description, url: canonical, images: [`${SITE_URL}/og-card.png`] },
  };
}

function buildGlossaryJsonLd(terms) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "DefinedTermSet",
        "@id": `${SITE_URL}/en/glossary#glossary`,
        url: `${SITE_URL}/en/glossary`,
        name: "Growth Opt Playbook Glossary",
        description: "Performance marketing and app analytics term definitions",
        inLanguage: "en-US",
        hasDefinedTerm: terms.map((t) => ({
          "@type": "DefinedTerm",
          name: t.term,
          description: t.shortDef,
          url: `${SITE_URL}/en/glossary/${t.slug}`,
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: "Glossary", item: `${SITE_URL}/en/glossary` },
        ],
      },
    ],
  };
}

export default function EnGlossaryIndexPage() {
  const terms = getAllTerms("en");
  const categories = getAllCategories("en");

  return (
    <div className="page-inner" style={{ maxWidth: 860, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildGlossaryJsonLd(terms)) }}
      />
      <header style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
          Marketing Glossary
        </h1>
        <p style={{ marginTop: "0.5rem", fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          Terms that come up constantly in performance marketing and app analytics, but rarely get defined anywhere concisely.
        </p>
      </header>

      {terms.length === 0 ? (
        <div
          className="block"
          style={{
            padding: "2.5rem 1.5rem",
            textAlign: "center",
            borderRadius: "var(--radius-xl)",
            border: "1px solid var(--border-subtle)",
            background: "var(--surface-container-lowest)",
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.4rem" }}>
            No terms yet
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Check back soon.</div>
        </div>
      ) : (
        <GlossaryFilterList terms={terms} categories={categories} locale="en" glossaryPath="/en/glossary" />
      )}
    </div>
  );
}
