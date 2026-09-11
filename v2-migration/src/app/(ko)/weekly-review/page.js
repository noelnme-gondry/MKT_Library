import ProjectReviewWorkspace from "@/components/ProjectReviewWorkspace";
import { SITE_URL } from "@/lib/routeMap";

export const metadata = {
  title: "주간 마케팅 리뷰 · CSV 비교와 보고서",
  description: "캠페인 CSV로 주간 KPI 변화와 분해 근거를 확인하고, 지난 결정 검토부터 다음 행동과 보고서까지 브라우저에서 이어갑니다.",
  alternates: { canonical: `${SITE_URL}/weekly-review`, languages: { ko: `${SITE_URL}/weekly-review`, en: `${SITE_URL}/en/weekly-review`, "x-default": `${SITE_URL}/weekly-review` } },
};

export default function WeeklyReviewPage() {
  return <ProjectReviewWorkspace />;
}
