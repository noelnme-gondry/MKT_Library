import SopContent from "@/components/sops/SopContent";
import { SITE_URL } from "@/lib/routeMap";

// Second EN guide pilot (batch 2) — mirrors the KR route (/guide/csv-data-prep, routeId
// "8-1") using the JSON-data-based SopContent path (public/content/pages/8-1.en.json).
// Same pattern as /en/guide/dev-collaboration (1-1).
export async function generateMetadata() {
  const title = "CSV Data Prep & Column Mapping Guide | Growth Opt Playbook";
  const description =
    "How CSV upload and auto column-mapping works across every analysis tool, and how to fix common mapping errors.";
  const canonical = `${SITE_URL}/en/guide/csv-data-prep`;
  return {
    // absolute: title이 이미 브랜드 접미사 포함 — layout.js template 중복 적용 방지.
    title: { absolute: title },
    description,
    alternates: {
      canonical,
      languages: { ko: `${SITE_URL}/guide/csv-data-prep`, en: canonical },
    },
    openGraph: {
      title,
      description,
      url: canonical,
      locale: "en_US",
    },
  };
}

export default function EnCsvDataPrepPage() {
  return (
    <article className="content" id="content" aria-live="polite">
      <SopContent routeId="8-1" locale="en" />
    </article>
  );
}
