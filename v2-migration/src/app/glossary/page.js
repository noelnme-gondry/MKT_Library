import { getAllTerms, getAllCategories } from "@/lib/glossary";
import { SITE_URL } from "@/lib/routeMap";
import GlossaryFilterList from "@/components/GlossaryFilterList";
import SearchTopicHub from "@/components/seo/SearchTopicHub";

// 용어사전 목록 — 블로그·템플릿과 동일하게 routeMap 밖 독립 페이지(§12.24 패턴).
export async function generateMetadata() {
  const title = "마케팅 용어사전";
  const description = "퍼포먼스 마케팅·앱 분석 니치 용어를 한 문장 정의부터 실무 맥락까지 정리한 용어사전입니다.";
  const canonical = `${SITE_URL}/glossary`;
  return {
    title,
    description,
    alternates: { canonical, languages: { ko: canonical, en: `${SITE_URL}/en/glossary` } },
    openGraph: { title, description, url: canonical, images: [`${SITE_URL}/og-card.png`] },
  };
}

// DefinedTermSet — 용어사전에 맞는 schema.org 타입(일반 Article보다 정확한 구조화 데이터).
function buildGlossaryJsonLd(terms) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "DefinedTermSet",
        "@id": `${SITE_URL}/glossary#glossary`,
        url: `${SITE_URL}/glossary`,
        name: "Growth Opt Playbook 용어사전",
        description: "퍼포먼스 마케팅·앱 분석 니치 용어 정의 모음",
        inLanguage: "ko-KR",
        hasDefinedTerm: terms.map((t) => ({
          "@type": "DefinedTerm",
          name: t.term,
          description: t.shortDef,
          url: `${SITE_URL}/glossary/${t.slug}`,
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "홈", item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: "용어사전", item: `${SITE_URL}/glossary` },
        ],
      },
    ],
  };
}

export default function GlossaryIndexPage() {
  const terms = getAllTerms();
  const categories = getAllCategories();

  return (
    <div className="page-inner" style={{ maxWidth: 860, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildGlossaryJsonLd(terms)) }}
      />
      <header style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
          마케팅 용어사전
        </h1>
        <p style={{ marginTop: "0.5rem", fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          퍼포먼스 마케팅·앱 분석에서 자주 나오지만 정작 어디서도 짧게 정의해주지 않는 용어들을 모았습니다.
        </p>
      </header>
      <SearchTopicHub />

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
            아직 등록된 용어가 없습니다
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>곧 채워집니다.</div>
        </div>
      ) : (
        <GlossaryFilterList terms={terms} categories={categories} locale="ko" glossaryPath="/glossary" />
      )}
    </div>
  );
}
