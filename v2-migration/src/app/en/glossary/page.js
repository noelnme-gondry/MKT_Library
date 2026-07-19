import { getAllTerms, getAllCategories } from "@/lib/glossary";
import { SITE_URL } from "@/lib/routeMap";
import GlossaryFilterList from "@/components/GlossaryFilterList";
import SearchTopicHub from "@/components/seo/SearchTopicHub";

// EN 용어사전 목록 — /glossary(KR)의 EN 미러(§en-blog-translation-strategy와 동일 방식).
export async function generateMetadata() {
  const title = "Performance Marketing Glossary | CPA, ROAS, CTR & More";
  const description = "Clear definitions, formulas, and practical context for CPA, ROAS, CTR, LTV, attribution, and other performance marketing terms — with matching free tools.";
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
    <div className="content-index">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildGlossaryJsonLd(terms)) }}
      />
      <header className="content-index__hero">
        <span className="content-index__eyebrow">PERFORMANCE MARKETING GLOSSARY</span>
        <h1>Turn a searched term<br />into an operating decision.</h1>
        <p>From CPA, ROAS, CTR, and LTV to attribution and incrementality — definitions, formulas, and the data to review next.</p>
        <span className="content-index__meta">{terms.length} TERMS · DEFINITION → PRACTICE</span>
      </header>
      <SearchTopicHub locale="en" />

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
