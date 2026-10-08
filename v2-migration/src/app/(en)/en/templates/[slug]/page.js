import { notFound } from "next/navigation";
import Link from "next/link";

import PlatformExportGuide, { platformExportNames } from "@/components/PlatformExportGuide";
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
  const page = getTemplatePage(slug, "en");
  if (!page) return {};
  const seo = getRouteSeo(page.toolId, "en");
  const toolName = seo?.title || page.toolId;
  const title = `${toolName} CSV template download`;
  const platforms = platformExportNames(page.toolId, "en");
  const description = `A ready-to-upload CSV template for ${toolName}. Review the ${page.fields.length} columns it reads (${page.requiredCount} required roles) and download the blank file.${platforms.length ? ` ${platforms.join(" and ")} exports can also be uploaded as is.` : ""}`;
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
  const page = getTemplatePage(slug, "en");
  if (!page) notFound();
  const seo = getRouteSeo(page.toolId, "en");
  const toolName = seo?.title || page.toolId;

  return (
    <section className="template-detail">
      <span className="template-detail__eyebrow">CSV template</span>
      <h1>{toolName} input template</h1>
      <p className="template-detail__lead">A blank CSV containing only the columns this tool reads. Keep these headers for automatic matching where supported; tools with role selection ask you to choose the outcome and features. Data is processed in your browser and never sent to a server.</p>

      <TemplateDownloadCard
        toolId={page.toolId}
        title={`${toolName} template`}
        desc={`${page.fields.length} columns · ${page.requiredCount} required roles`}
        href={`/en${page.toolPath}`}
        unified={page.hasUnified}
        locale="en"
      />

      <h2>Template columns</h2>
      <div className="table-scroll" role="region" tabIndex={0} aria-label="Template columns">
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
                <td>{field.required ? "Required" : field.alternatives ? `One of: ${field.alternatives.join(" / ")}` : "Optional"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {page.roleMapping && <p>Choose a numeric outcome and at least one numeric feature after uploading. Feature names here are examples; your own columns can fill these roles. Aha outcomes must be 0/1. Missing values, sample size and variation are checked separately before estimation.</p>}
      {page.toolId === "5-23" && <p>This template is for the holdout method: include both exposed and holdout groups. For switch-on or switch-off analysis, use a date column and a numeric outcome, select the cutoff, and provide observations on both sides. Confirm the study design in the tool.</p>}

      <PlatformExportGuide toolId={page.toolId} locale="en" />

      <h2>Filling it in</h2>
      <ul className="template-detail__rules">
        <li>Use <code>YYYY-MM-DD</code> for every date. Mixed formats break period comparisons.</li>
        <li>Numeric columns may use thousands separators and common currency wrappers such as <code>₩</code>, <code>$</code>, <code>KRW</code>, <code>USD</code>, or <code>원</code>. Arbitrary text is rejected, so plain numbers remain the safest format.</li>
        <li>Missing or invalid required values may exclude a row or stop the analysis, depending on the tool. Check its row and column diagnostics. Zero and blank are treated differently.</li>
        <li>Extra columns are fine—anything this tool does not use is ignored.</li>
      </ul>

      <p className="template-detail__back">
        <Link href="/en/templates">← All templates</Link>
      </p>
    </section>
  );
}
