import MarketingAnalysisHub from "@/components/MarketingAnalysisHub";
import { marketingAnalysisCopy } from "@/lib/marketingAnalysisHub";

import { SITE_URL } from "@/lib/routeMap";
import { withOpenGraphBase } from "@/lib/openGraph";

export async function generateMetadata() {
  const { title, description } = marketingAnalysisCopy("en");
  const canonical = `${SITE_URL}/en/compare`;
  return {
    title,
    description,
    alternates: {
      canonical,
      languages: { ko: `${SITE_URL}/compare`, en: canonical, "x-default": canonical },
    },
    openGraph: withOpenGraphBase({ title, description, url: canonical, images: [`${SITE_URL}/og-card.png`] }),
  };
}

export default function Page() {
  return <MarketingAnalysisHub locale="en" />;
}
