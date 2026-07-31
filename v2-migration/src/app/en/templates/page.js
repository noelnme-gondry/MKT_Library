import { SITE_URL, isRoutePublished } from "@/lib/routeMap";
import TemplateDownloadCard from "@/components/TemplateDownloadCard";
import ChecklistDownloadCard from "@/components/ChecklistDownloadCard";

export async function generateMetadata() {
  const title = "Free marketing templates and checklists";
  const description = "Download CSV schemas plus event taxonomy, postback QA, and new ad channel onboarding checklists.";
  const canonical = `${SITE_URL}/en/templates`;
  return {
    title,
    description,
    alternates: {
      canonical,
      languages: { ko: `${SITE_URL}/templates`, en: canonical, "x-default": `${SITE_URL}/templates` },
    },
    openGraph: { title, description, url: canonical, locale: "en_US", images: [`${SITE_URL}/og-card.png`] },
  };
}

const GROUPS = [
  {
    heading: "Efficiency · budget CSV (daily campaign performance)",
    note: "These four tools share the same CSV format. Upload it once and use it across all four.",
    unified: true,
    items: [
      ["5-2", "Operations dashboard", "See daily campaign cost, installs, revenue, and retention in scorecards and charts.", "/en/dashboard"],
      ["5-3", "Budget allocation", "Learn CPR/ROAS response curves by channel and campaign to allocate budget.", "/en/tools/budget-allocation"],
      ["5-21", "Campaign performance variance", "Decompose performance changes into allocation, mix, and efficiency effects.", "/en/tools/campaign-variance"],
      ["5-22", "Campaign saturation", "Compare marginal efficiency with the average to identify saturated and available ranges.", "/en/tools/campaign-saturation"],
    ],
  },
  {
    heading: "Creative CSV",
    items: [["9-6", "Creative analysis", "Analyze creative CTR, CVR, and fatigue trends statistically.", "/en/content/freshness"]],
  },
  {
    heading: "Experiment CSV",
    items: [["5-4", "Experiment analysis (A/B test)", "Design A/B tests and read significance and power results.", "/en/tools/experiment-analysis"]],
  },
  {
    heading: "Weekly panel CSV",
    items: [["5-18", "Marketing response (MMM)", "Run cannibalization diagnosis, MMM contribution decomposition, and regression forecasts.", "/en/tools/marketing-response"]],
  },
  {
    heading: "Content CSV",
    items: [
      ["9-3", "Content traffic variance", "Decompose traffic changes by source, category, and content.", "/en/content/traffic-variance"],
      ["9-7", "Content operations dashboard", "Visualize content operations with anomaly detection and scorecards.", "/en/content/dashboard"],
    ],
  },
];

const FAQ = [
  ["Does the template include example data?", "No. It contains only a header row. Fill the rows below with your own data before uploading."],
  ["Can I upload a CSV I already have?", "Yes. Automatic column mapping recognizes most existing headers. Use a template when the mapping is unclear."],
  ["Is uploaded data sent to a server?", "No. CSV files are processed and discarded in your browser; they are not sent to or stored on a server."],
  ["How do I use a template in Google Sheets?", "Download a template below, then use File → Import → Upload in Google Sheets. Keep the header row unchanged, fill your data, and connect the shared Viewer link in the app."],
  ["Why do some tools have no template?", "Aha-moment and incrementality tools use event- or holdout-level data with a different grain, so they are not included here."],
];

export default function EnglishTemplatesPage() {
  const checklists = ["taxonomy", "postback", "media"];
  const publishedGroups = GROUPS
    .map((group) => ({ ...group, items: group.items.filter(([toolId]) => isRoutePublished(toolId)) }))
    .filter((group) => group.items.length > 0);
  return (
    <main id="main-content" className="page-inner" style={{ maxWidth: 860, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <header style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>Free marketing templates and checklists</h1>
        <p style={{ marginTop: "0.5rem", fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          Each analysis tool expects slightly different columns. Download a blank header-only CSV, fill it in, and upload it without rebuilding the mapping. Downloads are generated in your browser and never sent to a server.
        </p>
      </header>
      <section className="templates-sheet-guide" aria-label="How to use the Google Sheets templates">
        <div><span>GOOGLE SHEETS</span><strong>Use the same template in a spreadsheet</strong></div>
        <ol>
          <li>Download a CSV / Google Sheets template below.</li>
          <li>In Google Sheets, use <b>File → Import → Upload</b>; keep the header row unchanged.</li>
          <li>Fill the data, share it as <b>Anyone with the link · Viewer</b>, then import it in the app.</li>
        </ol>
        <small>Your sheet remains in Google Sheets and source rows stay in browser memory. The app can only remember that sheet’s URL and name in this browser.</small>
      </section>
      {publishedGroups.map((group) => (
        <section key={group.heading} style={{ marginBottom: "2.25rem" }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.35rem" }}>{group.heading}</h2>
          {group.note && <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: "0.9rem" }}>{group.note}</p>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "0.9rem" }}>
            {group.items.map(([toolId, title, desc, href]) => <TemplateDownloadCard key={toolId} toolId={toolId} title={title} desc={desc} href={href} unified={group.unified} locale="en" />)}
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
        {FAQ.map(([question, answer]) => <details key={question} className="blog-faq-item"><summary>{question}</summary><div className="blog-faq-item-answer">{answer}</div></details>)}
      </section>
    </main>
  );
}
