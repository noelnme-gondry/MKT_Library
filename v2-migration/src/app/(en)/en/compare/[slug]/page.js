import { notFound } from "next/navigation";

import ComparePage from "@/components/ComparePage";
import { COMPARE_SLUGS, getComparePage, getCompareFaq } from "@/lib/compareContent";
import { SITE_URL } from "@/lib/routeMap";
import { withOpenGraphBase } from "@/lib/openGraph";

// EN 미러. KO와 같은 SSOT·같은 마크업을 쓰고 로케일만 다르다(§2.11).
export function generateStaticParams() {
  return COMPARE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const page = getComparePage(slug, "en");
  if (!page) return {};
  const canonical = `${SITE_URL}/en/compare/${slug}`;
  return {
    title: page.title,
    description: page.answer,
    alternates: {
      canonical,
      languages: {
        ko: `${SITE_URL}/compare/${slug}`,
        en: canonical,
        "x-default": canonical,
      },
    },
    openGraph: withOpenGraphBase({ title: page.title, description: page.answer, url: canonical, images: [`${SITE_URL}/og-card.png`] }),
  };
}

export default async function Page({ params }) {
  const { slug } = await params;
  const page = getComparePage(slug, "en");
  if (!page) notFound();

  const faqStructuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: "en",
    mainEntity: getCompareFaq(slug, "en").map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqStructuredData) }} />
    <ComparePage slug={slug} locale="en" />
  </>;
}
