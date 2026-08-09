import GrowthFunnelReport from "@/components/GrowthFunnelReport";

export const metadata = {
  title: "제품 성장 퍼널 리포트",
  description: "GA4 이벤트 내보내기를 브라우저에서 분석하는 내부 운영 리포트입니다.",
  robots: { index: false, follow: false },
};

export default function GrowthFunnelPage() {
  return <GrowthFunnelReport />;
}
