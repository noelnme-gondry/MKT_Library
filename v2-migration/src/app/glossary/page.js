import { getAllTerms, getAllCategories } from "@/lib/glossary";
import { SITE_URL } from "@/lib/routeMap";
import GlossaryFilterList from "@/components/GlossaryFilterList";
import SearchTopicHub from "@/components/seo/SearchTopicHub";

// 용어사전 목록 — 블로그·템플릿과 동일하게 routeMap 밖 독립 페이지(§12.24 패턴).
export async function generateMetadata() {
  const title = "퍼포먼스 마케팅 용어사전 | CPA·ROAS·CTR 뜻과 실무 활용";
  const description = "CPA, ROAS, CTR, LTV, 어트리뷰션 등 퍼포먼스 마케팅 핵심 용어를 한 줄 정의·계산식·실무 맥락으로 설명하고 관련 분석 도구로 연결합니다.";
  const canonical = `${SITE_URL}/glossary`;
  return {
    title,
    description,
    alternates: { canonical, languages: { ko: canonical, en: `${SITE_URL}/en/glossary`, "x-default": canonical } },
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
    <div className="content-index">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildGlossaryJsonLd(terms)) }}
      />
      <header className="content-index__hero">
        <span className="content-index__eyebrow">PERFORMANCE MARKETING GLOSSARY</span>
        <h1>검색한 용어를<br />운영 판단으로 연결합니다</h1>
        <p>CPA·ROAS·CTR·LTV부터 어트리뷰션과 증분 측정까지. 뜻과 계산식에서 멈추지 않고, 어느 데이터를 봐야 하는지까지 정리합니다.</p>
        <span className="content-index__meta">{terms.length} TERMS · DEFINITION → PRACTICE</span>
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
