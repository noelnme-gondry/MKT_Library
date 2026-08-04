import CalculatorHub from "@/components/calculators/CalculatorHub";
import { SITE_URL } from "@/lib/routeMap";
import { withOpenGraphBase } from "@/lib/openGraph";

export const metadata = {
  title: "Free Marketing Metric Calculators | LTV, CAC, ROAS, CPA & A/B",
  description: "Calculate LTV:CAC, payback, break-even ROAS, target CPA, A/B sample size, and installs from budget without a CSV.",
  alternates: {
    canonical: `${SITE_URL}/en/calculator`,
    languages: { ko: `${SITE_URL}/calculator`, en: `${SITE_URL}/en/calculator`, "x-default": `${SITE_URL}/calculator` },
  },
  openGraph: withOpenGraphBase({
    title: "Free performance marketing calculators",
    description: "Calculate LTV, CAC, ROAS, CPA, and A/B sample size without uploading a CSV.",
    url: `${SITE_URL}/en/calculator`,
    locale: "en_US",
    images: [`${SITE_URL}/og-card.png`],
  }, "en"),
};

export default function EnglishCalculatorHubPage() {
  return <CalculatorHub locale="en" />;
}
