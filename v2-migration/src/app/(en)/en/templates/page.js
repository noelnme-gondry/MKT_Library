import TaskTemplatePaths from "@/components/TaskTemplatePaths";
import SourceExportGuide from "@/components/ds/SourceExportGuide";
import { toolIndexEntry } from "@/lib/toolIndex";
import { SITE_URL } from "@/lib/routeMap";
import { withOpenGraphBase } from "@/lib/openGraph";
import TemplateDownloadCard from "@/components/TemplateDownloadCard";
import ChecklistDownloadCard from "@/components/ChecklistDownloadCard";

import { TEMPLATE_PAGES, getTemplatePage } from "@/lib/templateCatalog";

// 목록 → 도구별 상세(컬럼 설명) 크롤 경로.
const templateDetailHref = (toolId) => {
  const page = TEMPLATE_PAGES.find((item) => item.toolId === toolId);
  return page ? `/en/templates/${page.slug}` : null;
};

export async function generateMetadata() {
  const title = "Marketing report samples and CSV templates";
  const description = "Explore weekly reporting, CPA diagnosis and budget-scaling examples. Download free Word/Excel samples, CSV input templates and operating checklists.";
  const canonical = `${SITE_URL}/en/templates`;
  return {
    title,
    description,
    alternates: {
      canonical,
      languages: { ko: `${SITE_URL}/templates`, en: canonical, "x-default": canonical },
    },
    openGraph: withOpenGraphBase({ title, description, url: canonical, images: [`${SITE_URL}/og-card.png`] }, "en"),
  };
}

const GROUPS = TEMPLATE_PAGES.map(({ toolId, toolPath, slug }) => {
  const entry = toolIndexEntry(toolId, "en");
  return {
    heading: entry.name,
    unified: getTemplatePage(slug).hasUnified,
    items: [[toolId, entry.name, entry.answer, `/en${toolPath}`]],
  };
});

const FAQ = [
  ["Does the template include example data?", "No. It contains only a header row. Fill the rows below with your own data before uploading."],
  ["Can I upload a CSV I already have?", "Yes. Automatic column mapping recognizes most existing headers. Use a template when the mapping is unclear."],
  ["Is uploaded data sent to a server?", "No. CSV files are processed in your browser and never sent to a server. Device storage can be managed in Storage."],
  ["How do I use a template in Google Sheets?", "Download a template below, then use File → Import → Upload in Google Sheets. Keep the header row unchanged, fill your data, then download it as CSV and upload it. Confidential sheets can stay private."],
  ["Which tools have templates?", "Templates are listed for each published tool with a supported CSV schema. Check the column guide for its required data and observation unit."],
];

export default function EnglishTemplatesPage() {
  const checklists = ["taxonomy", "postback", "media"];
  const publishedGroups = GROUPS;
  return (
    <main id="main-content" tabIndex="-1" className="page-inner" style={{ maxWidth: 860, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <header style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>Marketing report samples and CSV templates</h1>
        <p style={{ marginTop: "0.5rem", fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          Each analysis tool expects slightly different columns. Download a blank header-only CSV, fill it in, and upload it without rebuilding the mapping. Downloads are generated in your browser and never sent to a server.
        </p>
      </header>
      <TaskTemplatePaths locale="en" />
      <SourceExportGuide locale="en" />
      {publishedGroups.map((group) => (
        <section key={group.heading} style={{ marginBottom: "2.25rem" }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.35rem" }}>{group.heading}</h2>
          {group.note && <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: "0.9rem" }}>{group.note}</p>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "0.9rem" }}>
            {group.items.map(([toolId, title, desc, href]) => <TemplateDownloadCard
              detailHref={templateDetailHref(toolId)} key={toolId} toolId={toolId} title={title} desc={desc} href={href} unified={group.unified} locale="en" />)}
          </div>
        </section>
      ))}
      <section className="template-checklists" aria-labelledby="template-checklist-title">
        <span>OPERATIONS CHECKLISTS</span>
        <h2 id="template-checklist-title">Make the pre-launch checks repeatable</h2>
        <p>Download the key QA steps from the operating guides as Markdown, then paste them into Notion, a document, or an issue.</p>
        <div>
          {checklists.map((checklistId) => <ChecklistDownloadCard key={checklistId} checklistId={checklistId} locale="en" />)}
        </div>
      </section>
      <section className="blog-faq" aria-label="Frequently asked questions">
        <h2>Frequently asked questions</h2>
        {FAQ.map(([question, answer]) => <section data-information-section="" key={question} className="blog-faq-item"><header data-information-heading="">{question}</header><div className="blog-faq-item-answer">{answer}</div></section>)}
      </section>
    </main>
  );
}
