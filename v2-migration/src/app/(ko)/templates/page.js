import { toolIndexEntry } from "@/lib/toolIndex";
import { SITE_URL } from "@/lib/routeMap";
import { withOpenGraphBase } from "@/lib/openGraph";
import TemplateDownloadCard from "@/components/TemplateDownloadCard";
import ChecklistDownloadCard from "@/components/ChecklistDownloadCard";

import { TEMPLATE_PAGES, getTemplatePage } from "@/lib/templateCatalog";

// 목록 → 도구별 상세(컬럼 설명) 크롤 경로.
const templateDetailHref = (toolId) => {
  const page = TEMPLATE_PAGES.find((item) => item.toolId === toolId);
  return page ? `/templates/${page.slug}` : null;
};

// CSV 템플릿 다운로드 랜딩 — routeMap 밖 독립 페이지(/blog·/guide와 동일 패턴, §12.24).
// 실제 다운로드는 기존 csvTemplate.js(buildToolTemplateCsv, BOM+CRLF §7)를 그대로
// 공개 템플릿 목록과 다운로드 스키마는 templateCatalog에서 함께 파생한다.
export async function generateMetadata() {
  const title = "무료 마케팅 템플릿·체크리스트 다운로드";
  const description =
    "분석 도구별 CSV 양식과 이벤트 택소노미·포스트백 QA·신규 광고 매체 온보딩 체크리스트를 무료 다운로드합니다.";
  const canonical = `${SITE_URL}/templates`;
  return {
    title,
    description,
    alternates: {
      canonical,
      languages: { ko: canonical, en: `${SITE_URL}/en/templates`, "x-default": `${SITE_URL}/en/templates` },
    },
    openGraph: withOpenGraphBase({ title, description, url: canonical, images: [`${SITE_URL}/og-card.png`] }),
  };
}

const GROUPS = TEMPLATE_PAGES.map(({ toolId, toolPath, slug }) => {
  const entry = toolIndexEntry(toolId, "ko");
  return {
    heading: entry.name,
    unified: getTemplatePage(slug).hasUnified,
    items: [{ toolId, title: entry.name, desc: entry.answer, href: toolPath }],
  };
});

const FAQ = [
  {
    q: "템플릿에 예시 데이터가 들어있나요?",
    a: "아니요, 헤더(컬럼명) 한 줄만 들어있는 빈 템플릿이에요. 그 아래 행에 실제 데이터를 채워서 업로드하면 됩니다.",
  },
  {
    q: "이미 가진 CSV가 있는데 그대로 올려도 되나요?",
    a: "네, 대부분 업로드 화면의 자동 컬럼 매핑이 알아서 인식해요. 템플릿은 컬럼명이 안 맞아 매핑이 헷갈릴 때 기준으로 쓰면 편합니다.",
  },
  {
    q: "업로드한 데이터가 서버로 전송되나요?",
    a: "아니요. 모든 CSV는 브라우저 안에서만 처리되고 서버로 전송되거나 저장되지 않습니다.",
  },
  {
    q: "Google Sheets에서 템플릿을 쓰려면 어떻게 하나요?",
    a: "아래 템플릿 CSV를 받은 뒤 Google Sheets에서 파일 → 가져오기 → 업로드로 열면 됩니다. 헤더를 바꾸지 않고 데이터를 채운 뒤, 앱에서 공개 보기 링크를 연결하세요.",
  },
  {
    q: "어떤 도구의 템플릿을 제공하나요?",
    a: "CSV 스키마가 있는 공개 도구의 템플릿을 모두 제공합니다. 도구마다 필요한 컬럼과 관측 단위는 컬럼 안내에서 확인하세요.",
  },
];

function buildJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${SITE_URL}/templates#page`,
        url: `${SITE_URL}/templates`,
        name: "무료 마케팅 템플릿·체크리스트 다운로드",
        description: "분석 도구별 CSV 양식과 마케팅 운영 체크리스트를 무료 다운로드합니다.",
        inLanguage: "ko-KR",
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "홈", item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: "CSV 템플릿", item: `${SITE_URL}/templates` },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQ.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      },
    ],
  };
}

export default function TemplatesPage() {
  const checklists = ["taxonomy", "postback", "media"];
  const publishedGroups = GROUPS;
  return (
    <main id="main-content" tabIndex="-1" className="page-inner" style={{ maxWidth: 860, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd()) }}
      />
      <header style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
          무료 마케팅 템플릿·체크리스트
        </h1>
        <p style={{ marginTop: "0.5rem", fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          분석 도구마다 필요한 컬럼이 조금씩 달라요. 헤더만 채워진 빈 CSV를 받아서
          그대로 채워 올리면 컬럼 매핑을 다시 고민할 필요가 없습니다. 모든 다운로드는
          브라우저 안에서만 생성되고 서버로 전송되지 않습니다.
        </p>
      </header>

      <section className="templates-sheet-guide" aria-label="Google Sheets 템플릿 사용 방법">
        <div><span>GOOGLE SHEETS</span><strong>같은 템플릿을 시트에서도 그대로 쓰세요</strong></div>
        <ol>
          <li>아래에서 CSV / Google Sheets 템플릿을 받습니다.</li>
          <li>Google Sheets에서 <b>파일 → 가져오기 → 업로드</b>로 열고, 헤더 행은 바꾸지 않습니다.</li>
          <li>데이터를 채운 뒤 <b>링크가 있는 모든 사용자 · 보기</b>로 공유하면 앱에서 바로 불러올 수 있습니다.</li>
        </ol>
        <small>시트는 Google 계정에, 분석 원본은 브라우저 메모리에만 남습니다. 앱은 시트 URL과 이름만 이 브라우저에서 다시 고를 수 있게 기억합니다.</small>
      </section>

      {publishedGroups.map((group) => (
        <section key={group.heading} style={{ marginBottom: "2.25rem" }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.35rem" }}>
            {group.heading}
          </h2>
          {group.note && (
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: "0.9rem" }}>{group.note}</p>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "0.9rem" }}>
            {group.items.map((item) => (
              <TemplateDownloadCard
                key={item.toolId}
                toolId={item.toolId}
                title={item.title}
                desc={item.desc}
                href={item.href}
                unified={group.unified}
                detailHref={templateDetailHref(item.toolId)}
              />
            ))}
          </div>
        </section>
      ))}

      <section className="template-checklists" aria-labelledby="template-checklist-title">
        <span>운영 문서 템플릿</span>
        <h2 id="template-checklist-title">배포 전에 빠뜨리지 않는 체크리스트</h2>
        <p>가이드의 핵심 검수 항목만 마크다운으로 분리했습니다. 노션·문서·이슈에 그대로 붙여 팀의 완료 기준으로 쓰세요.</p>
        <div>
          {checklists.map((checklistId) => <ChecklistDownloadCard key={checklistId} checklistId={checklistId} />)}
        </div>
      </section>

      <section className="blog-faq" aria-label="자주 묻는 질문">
        <h2>자주 묻는 질문</h2>
        {FAQ.map((item, i) => (
          <details key={i} className="blog-faq-item">
            <summary>{item.q}</summary>
            <div className="blog-faq-item-answer">{item.a}</div>
          </details>
        ))}
      </section>
    </main>
  );
}
