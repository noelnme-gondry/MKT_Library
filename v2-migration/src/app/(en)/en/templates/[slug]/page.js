import { notFound } from "next/navigation";
import Link from "next/link";

import TemplateDownloadCard from "@/components/TemplateDownloadCard";
import { SITE_URL } from "@/lib/routeMap";
import { withOpenGraphBase } from "@/lib/openGraph";
import { getTemplatePage, TEMPLATE_PAGE_SLUGS } from "@/lib/templateCatalog";
import { getRouteSeo } from "@/lib/routeSeo";

// 도구별 CSV 템플릿 상세. 컬럼 표는 실제 템플릿 빌더에서 파생하므로 페이지와
// 내려받는 헤더가 갈라지지 않는다(`lib/templateCatalog.js`).
export function generateStaticParams() {
  return TEMPLATE_PAGE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const page = getTemplatePage(slug);
  if (!page) return {};
  const seo = getRouteSeo(page.toolId, "en");
  const toolName = seo?.title || page.toolId;
  const title = `${toolName} CSV template download`;
  const description = `A ready-to-upload CSV template for ${toolName}. Review the ${page.fields.length} columns it reads (${page.requiredCount} required) and download the blank file.`;
  const canonical = `${SITE_URL}/en/templates/${slug}`;
  return {
    title,
    description,
    alternates: {
      canonical,
      languages: {
        ko: `${SITE_URL}/templates/${slug}`,
        en: `${SITE_URL}/en/templates/${slug}`,
        "x-default": canonical,
      },
    },
    openGraph: withOpenGraphBase({ title, description, url: canonical, images: [`${SITE_URL}/og-card.png`] }, "en"),
  };
}

export default async function Page({ params }) {
  const { slug } = await params;
  const page = getTemplatePage(slug);
  if (!page) notFound();
  const seo = getRouteSeo(page.toolId, "en");
  const toolName = seo?.title || page.toolId;

  return (
    <section className="template-detail">
      <span className="template-detail__eyebrow">CSV template</span>
      <h1>{toolName} input template</h1>
      <p className="template-detail__lead">A blank CSV containing only the columns this tool reads. Keep the header names and the upload maps them automatically. Data is processed in your browser and never sent to a server.</p>

      <TemplateDownloadCard
        toolId={page.toolId}
        title={`${toolName} template`}
        desc={`${page.fields.length} columns · ${page.requiredCount} required`}
        href={`/en${page.toolPath}`}
        unified={page.hasUnified}
        locale="en"
      />

      <h2>Template columns</h2>
      <div className="table-scroll">
        <table className="template-detail__table">
          <thead>
            <tr>
              <th scope="col">Column</th>
              <th scope="col">Meaning</th>
              <th scope="col">Type</th>
              <th scope="col">Required</th>
            </tr>
          </thead>
          <tbody>
            {page.fields.map((field) => (
              <tr key={field.key}>
                <td><code>{field.key}</code></td>
                <td>{field.label || "—"}</td>
                <td>{field.type}</td>
                <td>{field.required ? "Required" : "Optional"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Filling it in</h2>
      <ul className="template-detail__rules">
        <li>Use <code>YYYY-MM-DD</code> for every date. Mixed formats break period comparisons.</li>
        <li>Numeric columns may contain thousands separators, but no currency symbols or text.</li>
        <li>Rows missing a required column are excluded. Zero and blank are treated differently.</li>
        <li>Extra columns are fine—anything this tool does not use is ignored.</li>
      </ul>

      <p className="template-detail__back">
        <Link href="/en/templates">← All templates</Link>
      </p>
    </section>
  );
}
