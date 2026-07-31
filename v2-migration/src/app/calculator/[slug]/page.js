import { notFound } from "next/navigation";
import CalculatorPage from "@/components/calculators/CalculatorPage";
import { CALCULATOR_ORDER, getCalculator } from "@/lib/calculators";
import { SITE_URL } from "@/lib/routeMap";

export function generateStaticParams() {
  return CALCULATOR_ORDER.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const calculator = getCalculator(slug, "ko");
  if (!calculator) return {};
  const canonical = `${SITE_URL}/calculator/${slug}`;
  return {
    title: calculator.title,
    description: calculator.description,
    alternates: {
      canonical,
      languages: { ko: canonical, en: `${SITE_URL}/en/calculator/${slug}`, "x-default": canonical },
    },
    openGraph: { title: calculator.title, description: calculator.description, url: canonical, images: [`${SITE_URL}/og-card.png`] },
  };
}

export default async function CalculatorRoute({ params }) {
  const { slug } = await params;
  const calculator = getCalculator(slug, "ko");
  if (!calculator) notFound();
  const url = `${SITE_URL}/calculator/${slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: calculator.name,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url,
        description: calculator.description,
        offers: { "@type": "Offer", price: "0", priceCurrency: "KRW" },
      },
      {
        "@type": "FAQPage",
        mainEntity: calculator.faq.map(([question, answer]) => ({
          "@type": "Question",
          name: question,
          acceptedAnswer: { "@type": "Answer", text: answer },
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "홈", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "계산기", item: `${SITE_URL}/calculator` },
          { "@type": "ListItem", position: 3, name: calculator.name, item: url },
        ],
      },
    ],
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <CalculatorPage slug={slug} />
    </>
  );
}
