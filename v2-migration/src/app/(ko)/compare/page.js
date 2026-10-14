import MarketingAnalysisHub from "@/components/MarketingAnalysisHub";
import { marketingAnalysisCopy } from "@/lib/marketingAnalysisHub";

import { SITE_URL } from "@/lib/routeMap";
import { withOpenGraphBase } from "@/lib/openGraph";

// 방법 비교 목록. 카드 문구는 각 페이지의 질문·답을 그대로 쓴다 —
// 여기에 따로 요약을 적으면 상세와 갈라진다.
export async function generateMetadata() {
  const { title, description } = marketingAnalysisCopy("ko");
  const canonical = `${SITE_URL}/compare`;
  return {
    title,
    description,
    alternates: {
      canonical,
      languages: { ko: canonical, en: `${SITE_URL}/en/compare`, "x-default": `${SITE_URL}/en/compare` },
    },
    openGraph: withOpenGraphBase({ title, description, url: canonical, images: [`${SITE_URL}/og-card.png`] }),
  };
}

export default function Page() {
  return <MarketingAnalysisHub locale="ko" />;
}
