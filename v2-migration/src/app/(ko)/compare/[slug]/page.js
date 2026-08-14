import { notFound } from "next/navigation";

import ComparePage from "@/components/ComparePage";
import { COMPARE_SLUGS, getComparePage, getCompareFaq } from "@/lib/compareContent";
import { SITE_URL } from "@/lib/routeMap";
import { withOpenGraphBase } from "@/lib/openGraph";

// 방법 비교 상세. 내용은 `lib/compareContent.js` SSOT에서 오고, 이 파일은 라우팅과
// 메타·구조화 데이터만 맡는다. FAQ JSON-LD의 첫 항목은 페이지의 핵심 질문이다.
export function generateStaticParams() {
  return COMPARE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const page = getComparePage(slug, "ko");
  if (!page) return {};
  const canonical = `${SITE_URL}/compare/${slug}`;
  return {
    title: page.title,
    description: page.answer,
    alternates: {
      canonical,
      languages: {
        ko: canonical,
        en: `${SITE_URL}/en/compare/${slug}`,
        "x-default": canonical,
      },
    },
    openGraph: withOpenGraphBase({ title: page.title, description: page.answer, url: canonical, images: [`${SITE_URL}/og-card.png`] }),
  };
}

export default async function Page({ params }) {
  const { slug } = await params;
  const page = getComparePage(slug, "ko");
  if (!page) notFound();

  const faqStructuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: getCompareFaq(slug, "ko").map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqStructuredData) }} />
    <ComparePage slug={slug} locale="ko" />
  </>;
}
