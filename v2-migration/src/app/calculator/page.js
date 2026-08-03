import CalculatorHub from "@/components/calculators/CalculatorHub";
import { SITE_URL } from "@/lib/routeMap";

export const metadata = {
  title: "무료 마케팅 지표 계산기 | LTV·CAC·ROAS·CPA·A/B",
  description: "LTV:CAC, 페이백, 손익분기 ROAS, 목표 CPA, A/B 테스트 표본수와 예산별 설치수를 CSV 없이 바로 계산합니다.",
  alternates: {
    canonical: `${SITE_URL}/calculator`,
    languages: { ko: `${SITE_URL}/calculator`, en: `${SITE_URL}/en/calculator`, "x-default": `${SITE_URL}/calculator` },
  },
  openGraph: {
    title: "무료 마케팅 지표 계산기",
    description: "CSV 없이 LTV·CAC·ROAS·CPA·A/B 표본수를 바로 계산하세요.",
    url: `${SITE_URL}/calculator`,
    images: [`${SITE_URL}/og-card.png`],
  },
};

export default function CalculatorHubPage() {
  return <CalculatorHub />;
}
