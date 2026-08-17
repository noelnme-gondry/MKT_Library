import SopContent from "@/components/sops/SopContent";
import { SITE_URL } from "@/lib/routeMap";
import { readSopData } from "@/lib/sopData";
import { withOpenGraphBase } from "@/lib/openGraph";

// EN pilot — mirrors the KR route (/guide/dev-collaboration, routeId "1-1") using the
// JSON-data-based SopContent path (public/content/pages/1-1.en.json). Only "1-1" has an
// EN JSON variant right now (§ SOP EN pilot) — the other 14 guides stay KR-only for now.
export async function generateMetadata() {
  const title = "Developer Collaboration Guide & Technical PRD | Growth Opt Playbook";
  const description =
    "MMP (Adjust) SDK initialization, deep-link routing, and pre-release QA checklist unified into one developer collaboration standard.";
  const canonical = `${SITE_URL}/en/guide/dev-collaboration`;
  return {
    // absolute: title이 이미 브랜드 접미사 포함 — layout.js template 중복 적용 방지.
    title: { absolute: title },
    description,
    alternates: {
      canonical,
      languages: { ko: `${SITE_URL}/guide/dev-collaboration`, en: canonical, "x-default": canonical },
    },
    openGraph: withOpenGraphBase({
      title,
      description,
      url: canonical,
      locale: "en_US",
      images: [`${SITE_URL}/og-card.png`],
    }, "en"),
  };
}

export default function EnDevCollaborationPage() {
  const initialData = readSopData("1-1", "en");
  return (
    <article className="content" id="content">
      <SopContent routeId="1-1" locale="en" initialData={initialData} />
    </article>
  );
}
