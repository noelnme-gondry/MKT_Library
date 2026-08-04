import { notFound } from "next/navigation";
import CalculatorPage from "@/components/calculators/CalculatorPage";
import { CALCULATOR_ORDER, getCalculator } from "@/lib/calculators";
import { SITE_URL } from "@/lib/routeMap";
import { withOpenGraphBase } from "@/lib/openGraph";

export function generateStaticParams() {
  return CALCULATOR_ORDER.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const calculator = getCalculator(slug, "en");
  if (!calculator) return {};
  const canonical = `${SITE_URL}/en/calculator/${slug}`;
  return {
    title: calculator.title,
    description: calculator.description,
    alternates: {
      canonical,
      languages: { ko: `${SITE_URL}/calculator/${slug}`, en: canonical, "x-default": `${SITE_URL}/calculator/${slug}` },
    },
    openGraph: withOpenGraphBase({ title: calculator.title, description: calculator.description, url: canonical, images: [`${SITE_URL}/og-card.png`] }, "en"),
  };
}

export default async function EnglishCalculatorRoute({ params }) {
  const { slug } = await params;
  const calculator = getCalculator(slug, "en");
  if (!calculator) notFound();
  const url = `${SITE_URL}/en/calculator/${slug}`;
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
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      },
      {
        "@type": "FAQPage",
        mainEntity: calculator.faq.map(([question, answer]) => ({
          "@type": "Question",
          name: question,
          acceptedAnswer: { "@type": "Answer", text: answer },
        })),
      },
    ],
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <CalculatorPage slug={slug} locale="en" />
    </>
  );
}
